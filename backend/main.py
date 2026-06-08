import os
import re
import asyncio
from contextlib import asynccontextmanager
from typing import List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import get_db, Project, Scene
from .queue_worker import start_queue_worker, task_queue, GenerationTask
from .services import gemini, voice_engine

# Pydantic Schemas
class ProjectCreate(BaseModel):
    topic: str

class ProjectUpdate(BaseModel):
    topic: Optional[str] = None
    research: Optional[str] = None
    script: Optional[str] = None
    video_concept: Optional[str] = None
    image_style: Optional[str] = None
    voice_style: Optional[str] = None

class SceneRefine(BaseModel):
    user_instruction: str

# Background worker task reference
worker_task = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup event: Spin up asyncio background queue worker smoothly
    global worker_task
    worker_task = asyncio.create_task(start_queue_worker())
    yield
    # Shutdown event
    if worker_task:
        worker_task.cancel()
        try:
            await worker_task
        except asyncio.CancelledError:
            print("Queue worker gracefully shut down.")

app = FastAPI(lifespan=lifespan)

# CORS configuration targeting Next.js frontend
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


# Global Sidebar & Project Setup
@app.get("/api/projects")
async def get_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).all()
    return [{"id": p.id, "name": p.name, "topic": p.topic, "status": p.status} for p in projects]

@app.post("/api/projects")
async def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    slug = re.sub(r'[^a-z0-9]+', '-', payload.topic.lower()).strip('-')
    
    # Check if exists
    existing = db.query(Project).filter(Project.name == slug).first()
    if existing:
        raise HTTPException(status_code=400, detail="Project with this name already exists")
        
    project = Project(name=slug, topic=payload.topic, status="draft")
    db.add(project)
    db.commit()
    db.refresh(project)
    
    # Create workspace directory
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace", slug))
    os.makedirs(workspace_dir, exist_ok=True)
    
    return {"id": project.id, "name": project.name, "slug": slug}


# Tab 1: Overview Dashboard Endpoints
@app.get("/api/projects/{project_id}")
async def get_project_details(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    scenes = db.query(Scene).filter(Scene.project_id == project_id).order_by(Scene.scene_number).all()
    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "topic": project.topic,
            "research": project.research,
            "script": project.script,
            "video_concept": project.video_concept,
            "image_style": project.image_style,
            "voice_style": project.voice_style,
            "status": project.status
        },
        "scenes": scenes
    }

@app.put("/api/projects/{project_id}")
async def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)
        
    db.commit()
    db.refresh(project)
    return {"status": "success", "project_id": project.id}

@app.post("/api/projects/{project_id}/parse")
async def parse_project_scenes(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    # Trigger Gemini script breaker service
    try:
        scenes_data = gemini.generate_initial_scenes(
            research=project.research or "",
            script=project.script or "",
            video_concept=project.video_concept or "",
            image_style=project.image_style or ""
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    # Delete existing scenes
    db.query(Scene).filter(Scene.project_id == project_id).delete()
    
    # Populate new scenes
    new_scenes = []
    for scene_item in scenes_data:
        scene = Scene(
            project_id=project.id,
            scene_number=scene_item.get("scene_number"),
            narration_khmer=scene_item.get("narration_khmer"),
            image_prompt_english=scene_item.get("image_prompt_english")
        )
        db.add(scene)
        new_scenes.append(scene)
        
    db.commit()
    return {"status": "success", "scenes_created": len(new_scenes)}


# Tab 2: Image Card Management Endpoints
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
            style=project.image_style or ""
        )
        scene.user_refinement_prompt = payload.user_instruction
        scene.image_prompt_english = refined_prompt
        db.commit()
        db.refresh(scene)
        return {"status": "success", "refined_prompt": refined_prompt}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/scenes/{scene_id}/generate-image")
async def generate_scene_image(scene_id: int, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    task = GenerationTask(
        task_type="image",
        project_id=scene.project_id,
        scene_id=scene.id,
        payload={"prompt": scene.image_prompt_english}
    )
    
    # Queue task
    await task_queue.put(task)
    
    scene.image_status = "pending"
    db.commit()
    return {"status": "queued"}

@app.delete("/api/scenes/{scene_id}/image")
async def delete_scene_image(scene_id: int, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    # Discard logic
    if scene.image_path and os.path.exists(scene.image_path):
        try:
            os.remove(scene.image_path)
        except OSError as e:
            print(f"Error removing file {scene.image_path}: {e}")
            
    scene.image_path = None
    scene.image_status = "pending"
    db.commit()
    
    return {"status": "success"}


# Tab 3 & 4: Voice and Output Resource Routing
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
            scene.audio_status = "pending"
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
