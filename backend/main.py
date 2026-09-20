import os
import re
import json
import asyncio
import requests
import dotenv
import time
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

from .database import get_db, Project, Scene, Character, Setting, Generation, SHARED_CHARACTERS_DIR, sync_project_json
from .queue_worker import start_queue_worker, task_queue, GenerationTask
from .services import voice_engine, flow_engine, render_engine

# Pydantic Schemas

class SceneBase(BaseModel):
    scene_number: int
    narration_khmer: Optional[str] = None
    image_prompt_english: Optional[str] = None
    negative_prompt: Optional[str] = None
    user_refinement_prompt: Optional[str] = None
    audio_path: Optional[str] = None
    image_path: Optional[str] = None
    images_list: Optional[str] = "[]"
    reference_images: Optional[str] = "[]"
    audio_status: Optional[str] = "idle"
    image_status: Optional[str] = "idle"

class SceneUpdate(BaseModel):
    narration_khmer: Optional[str] = None
    image_prompt_english: Optional[str] = None
    negative_prompt: Optional[str] = None
    user_refinement_prompt: Optional[str] = None
    character_id: Optional[int] = None
    character_name: Optional[str] = None
    audio_status: Optional[str] = None

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
    audio_format: Optional[str] = "wav"
    theme_era: Optional[str] = None
    theme_mood: Optional[str] = None
    theme_custom: Optional[str] = None
    aspect_ratio: Optional[str] = "16:9"
    character_attire: Optional[str] = None
    scene_staging: Optional[str] = "studio"
    flow_project_id: Optional[str] = None
    timeline_data: Optional[str] = None

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
    audio_format: Optional[str] = None
    theme_era: Optional[str] = None
    theme_mood: Optional[str] = None
    theme_custom: Optional[str] = None
    aspect_ratio: Optional[str] = None
    character_attire: Optional[str] = None
    scene_staging: Optional[str] = None
    flow_project_id: Optional[str] = None
    timeline_data: Optional[str] = None

class ProjectOutList(ProjectBase):
    id: int
    slug: str

    model_config = ConfigDict(from_attributes=True)

class ProjectSummary(BaseModel):
    id: int
    title: str
    slug: str
    status: Optional[str] = "draft"
    scene_count: int = 0
    scenes_with_images: int = 0
    scenes_with_audio: int = 0

    model_config = ConfigDict(from_attributes=True)

class ProjectOut(ProjectBase):
    id: int
    slug: str
    scenes: List[SceneOut] = []

    model_config = ConfigDict(from_attributes=True)

class SceneRefine(BaseModel):
    user_instruction: str

class FlowAdjustPayload(BaseModel):
    instruction: str
    reference_image: Optional[str] = None
    refine_prompt_text: bool = False
    generate_image: bool = True
    model: Optional[str] = "nano2"
    aspect_ratio: Optional[str] = "16:9"
    count: Optional[int] = 1
    image_provider: Optional[str] = "flow"

class GenerateFieldPayload(BaseModel):
    field_name: str

class SettingUpdate(BaseModel):
    active_provider: Optional[str] = "gemini"
    active_slot: Optional[int] = 1
    image_provider: Optional[str] = "local"

class ImageGeneratePayload(BaseModel):
    aspect_ratio: Optional[str] = "16:9"
    guidance_scale: Optional[float] = 7.5
    inference_steps: Optional[int] = 10
    model: Optional[str] = "nano2"
    count: Optional[int] = 1
    image_provider: Optional[str] = None
    reference_images: Optional[List[str]] = None

class SetActiveImagePayload(BaseModel):
    image_path: str


# Background worker task reference
worker_task = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global worker_task
    from .services import voice_engine
    voice_engine.set_event_loop(asyncio.get_running_loop())
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

@app.get("/api/flow/status")
async def get_flow_status():
    return flow_engine.check_flow_status()


@app.get("/api/settings")
async def get_settings(db: Session = Depends(get_db)):
    setting = db.query(Setting).first()
    if not setting:
        return {"active_provider": "gemini", "active_slot": 1, "image_provider": "local"}
    return {
        "active_provider": setting.active_provider,
        "active_slot": setting.active_slot,
        "image_provider": setting.image_provider or "local"
    }

@app.put("/api/settings")
async def update_settings(payload: SettingUpdate, db: Session = Depends(get_db)):
    setting = db.query(Setting).first()
    if not setting:
        setting = Setting(
            active_provider=payload.active_provider or "gemini",
            active_slot=payload.active_slot or 1,
            image_provider=payload.image_provider or "local"
        )
        db.add(setting)
    else:
        if payload.active_provider is not None:
            setting.active_provider = payload.active_provider
        if payload.active_slot is not None:
            setting.active_slot = payload.active_slot
        if payload.image_provider is not None:
            setting.image_provider = payload.image_provider
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
        theme_era=project.theme_era,
        theme_mood=project.theme_mood,
        theme_custom=project.theme_custom,
        aspect_ratio=project.aspect_ratio or "16:9",
        character_attire=project.character_attire,
        scene_staging=project.scene_staging or "studio",
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
                    neg = scene_obj.get("negative_prompt") or scene_obj.get("negative_prompt_english")
                    scene = Scene(
                        project_id=new_project.id,
                        scene_number=scene_obj.get("scene_number", 1),
                        narration_khmer=scene_obj.get("narration_khmer"),
                        image_prompt_english=scene_obj.get("image_prompt_english"),
                        negative_prompt=neg,
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

@app.get("/api/projects/summary", response_model=List[ProjectSummary])
async def get_projects_summary(db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    summaries = []
    for project in projects:
        scene_count = len(project.scenes)
        scenes_with_images = sum(1 for s in project.scenes if s.image_path)
        scenes_with_audio = sum(1 for s in project.scenes if s.audio_path)
        summaries.append(
            ProjectSummary(
                id=project.id,
                title=project.title,
                slug=project.slug,
                status=project.status,
                scene_count=scene_count,
                scenes_with_images=scenes_with_images,
                scenes_with_audio=scenes_with_audio,
            )
        )
    return summaries

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

    for ext in ["wav", "mp3"]:
        master_file = os.path.join(proj_workspace_dir, f"master_voiceover.{ext}")
        if os.path.exists(master_file):
            try:
                os.remove(master_file)
            except OSError:
                pass
    
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
    sync_project_json(project.id, db)
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
                    neg = scene_obj.get("negative_prompt") or scene_obj.get("negative_prompt_english")
                    scene = Scene(
                        project_id=project_id,
                        scene_number=scene_obj.get("scene_number", 1),
                        narration_khmer=scene_obj.get("narration_khmer"),
                        image_prompt_english=scene_obj.get("image_prompt_english"),
                        negative_prompt=neg,
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


def mirror_canonical_scene_image(project_slug: str, scene_number: int, active_rel_path: Optional[str]):
    """
    Maintains a deterministic canonical file workspace/<slug>/scene_XXX.png pointing to the
    currently active variation, so downstream video editing automation tools can load scenes directly.
    """
    proj_dir = os.path.join(workspace_dir, project_slug)
    canonical_file = os.path.join(proj_dir, f"scene_{scene_number:03d}.png")
    if active_rel_path:
        src = os.path.join(workspace_dir, active_rel_path)
        if os.path.exists(src):
            try:
                shutil.copyfile(src, canonical_file)
            except Exception as e:
                print(f"Error mirroring canonical scene image: {e}")
    else:
        if os.path.exists(canonical_file):
            try:
                os.remove(canonical_file)
            except Exception:
                pass


# Scene CRUD
@app.put("/api/scenes/{scene_id}", response_model=SceneOut)
async def update_scene(scene_id: int, payload: SceneUpdate, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    update_data = payload.model_dump(exclude_unset=True)

    # Invalidate audio if narration changed and audio was completed
    if "narration_khmer" in update_data and update_data["narration_khmer"] != scene.narration_khmer:
        if scene.audio_status == "completed":
            scene.audio_status = "outdated"

    # Resolve character name if character_id changed
    if "character_id" in update_data:
        char_id = update_data["character_id"]
        if char_id is not None:
            char = db.query(Character).filter(Character.id == char_id).first()
            scene.character_id = char_id
            scene.character_name = char.name if char else None
        else:
            scene.character_id = None
            scene.character_name = None
        update_data.pop("character_id", None)
        update_data.pop("character_name", None)

    for key, value in update_data.items():
        setattr(scene, key, value)
        
    db.commit()
    db.refresh(scene)
    sync_project_json(scene.project_id, db)
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


class SceneImportItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    scene_number: Optional[int] = None
    narration_khmer: Optional[str] = None
    image_prompt_english: Optional[str] = None
    negative_prompt: Optional[str] = None
    negative_prompt_english: Optional[str] = None

class ImportScenesPayload(BaseModel):
    scenes: List[SceneImportItem]
    mode: str = "replace"  # "replace" or "append"

@app.post("/api/projects/{project_id}/import-scenes")
async def import_project_scenes(project_id: int, payload: ImportScenesPayload, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not payload.scenes:
        raise HTTPException(status_code=400, detail="No scenes provided in payload")

    if payload.mode == "replace":
        existing_scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
        for s in existing_scenes:
            if s.image_path:
                img_f = os.path.join(workspace_dir, s.image_path)
                if os.path.exists(img_f):
                    try:
                        os.remove(img_f)
                    except OSError:
                        pass
            if s.audio_path:
                aud_f = os.path.join(workspace_dir, s.audio_path)
                if os.path.exists(aud_f):
                    try:
                        os.remove(aud_f)
                    except OSError:
                        pass
        db.query(Scene).filter(Scene.project_id == project_id).delete()
        base_scene_number = 1
    elif payload.mode == "append":
        existing_scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
        max_num = max([s.scene_number for s in existing_scenes], default=0)
        base_scene_number = max_num + 1
    else:
        raise HTTPException(status_code=400, detail=f"Invalid import mode: {payload.mode}")

    for idx, item in enumerate(payload.scenes):
        neg = item.negative_prompt or item.negative_prompt_english
        scene = Scene(
            project_id=project_id,
            scene_number=base_scene_number + idx,
            narration_khmer=item.narration_khmer,
            image_prompt_english=item.image_prompt_english,
            negative_prompt=neg,
            image_status="idle",
            audio_status="idle"
        )
        db.add(scene)

    db.commit()
    db.refresh(project)
    sync_project_json(project_id, db)
    
    return {
        "status": "success",
        "imported_count": len(payload.scenes),
        "mode": payload.mode,
        "total_scenes": len(project.scenes)
    }


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
        
    sync_project_json(scene.project_id, db)

    # 5. Return structured payload to frontend components
    return {
        "status": "success",
        "scene_id": scene.id,
        "image_prompt_english": scene.image_prompt_english,
        "negative_prompt_english": scene.negative_prompt
    }


@app.post("/api/scenes/{scene_id}/flow-adjust")
async def flow_adjust_scene_endpoint(scene_id: int, payload: FlowAdjustPayload, db: Session = Depends(get_db)):
    # 1. Fetch target scene
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Target scene structure not found.")

    # 2. Extract parent project context
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Parent project context not found.")

    current_positive = scene.image_prompt_english or ""
    current_narration = scene.narration_khmer or ""
    current_negative = scene.negative_prompt or ""
    global_style = project.illustration_style or "Minimalist 2D flat vector stickman doodle illustration, bold black marker outlines, solid flat colors, seamless studio pure white background"
    video_concept = project.video_concept or ""
    theme_era = project.theme_era or ""
    scene_staging = project.scene_staging or "studio"

    # Always persist user refinement instruction
    scene.user_refinement_prompt = payload.instruction
    change_summary = f"Flow Scene Adjustment: {payload.instruction}"

    # Only mutate the base visual prompt and Khmer script if explicitly requested (e.g. Refine Text Only)
    if payload.refine_prompt_text:
        from .services.llm.orchestrators.refinement import refine_scene_prompt_and_script
        result = refine_scene_prompt_and_script(
            db=db,
            existing_prompt=current_positive,
            existing_narration=current_narration,
            existing_negative_prompt=current_negative,
            user_instruction=payload.instruction,
            global_style=global_style,
            video_concept=video_concept,
            theme_era=theme_era,
            scene_staging=scene_staging
        )
        scene.image_prompt_english = result.get("image_prompt_english", current_positive)
        scene.narration_khmer = result.get("narration_khmer", current_narration)
        scene.negative_prompt = result.get("negative_prompt_english", current_negative)
        change_summary = result.get("change_summary", "Refined prompt and narration text.")

    try:
        db.commit()
        db.refresh(scene)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database state commitment failure: {str(e)}")

    sync_project_json(scene.project_id, db)

    # 3. Resolve active reference image from clicked variant or scene active frame
    from .services.flow_engine import find_flow_asset_for_image
    ref_image_path = payload.reference_image or scene.image_path
    resolved_refs = None
    ref_asset_name = None

    if ref_image_path:
        asset_info = find_flow_asset_for_image(ref_image_path)
        if asset_info:
            ref_asset_name = asset_info.get("display_name")
        
        # Resolve to absolute local file path for flow.google.com compatibility
        if os.path.isabs(ref_image_path) and os.path.exists(ref_image_path):
            resolved_refs = [ref_image_path]
        else:
            full_ref = os.path.join(workspace_dir, ref_image_path)
            if os.path.exists(full_ref):
                resolved_refs = [full_ref]
            else:
                resolved_refs = [ref_image_path]

    # 4. Trigger immediate image generation via Flow MCP / queue
    generating = False
    if payload.generate_image:
        if ref_asset_name:
            gen_prompt = f"Using reference visual '{ref_asset_name}': {payload.instruction}. Base style: {scene.image_prompt_english}"
        else:
            gen_prompt = f"{scene.image_prompt_english}. Change: {payload.instruction}"

        task_payload = {
            "prompt": gen_prompt,
            "instruction": payload.instruction,
            "style": project.illustration_style,
            "negative_prompt": scene.negative_prompt,
            "aspect_ratio": payload.aspect_ratio or project.aspect_ratio or "16:9",
            "guidance_scale": 7.5,
            "inference_steps": 10,
            "model": payload.model or "nano2",
            "count": payload.count or 1,
            "image_provider": payload.image_provider or "flow",
            "reference_images": resolved_refs,
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
        generating = True

    return {
        "status": "success",
        "scene_id": scene.id,
        "image_prompt_english": scene.image_prompt_english,
        "narration_khmer": scene.narration_khmer,
        "negative_prompt_english": scene.negative_prompt,
        "reference_image": ref_image_path,
        "referenced_asset_name": ref_asset_name,
        "change_summary": change_summary,
        "generating": generating
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
        "aspect_ratio": payload.aspect_ratio or "16:9",
        "guidance_scale": payload.guidance_scale or 7.5,
        "inference_steps": payload.inference_steps or 10,
        "model": payload.model or "nano2",
        "count": payload.count or 1,
        "image_provider": payload.image_provider,
        "reference_images": payload.reference_images,
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

@app.post("/api/projects/{project_id}/generate-images")
async def generate_project_images(project_id: int, payload: ImageGeneratePayload, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    scenes = db.query(Scene).filter(Scene.project_id == project_id).order_by(Scene.scene_number.asc()).all()

    queued_count = 0
    for scene in scenes:
        prompt = scene.image_prompt_english or scene.narration_khmer or ""
        if not prompt.strip():
            continue

        if scene.image_status == "processing":
            continue

        refs = []
        if payload.reference_images:
            refs = payload.reference_images
        elif scene.reference_images:
            try:
                refs = json.loads(scene.reference_images)
            except Exception:
                refs = []

        task_payload = {
            "prompt": prompt,
            "style": project.illustration_style,
            "negative_prompt": scene.negative_prompt,
            "aspect_ratio": payload.aspect_ratio or project.aspect_ratio or "16:9",
            "guidance_scale": payload.guidance_scale or 7.5,
            "inference_steps": payload.inference_steps or 10,
            "model": payload.model or "nano2",
            "count": payload.count or 1,
            "image_provider": payload.image_provider,
            "reference_images": refs,
        }

        task = GenerationTask(
            task_type="image",
            project_id=scene.project_id,
            scene_id=scene.id,
            payload=task_payload
        )

        await task_queue.put(task)
        scene.image_status = "processing"
        queued_count += 1

    db.commit()
    return {"status": "queued", "count": queued_count}

@app.post("/api/projects/{project_id}/stop-images")
async def stop_project_images(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
    count = 0
    for scene in scenes:
        if scene.image_status == "processing":
            scene.image_status = "idle"
            count += 1

    db.commit()

    try:
        requests.post("http://127.0.0.1:7860/sdapi/v1/interrupt", timeout=2)
    except Exception as e:
        print(f"Interrupt API unreachable or failed: {e}")

    return {"status": "stopped", "cancelled_count": count}

@app.post("/api/scenes/{scene_id}/upload-image")
async def upload_scene_image(scene_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".png"
    if ext not in [".png", ".jpg", ".jpeg", ".webp"]:
        ext = ".png"

    ts = int(time.time())
    proj_dir = os.path.join(workspace_dir, project.slug)
    os.makedirs(proj_dir, exist_ok=True)
    filename = f"scene_{scene.scene_number:03d}_upload_{ts}{ext}"
    dest_path = os.path.join(proj_dir, filename)

    with open(dest_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    rel_path = f"{project.slug}/{filename}"

    try:
        current_images = json.loads(scene.images_list) if scene.images_list else []
    except Exception:
        current_images = []

    if rel_path not in current_images:
        current_images.append(rel_path)

    scene.images_list = json.dumps(current_images)
    scene.image_path = rel_path
    scene.image_status = "completed"

    generation = Generation(
        scene_id=scene.id,
        provider="upload",
        prompt="Manual direct file upload",
        output_paths=json.dumps([rel_path]),
        status="completed"
    )
    db.add(generation)
    db.commit()

    mirror_canonical_scene_image(project.slug, scene.scene_number, rel_path)
    sync_project_json(scene.project_id, db)

    return {
        "status": "success",
        "image_path": rel_path,
        "images_list": current_images
    }

@app.put("/api/scenes/{scene_id}/set-active-image")
async def set_active_scene_image(scene_id: int, payload: SetActiveImagePayload, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    project = db.query(Project).filter(Project.id == scene.project_id).first()

    try:
        current_images = json.loads(scene.images_list) if scene.images_list else []
    except Exception:
        current_images = []

    if payload.image_path not in current_images:
        current_images.append(payload.image_path)
        scene.images_list = json.dumps(current_images)

    scene.image_path = payload.image_path
    scene.image_status = "completed"
    db.commit()

    if project:
        mirror_canonical_scene_image(project.slug, scene.scene_number, scene.image_path)
        sync_project_json(scene.project_id, db)

    return {
        "status": "success",
        "image_path": scene.image_path,
        "images_list": current_images
    }

@app.delete("/api/scenes/{scene_id}/image-variant")
async def delete_scene_image_variant(scene_id: int, image_path: str, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    project = db.query(Project).filter(Project.id == scene.project_id).first()

    full_path = os.path.join(workspace_dir, image_path)
    if os.path.exists(full_path):
        try:
            os.remove(full_path)
        except OSError as e:
            print(f"Error removing variant file {full_path}: {e}")

    try:
        current_images = json.loads(scene.images_list) if scene.images_list else []
    except Exception:
        current_images = []

    if image_path in current_images:
        current_images.remove(image_path)
    scene.images_list = json.dumps(current_images)

    if scene.image_path == image_path:
        scene.image_path = current_images[0] if len(current_images) > 0 else None
        if not scene.image_path:
            scene.image_status = "idle"

    db.commit()

    if project:
        mirror_canonical_scene_image(project.slug, scene.scene_number, scene.image_path)
        sync_project_json(scene.project_id, db)

    return {
        "status": "success",
        "image_path": scene.image_path,
        "images_list": current_images
    }

@app.post("/api/scenes/{scene_id}/reference-image")
async def add_scene_reference_image(
    scene_id: int,
    file: Optional[UploadFile] = File(None),
    reference_path: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    project = db.query(Project).filter(Project.id == scene.project_id).first()

    try:
        current_refs = json.loads(scene.reference_images) if scene.reference_images else []
    except Exception:
        current_refs = []

    if file:
        ts = int(time.time())
        ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".png"
        proj_dir = os.path.join(workspace_dir, project.slug)
        os.makedirs(proj_dir, exist_ok=True)
        filename = f"scene_{scene.scene_number:03d}_ref_{ts}{ext}"
        dest_path = os.path.join(proj_dir, filename)
        with open(dest_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        rel_path = f"{project.slug}/{filename}"
        if rel_path not in current_refs:
            current_refs.append(rel_path)
    elif reference_path:
        if reference_path not in current_refs:
            current_refs.append(reference_path)
    else:
        raise HTTPException(status_code=400, detail="Must provide either file or reference_path")

    scene.reference_images = json.dumps(current_refs)
    db.commit()
    return {"status": "success", "reference_images": current_refs}

@app.delete("/api/scenes/{scene_id}/reference-image")
async def remove_scene_reference_image(scene_id: int, reference: str, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    try:
        current_refs = json.loads(scene.reference_images) if scene.reference_images else []
    except Exception:
        current_refs = []

    if reference in current_refs:
        current_refs.remove(reference)

    scene.reference_images = json.dumps(current_refs)
    db.commit()
    return {"status": "success", "reference_images": current_refs}

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
    scene.images_list = "[]"
    scene.image_status = "idle"
    db.commit()
    
    return {"status": "success"}

@app.delete("/api/scenes/{scene_id}/audio")
async def delete_scene_audio(scene_id: int, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    
    if scene.audio_path:
        full_path = os.path.join(workspace_dir, scene.audio_path)
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
            except OSError as e:
                print(f"Error removing audio file {full_path}: {e}")
            
    scene.audio_path = None
    scene.audio_status = "idle"
    
    # Also invalidate master voiceover since a scene was removed
    if project and project.master_audio_path:
        full_master = os.path.join(workspace_dir, project.master_audio_path)
        if os.path.exists(full_master):
            try:
                os.remove(full_master)
            except OSError:
                pass
        project.master_audio_path = None
        
    db.commit()
    if project:
        sync_project_json(project.id, db)
    
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
    
    target_char_id = character_id if character_id is not None else scene.character_id
    task_payload = {"text": scene.narration_khmer}
    if target_char_id is not None:
        task_payload["character_id"] = target_char_id
        
    task = GenerationTask(
        task_type="audio_single" if target_char_id else "audio",
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

@app.post("/api/characters/preview-clone")
async def create_clone_preview(
    reference_text: str = Form(...),
    text_to_speak: str = Form("កាលពី ១ម៉ឺនឆ្នាំមុន មនុស្សសម័យបុរេប្រវត្តិ បានរកឃើញអាថ៌កំបាំងមួយយ៉ាងអស្ចារ្យ។"),
    audio_file: UploadFile = File(...)
):
    from .services.voice_engine import generate_clone_preview
    from .database import CUSTOM_VOICES_DIR
    
    print(f"DEBUG: audio_file.filename = {audio_file.filename}, audio_file.size = {getattr(audio_file, 'size', 'unknown')}")
    
    temp_upload_path = os.path.join(CUSTOM_VOICES_DIR, "temp_clone_upload.wav")
    await audio_file.seek(0)
    content = await audio_file.read()
    
    print(f"DEBUG: len(content) = {len(content)}")
    
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded audio file is empty (0 bytes). Please select a valid audio file.")
    
    with open(temp_upload_path, "wb") as buffer:
        buffer.write(content)
        
    path = generate_clone_preview(temp_upload_path, reference_text, text_to_speak)
    return {"status": "success", "audio_path": path}

@app.delete("/api/characters/preview-clone")
async def delete_clone_preview():
    from .database import CUSTOM_VOICES_DIR
    temp_preview_path = os.path.join(CUSTOM_VOICES_DIR, "temp_clone_preview.wav")
    temp_upload_path = os.path.join(CUSTOM_VOICES_DIR, "temp_clone_upload.wav")
    if os.path.exists(temp_preview_path):
        os.remove(temp_preview_path)
    if os.path.exists(temp_upload_path):
        os.remove(temp_upload_path)
    return {"status": "success", "message": "Clone preview deleted"}

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
        from .database import CUSTOM_VOICES_DIR
        file_extension = os.path.splitext(audio_file.filename)[1] or '.wav'
        filename = f"{slug_name}{file_extension}"
        save_path = os.path.join(CUSTOM_VOICES_DIR, filename)
        
        await audio_file.seek(0)
        content = await audio_file.read()
        
        if not content:
            raise HTTPException(status_code=400, detail="The uploaded audio file is empty (0 bytes). Please select a valid audio file.")
            
        with open(save_path, "wb") as buffer:
            buffer.write(content)
            
        rel_audio_path = os.path.join("custom_voices", filename).replace("\\", "/")
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

@app.post("/api/projects/{project_id}/assign-character")
async def assign_project_character(project_id: int, character_id: Optional[int] = None, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    char_name = None
    if character_id is not None:
        char = db.query(Character).filter(Character.id == character_id).first()
        if not char:
            raise HTTPException(status_code=404, detail="Character not found")
        char_name = char.name

    for scene in project.scenes:
        scene.character_id = character_id
        scene.character_name = char_name

    db.commit()
    sync_project_json(project.id, db)
    return {"status": "success", "character_id": character_id, "character_name": char_name}

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
            target_char_id = character_id or scene.character_id
            if target_char_id:
                payload["character_id"] = target_char_id
                
            task = GenerationTask(
                task_type="audio_single" if target_char_id else "audio",
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

# ----------------------------------------------------
# Tab 4: Assembly & Video Synthesis Endpoints
# ----------------------------------------------------

@app.get("/api/projects/{project_id}/assembly-status")
async def get_assembly_status(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    status_data = render_engine.get_project_coupling_status(project, db)
    return status_data

@app.put("/api/projects/{project_id}/timeline")
async def save_project_timeline(project_id: int, payload: dict, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.timeline_data = json.dumps(payload)
    db.commit()
    return {"status": "saved", "timeline_data": payload}

@app.post("/api/projects/{project_id}/upload-bgm")
async def upload_project_bgm(project_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    slug = project.slug or f"project-{project.id}"
    bgm_dir = os.path.join(render_engine.WORKSPACE_DIR, slug, "bgm")
    os.makedirs(bgm_dir, exist_ok=True)

    # Sanitize filename
    safe_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', file.filename)
    target_path = os.path.join(bgm_dir, safe_name)

    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    dur = render_engine.get_audio_duration(target_path)
    file_info = {
        "filename": safe_name,
        "relative_path": f"{slug}/bgm/{safe_name}",
        "duration": round(dur, 2),
        "size_bytes": os.path.getsize(target_path)
    }

    return {"status": "uploaded", "file": file_info}

@app.delete("/api/projects/{project_id}/bgm/{filename}")
async def delete_project_bgm(project_id: int, filename: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    slug = project.slug or f"project-{project.id}"
    target_path = os.path.join(render_engine.WORKSPACE_DIR, slug, "bgm", filename)
    if os.path.exists(target_path):
        try:
            os.remove(target_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

    return {"status": "deleted", "filename": filename}

@app.post("/api/projects/{project_id}/render-video")
async def trigger_video_render(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Check if already rendering
    job = render_engine.RENDER_JOBS.get(project_id)
    if job and job.get("status") == "rendering":
        return {"status": "already_rendering", "job": job}

    async def _async_render_worker():
        from .database import SessionLocal
        bg_db = SessionLocal()
        try:
            await render_engine.render_project_video(project_id, bg_db)
        except Exception as err:
            print(f"[RENDER TASK EXCEPTION] {err}")
        finally:
            bg_db.close()

    asyncio.create_task(_async_render_worker())
    return {"status": "started", "message": "Video rendering started in background"}

@app.get("/api/projects/{project_id}/render-status")
async def get_video_render_status(project_id: int):
    job = render_engine.RENDER_JOBS.get(project_id, {
        "status": "idle",
        "progress": 0,
        "output_path": None,
        "error": None
    })
    return job

@app.delete("/api/projects/{project_id}/render")
async def delete_project_render(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    slug = project.slug or f"project-{project.id}"
    video_path = os.path.join(render_engine.WORKSPACE_DIR, slug, "final_output.mp4")
    if os.path.exists(video_path):
        try:
            os.remove(video_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete video: {str(e)}")
            
    render_engine.RENDER_JOBS[project_id] = {
        "status": "idle",
        "progress": 0,
        "output_path": None,
        "error": None
    }
    return {"status": "deleted"}


