import os
import re
import json
import asyncio
import requests
import dotenv
from contextlib import asynccontextmanager
from typing import List, Optional

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
dotenv.load_dotenv(dotenv_path=os.path.join(ROOT_DIR, ".env"))
dotenv.load_dotenv(dotenv_path=os.path.join(ROOT_DIR, ".env.local"), override=True)

from pydantic import BaseModel, ConfigDict
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import shutil

from .database import get_db, Project, Scene, Character, Setting, SHARED_CHARACTERS_DIR
from .queue_worker import start_queue_worker, task_queue, GenerationTask
from .services import voice_engine

# Pydantic Schemas

class SceneBase(BaseModel):
    scene_number: int
    narration_khmer: Optional[str] = None
    image_prompt_english: Optional[str] = None
    negative_prompt: Optional[str] = None
    user_refinement_prompt: Optional[str] = None
    audio_path: Optional[str] = None
    image_path: Optional[str] = None
    audio_status: Optional[str] = "idle"
    image_status: Optional[str] = "idle"

class SceneUpdate(BaseModel):
    narration_khmer: Optional[str] = None
    image_prompt_english: Optional[str] = None
    negative_prompt: Optional[str] = None
    user_refinement_prompt: Optional[str] = None

class SceneOut(SceneBase):
    id: int
    project_id: int
    character_id: Optional[int] = None
    character_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class CharacterOut(BaseModel):
    id: int
    name: str
    gender: str
    personality_tag: str
    audio_path: str
    reference_text: str

    model_config = ConfigDict(from_attributes=True)

class PreviewPayload(BaseModel):
    gender: str
    personality_tag: str
    reference_text: str

class ProjectBase(BaseModel):
    title: str
    raw_research: Optional[str] = None
    script_narrative: Optional[str] = None
    video_concept: Optional[str] = None
    illustration_style: Optional[str] = None
    global_voice_style: Optional[str] = None
    structured_json_data: Optional[str] = None
    status: Optional[str] = "draft"
    master_audio_path: Optional[str] = None
    voice_profile_tag: Optional[str] = None

class ProjectCreate(BaseModel):
    title: str

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    raw_research: Optional[str] = None
    script_narrative: Optional[str] = None
    video_concept: Optional[str] = None
    illustration_style: Optional[str] = None
    global_voice_style: Optional[str] = None
    structured_json_data: Optional[str] = None
    status: Optional[str] = None
    master_audio_path: Optional[str] = None
    voice_profile_tag: Optional[str] = None

class ProjectOutList(ProjectBase):
    id: int
    slug: str

    model_config = ConfigDict(from_attributes=True)

class ProjectOut(ProjectBase):
    id: int
    slug: str
    scenes: List[SceneOut] = []

    model_config = ConfigDict(from_attributes=True)

class SceneRefine(BaseModel):
    user_instruction: str

class GenerateFieldPayload(BaseModel):
    field_name: str

class SettingUpdate(BaseModel):
    active_provider: str
    active_slot: int

class ImageGeneratePayload(BaseModel):
    aspect_ratio: str
    guidance_scale: float
    inference_steps: int


# Background worker task reference
worker_task = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global worker_task
    worker_task = asyncio.create_task(start_queue_worker())
    yield
    if worker_task:
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            print("Queue worker gracefully shut down.")

app = FastAPI(lifespan=lifespan)

workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace"))
os.makedirs(workspace_dir, exist_ok=True)
app.mount("/static", StaticFiles(directory=workspace_dir), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "CavePaint backend is healthy"}


@app.get("/api/settings")
async def get_settings(db: Session = Depends(get_db)):
    setting = db.query(Setting).first()
    if not setting:
        return {"active_provider": "gemini", "active_slot": 1}
    return {"active_provider": setting.active_provider, "active_slot": setting.active_slot}

@app.put("/api/settings")
async def update_settings(payload: SettingUpdate, db: Session = Depends(get_db)):
    setting = db.query(Setting).first()
    if not setting:
        setting = Setting(active_provider=payload.active_provider, active_slot=payload.active_slot)
        db.add(setting)
    else:
        setting.active_provider = payload.active_provider
        setting.active_slot = payload.active_slot
    db.commit()
    return {"status": "success"}

# Projects CRUD
@app.post("/api/projects", response_model=ProjectOut)
async def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    slug = re.sub(r'[^a-z0-9]+', '-', payload.title.lower()).strip('-')
    
    existing = db.query(Project).filter(Project.slug == slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Project with this title/slug already exists")
        
    project = Project(
        title=payload.title,
        slug=slug,
        status="draft"
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    
    # Immediately build an empty default relational placeholder row
    scene = Scene(
        project_id=project.id,
        scene_number=1,
        image_status="idle",
        audio_status="idle"
    )
    db.add(scene)
    db.commit()
    db.refresh(project)
    
    # Create workspace directory
    proj_workspace_dir = os.path.join(workspace_dir, slug)
    os.makedirs(proj_workspace_dir, exist_ok=True)
    
    return project

@app.post("/api/projects/{project_id}/duplicate", response_model=ProjectOut)
async def duplicate_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    new_title = f"{project.title} (Copy)"
    base_slug = re.sub(r'[^a-z0-9]+', '-', new_title.lower()).strip('-')
    slug = base_slug
    counter = 1
    while db.query(Project).filter(Project.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    new_project = Project(
        title=new_title,
        slug=slug,
        raw_research=project.raw_research,
        script_narrative=project.script_narrative,
        video_concept=project.video_concept,
        illustration_style=project.illustration_style,
        global_voice_style=project.global_voice_style,
        structured_json_data=project.structured_json_data,
        status="draft"
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    has_scenes = False
    if new_project.structured_json_data:
        try:
            scenes_data = json.loads(new_project.structured_json_data)
            if isinstance(scenes_data, list) and len(scenes_data) > 0:
                for scene_obj in scenes_data:
                    scene = Scene(
                        project_id=new_project.id,
                        scene_number=scene_obj.get("scene_number", 1),
                        narration_khmer=scene_obj.get("narration_khmer"),
                        image_prompt_english=scene_obj.get("image_prompt_english"),
                        negative_prompt=scene_obj.get("negative_prompt"),
                        image_status="idle",
                        audio_status="idle"
                    )
                    db.add(scene)
                has_scenes = True
        except json.JSONDecodeError:
            pass

    if not has_scenes:
        scene = Scene(
            project_id=new_project.id,
            scene_number=1,
            image_status="idle",
            audio_status="idle"
        )
        db.add(scene)

    db.commit()
    db.refresh(new_project)

    proj_workspace_dir = os.path.join(workspace_dir, slug)
    os.makedirs(proj_workspace_dir, exist_ok=True)

    return new_project

@app.get("/api/projects", response_model=List[ProjectOutList])
async def get_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    return projects

@app.get("/api/projects/{project_id}", response_model=ProjectOut)
async def get_project_details(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Auto-healing filesystem validation
    modified = False
    for scene in project.scenes:
        if scene.image_path:
            full_path = os.path.join(workspace_dir, scene.image_path)
            if not os.path.exists(full_path):
                scene.image_path = None
                scene.image_status = "idle"
                modified = True
                
        if scene.audio_path:
            full_path = os.path.join(workspace_dir, scene.audio_path)
            if not os.path.exists(full_path):
                scene.audio_path = None
                scene.audio_status = "idle"
                modified = True
                
                
    if project.master_audio_path:
        full_path = os.path.join(workspace_dir, project.master_audio_path)
        if not os.path.exists(full_path):
            project.master_audio_path = None
            modified = True

    if modified:
        db.commit()
        db.refresh(project)
        
    # Eagerly loaded implicitly by SQLAlchemy relationship
    project.scenes.sort(key=lambda x: x.scene_number)
    return project

@app.post("/api/projects/{project_id}/reset-voice")
async def reset_voice(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    proj_workspace_dir = os.path.join(workspace_dir, project.slug)
    
    seed_path = os.path.join(proj_workspace_dir, "voice_profile_seed.wav")
    if os.path.exists(seed_path):
        try:
            os.remove(seed_path)
        except OSError:
            pass
            
    project.master_audio_path = None
    project.voice_profile_tag = None
    
    for scene in project.scenes:
        if scene.audio_path:
            full_path = os.path.join(workspace_dir, scene.audio_path)
            if os.path.exists(full_path):
                try:
                    os.remove(full_path)
                except OSError:
                    pass
        scene.audio_path = None
        scene.audio_status = "idle"
        
    db.commit()
    return {"status": "success", "message": "Voice profile and audio scenes reset"}

@app.put("/api/projects/{project_id}", response_model=ProjectOut)
async def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    update_data = payload.model_dump(exclude_unset=True)
    
    if "structured_json_data" in update_data and update_data["structured_json_data"]:
        try:
            scenes_data = json.loads(update_data["structured_json_data"])
            if isinstance(scenes_data, list):
                db.query(Scene).filter(Scene.project_id == project_id).delete()
                for scene_obj in scenes_data:
                    scene = Scene(
                        project_id=project_id,
                        scene_number=scene_obj.get("scene_number", 1),
                        narration_khmer=scene_obj.get("narration_khmer"),
                        image_prompt_english=scene_obj.get("image_prompt_english"),
                        negative_prompt=scene_obj.get("negative_prompt"),
                        image_status="idle",
                        audio_status="idle"
                    )
                    db.add(scene)
        except json.JSONDecodeError:
            pass

    for key, value in update_data.items():
        setattr(project, key, value)
        
    db.commit()
    db.refresh(project)
    project.scenes.sort(key=lambda x: x.scene_number)
    return project

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    slug = project.slug
    db.delete(project)
    db.commit()
    
    proj_workspace_dir = os.path.join(workspace_dir, slug)
    if os.path.exists(proj_workspace_dir):
        shutil.rmtree(proj_workspace_dir)
        
    return {"status": "success", "message": "Project and associated scenes deleted"}


# Scene CRUD
@app.put("/api/scenes/{scene_id}", response_model=SceneOut)
async def update_scene(scene_id: int, payload: SceneUpdate, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(scene, key, value)
        
    db.commit()
    db.refresh(scene)
    return scene

# Existing operations for generating and parsing

@app.post("/api/projects/{project_id}/generate-field")
async def generate_project_field(project_id: int, payload: GenerateFieldPayload, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.field_name not in ["script_narrative", "illustration_style", "structured_json_data", "video_concept", "global_voice_style"]:
        raise HTTPException(status_code=400, detail="Invalid field_name")

    from .services.llm_orchestrator import generate_field_content

    context = f"Research:\n{project.raw_research or ''}\n\nVideo Concept:\n{project.video_concept or ''}"

    try:
        generated_text = generate_field_content(db, payload.field_name, context)
        
        if payload.field_name == "structured_json_data":
            try:
                # Basic validation that it's json array
                parsed = json.loads(generated_text)
                if not isinstance(parsed, list):
                    generated_text = json.dumps([parsed], indent=2)
                else:
                    generated_text = json.dumps(parsed, indent=2)
            except json.JSONDecodeError:
                pass # Just save the string and let the frontend show error or retry
                
        setattr(project, payload.field_name, generated_text)
        db.commit()
        db.refresh(project)
        return {"status": "success", "field_name": payload.field_name, "generated_text": generated_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/projects/{project_id}/parse")
async def parse_project_scenes(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    try:
        from .services.llm.orchestrators.structure import build_structured_scenes
        scenes_data = build_structured_scenes(
            db=db,
            raw_research=project.raw_research or "",
            video_concept=project.video_concept or "",
            script_narrative=project.script_narrative or "",
            illustration_style=project.illustration_style or "",
            vocal_style=project.global_voice_style or ""
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    db.query(Scene).filter(Scene.project_id == project_id).delete()
    
    new_scenes = []
    clean_json_array = []
    for scene_item in scenes_data:
        scene = Scene(
            project_id=project.id,
            scene_number=scene_item.get("scene_number"),
            narration_khmer=scene_item.get("narration_khmer"),
            image_prompt_english=scene_item.get("image_prompt_english")
        )
        db.add(scene)
        new_scenes.append(scene)
        
        clean_json_array.append({
            "scene_number": scene_item.get("scene_number"),
            "narration_khmer": scene_item.get("narration_khmer"),
            "image_prompt_english": scene_item.get("image_prompt_english"),
            "negative_prompt": None
        })
        
    project.structured_json_data = json.dumps(clean_json_array)
    db.commit()
    return {"status": "success", "scenes_created": len(new_scenes)}


class ScriptSegmentPayload(BaseModel):
    long_script: str

@app.post("/api/projects/{project_id}/segment-script")
async def segment_project_script(project_id: int, payload: ScriptSegmentPayload, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    long_script = payload.long_script or ""
    clean_script = re.sub(r"\(.*?\)", "", long_script)
    chunks = [c.strip() for c in re.split(r"[។\n]+", clean_script) if c.strip()]
    
    scenes = db.query(Scene).filter(Scene.project_id == project_id).order_by(Scene.scene_number).all()
    
    for i, chunk in enumerate(chunks):
        if i < len(scenes):
            if scenes[i].narration_khmer != chunk:
                scenes[i].narration_khmer = chunk
                if scenes[i].audio_status == "completed":
                    scenes[i].audio_status = "outdated"
        else:
            new_scene = Scene(
                project_id=project.id,
                scene_number=i + 1,
                narration_khmer=chunk,
                image_status="idle",
                audio_status="idle"
            )
            db.add(new_scene)
            
    if len(chunks) < len(scenes):
        for scene_to_delete in scenes[len(chunks):]:
            if scene_to_delete.audio_path:
                full_path = os.path.join(workspace_dir, scene_to_delete.audio_path)
                if os.path.exists(full_path):
                    try:
                        os.remove(full_path)
                    except OSError:
                        pass
            if scene_to_delete.image_path:
                full_path = os.path.join(workspace_dir, scene_to_delete.image_path)
                if os.path.exists(full_path):
                    try:
                        os.remove(full_path)
                    except OSError:
                        pass
            db.delete(scene_to_delete)
            
    db.commit()
    return {"status": "success", "chunks_mapped": len(chunks)}


@app.post("/api/scenes/{scene_id}/refine")
def refine_image_prompt_endpoint(scene_id: int, payload: SceneRefine, db: Session = Depends(get_db)):
    # 1. Fetch target scene configuration from database
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Target scene structure not found.")
        
    # 2. Extract corresponding parent project context configurations
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Parent project context not found.")
        
    # Gather database states with safe string fallbacks
    current_positive = scene.image_prompt_english or ""
    current_negative = scene.negative_prompt or ""
    global_style = project.illustration_style or "Simple 2D flat vector art style, minimalist stickman character, bold clean outlines"
    video_concept = project.video_concept or ""
    
    # 3. Call the JSON refinement orchestrator
    from .services.llm.orchestrators.refinement import refine_scene_prompt
    updated_prompts = refine_scene_prompt(
        db=db,
        existing_prompt=current_positive,
        existing_negative_prompt=current_negative,
        user_instruction=payload.user_instruction,
        global_style=global_style,
        video_concept=video_concept
    )
    
    # 4. Save and commit updated strings back to SQLite cache
    scene.user_refinement_prompt = payload.user_instruction
    scene.image_prompt_english = updated_prompts.get("image_prompt_english", current_positive)
    scene.negative_prompt = updated_prompts.get("negative_prompt_english", current_negative)
    
    try:
        db.commit()
        db.refresh(scene)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database state commitment failure: {str(e)}")
        
    # 5. Return structured payload to frontend components
    return {
        "status": "success",
        "scene_id": scene.id,
        "image_prompt_english": scene.image_prompt_english,
        "negative_prompt_english": scene.negative_prompt
    }


@app.post("/api/scenes/{scene_id}/generate-image")
async def generate_scene_image(scene_id: int, payload: ImageGeneratePayload, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    project = db.query(Project).filter(Project.id == scene.project_id).first()
        
    task_payload = {
        "prompt": scene.image_prompt_english,
        "style": project.illustration_style,
        "negative_prompt": scene.negative_prompt,
        "aspect_ratio": payload.aspect_ratio,
        "guidance_scale": payload.guidance_scale,
        "inference_steps": payload.inference_steps
    }
    
    task = GenerationTask(
        task_type="image",
        project_id=scene.project_id,
        scene_id=scene.id,
        payload=task_payload
    )
    
    await task_queue.put(task)
    
    scene.image_status = "processing"
    db.commit()
    return {"status": "queued"}

@app.post("/api/scenes/{scene_id}/stop")
async def stop_scene_generation(scene_id: int, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    scene.image_status = "idle"
    db.commit()
    
    try:
        requests.post("http://127.0.0.1:7860/sdapi/v1/interrupt", timeout=2)
    except Exception as e:
        print(f"Interrupt API unreachable or failed: {e}")
        
    return {"status": "stopped"}

@app.delete("/api/scenes/{scene_id}/image")
async def delete_scene_image(scene_id: int, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    if scene.image_path:
        full_path = os.path.join(workspace_dir, scene.image_path)
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
            except OSError as e:
                print(f"Error removing file {full_path}: {e}")
            
    scene.image_path = None
    scene.image_status = "idle"
    db.commit()
    
    return {"status": "success"}

@app.post("/api/scenes/{scene_id}/generate-audio")
async def generate_scene_audio_single(scene_id: int, character_id: Optional[int] = None, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not scene.narration_khmer:
        raise HTTPException(status_code=400, detail="Scene has no narration text.")
        
    scene.audio_status = "processing"
    
    task_payload = {"text": scene.narration_khmer}
    if character_id is not None:
        task_payload["character_id"] = character_id
        
    task = GenerationTask(
        task_type="audio_single",
        project_id=project.id,
        scene_id=scene.id,
        payload=task_payload
    )
    await task_queue.put(task)
    
    db.commit()
    
    return {"status": "queued"}

# Global Character Routing

@app.get("/api/characters", response_model=List[CharacterOut])
async def get_characters(db: Session = Depends(get_db)):
    characters = db.query(Character).order_by(Character.name).all()
    return characters

@app.post("/api/characters/preview")
async def create_character_preview(payload: PreviewPayload):
    from .services.voice_engine import generate_character_preview
    path = generate_character_preview(payload.personality_tag, payload.reference_text)
    return {"status": "success", "audio_path": path}

@app.delete("/api/characters/preview")
async def delete_character_preview():
    temp_preview_path = os.path.join(SHARED_CHARACTERS_DIR, "temp_preview.wav")
    if os.path.exists(temp_preview_path):
        os.remove(temp_preview_path)
    return {"status": "success", "message": "Preview deleted"}

@app.post("/api/characters", response_model=CharacterOut)
async def create_character(
    name: str = Form(...),
    gender: str = Form(...),
    personality_tag: str = Form(...),
    reference_text: str = Form(...),
    audio_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    slug_name = re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')
    
    if audio_file:
        file_extension = os.path.splitext(audio_file.filename)[1] or '.wav'
        filename = f"{slug_name}{file_extension}"
        save_path = os.path.join(SHARED_CHARACTERS_DIR, filename)
        
        with open(save_path, "wb") as buffer:
            shutil.copyfileobj(audio_file.file, buffer)
            
        rel_audio_path = os.path.join("shared_characters", filename).replace("\\", "/")
    else:
        temp_preview_path = os.path.join(SHARED_CHARACTERS_DIR, "temp_preview.wav")
        if not os.path.exists(temp_preview_path):
            raise HTTPException(status_code=400, detail="No audio file uploaded and no preview found")
            
        filename = f"{slug_name}.wav"
        save_path = os.path.join(SHARED_CHARACTERS_DIR, filename)
        
        shutil.move(temp_preview_path, save_path)
        rel_audio_path = os.path.join("shared_characters", filename).replace("\\", "/")
    
    character = Character(
        name=name,
        gender=gender,
        personality_tag=personality_tag,
        reference_text=reference_text,
        audio_path=rel_audio_path
    )
    db.add(character)
    db.commit()
    db.refresh(character)
    
    return character

@app.delete("/api/characters/{character_id}")
async def delete_character(character_id: int, db: Session = Depends(get_db)):
    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
        
    if character.audio_path:
        full_path = os.path.join(workspace_dir, character.audio_path)
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
            except OSError as e:
                print(f"Error removing character file {full_path}: {e}")
                
    db.delete(character)
    db.commit()
    return {"status": "success", "message": "Character deleted"}

# Tab 3 & 4 routes
@app.post("/api/projects/{project_id}/generate-voice")
async def generate_project_voice(project_id: int, character_id: Optional[int] = None, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
    
    queued_count = 0
    for scene in scenes:
        if scene.narration_khmer:
            payload = {"text": scene.narration_khmer}
            if character_id:
                payload["character_id"] = character_id
                
            task = GenerationTask(
                task_type="audio_single" if character_id else "audio",
                project_id=project.id,
                scene_id=scene.id,
                payload=payload
            )
            await task_queue.put(task)
            scene.audio_status = "processing"
            queued_count += 1
            
    db.commit()
    return {"status": "queued", "count": queued_count}

@app.post("/api/projects/{project_id}/stop-voice")
async def stop_project_voice(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
    count = 0
    for scene in scenes:
        if scene.audio_status == "processing":
            scene.audio_status = "idle"
            count += 1
            
    db.commit()
    return {"status": "stopped", "cancelled_count": count}

@app.post("/api/model/load")
async def load_voice_model():
    success = await asyncio.to_thread(voice_engine.load_model)
    return {"status": "success" if success else "failed"}

@app.post("/api/model/unload")
async def unload_voice_model():
    success = await asyncio.to_thread(voice_engine.unload_model)
    return {"status": "success" if success else "failed"}

@app.get("/api/model/status")
async def get_model_status():
    return {"state": voice_engine._MODEL_STATE}
