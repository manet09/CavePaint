import os
import re
import json
import asyncio
import requests
from contextlib import asynccontextmanager
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import shutil

from .database import get_db, Project, Scene
from .queue_worker import start_queue_worker, task_queue, GenerationTask
from .services import gemini, voice_engine

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

    model_config = ConfigDict(from_attributes=True)

class ProjectBase(BaseModel):
    title: str
    raw_research: Optional[str] = None
    script_narrative: Optional[str] = None
    video_concept: Optional[str] = None
    illustration_style: Optional[str] = None
    global_voice_style: Optional[str] = None
    structured_json_data: Optional[str] = None
    status: Optional[str] = "draft"

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
                
    if modified:
        db.commit()
        db.refresh(project)
        
    # Eagerly loaded implicitly by SQLAlchemy relationship
    project.scenes.sort(key=lambda x: x.scene_number)
    return project

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

@app.post("/api/projects/{project_id}/parse")
async def parse_project_scenes(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    try:
        scenes_data = gemini.generate_initial_scenes(
            research=project.raw_research or "",
            script=project.script_narrative or "",
            video_concept=project.video_concept or "",
            image_style=project.illustration_style or ""
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


@app.post("/api/scenes/{scene_id}/refine")
async def refine_scene_image_prompt(scene_id: int, payload: SceneRefine, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    project = db.query(Project).filter(Project.id == scene.project_id).first()
    
    try:
        refined_prompt = gemini.refine_image_prompt(
            existing_prompt=scene.image_prompt_english or "",
            user_instruction=payload.user_instruction,
            style=project.illustration_style or ""
        )
        scene.user_refinement_prompt = payload.user_instruction
        scene.image_prompt_english = refined_prompt
        db.commit()
        db.refresh(scene)
        return {"status": "success", "refined_prompt": refined_prompt}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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


# Tab 3 & 4 routes
@app.post("/api/projects/{project_id}/generate-voice")
async def generate_project_voice(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
    
    queued_count = 0
    for scene in scenes:
        if scene.narration_khmer:
            task = GenerationTask(
                task_type="audio",
                project_id=project.id,
                scene_id=scene.id,
                payload={"text": scene.narration_khmer}
            )
            await task_queue.put(task)
            scene.audio_status = "processing"
            queued_count += 1
            
    db.commit()
    return {"status": "queued", "count": queued_count}

@app.post("/api/model/load")
async def load_voice_model():
    success = voice_engine.load_model()
    return {"status": "success" if success else "failed"}

@app.post("/api/model/unload")
async def unload_voice_model():
    success = voice_engine.unload_model()
    return {"status": "success" if success else "failed"}
