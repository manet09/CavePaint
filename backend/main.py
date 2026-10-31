import os
import re
import json
import asyncio
import requests
import dotenv
import time
import uuid
import unicodedata
from contextlib import asynccontextmanager
from typing import List, Optional

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
ROOT_DIR = os.path.abspath(os.path.join(BASE_DIR, ".."))
dotenv.load_dotenv(dotenv_path=os.path.join(ROOT_DIR, ".env"))
dotenv.load_dotenv(dotenv_path=os.path.join(ROOT_DIR, ".env.local"), override=True)

workspace_dir = os.path.abspath(os.path.join(ROOT_DIR, "workspace"))
os.makedirs(workspace_dir, exist_ok=True)

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
    audio_text: Optional[str] = None
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
    audio_text: Optional[str] = None

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
    is_pinned: bool = False
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
    theme_region: Optional[str] = "cambodia"
    scene_staging: Optional[str] = "studio"
    flow_project_id: Optional[str] = None
    timeline_data: Optional[str] = None

class ProjectCreate(BaseModel):
    title: Optional[str] = None

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    is_pinned: Optional[bool] = None
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
    theme_region: Optional[str] = None
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
    is_pinned: bool = False
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
    target_image: Optional[str] = None
    reference_images: Optional[List[str]] = None
    reference_image: Optional[str] = None  # Backwards compatibility
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
    target_image: Optional[str] = None
    reference_images: Optional[List[str]] = None

class SetActiveImagePayload(BaseModel):
    image_path: str


def generate_project_slug(title: str, db: Session, current_project_id: Optional[int] = None, current_slug: Optional[str] = None) -> str:
    normalized = unicodedata.normalize('NFKD', title or '').encode('ascii', 'ignore').decode('ascii')
    base_slug = re.sub(r'[^a-z0-9]+', '-', normalized.lower()).strip('-')
    if not base_slug:
        base_slug = f"project-{current_project_id}" if current_project_id else "project"

    slug = base_slug
    counter = 2
    while True:
        db_collision = db.query(Project).filter(Project.slug == slug, Project.id != current_project_id).first() is not None
        fs_collision = (slug != current_slug) and os.path.exists(os.path.join(workspace_dir, slug))
        if not db_collision and not fs_collision:
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1


def rename_project_workspace_and_paths(project: Project, new_slug: str, db: Session):
    old_slug = project.slug
    if not old_slug or old_slug == new_slug:
        project.slug = new_slug
        return

    old_dir = os.path.join(workspace_dir, old_slug)
    new_dir = os.path.join(workspace_dir, new_slug)

    # 1. Rename workspace folder on disk
    if os.path.exists(old_dir):
        if os.path.exists(new_dir) and old_dir != new_dir:
            raise HTTPException(
                status_code=409,
                detail=f"Target workspace folder '{new_slug}' already exists."
            )
        try:
            shutil.move(old_dir, new_dir)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to rename workspace folder from '{old_slug}' to '{new_slug}': {str(e)}"
            )
    else:
        os.makedirs(new_dir, exist_ok=True)

    # 2. Update Project fields
    project.slug = new_slug

    if project.master_audio_path and project.master_audio_path.startswith(f"{old_slug}/"):
        project.master_audio_path = f"{new_slug}/" + project.master_audio_path[len(f"{old_slug}/"):]

    if project.timeline_data:
        try:
            project.timeline_data = project.timeline_data.replace(f'"{old_slug}/', f'"{new_slug}/')
        except Exception as e:
            print(f"Warning: Failed to update timeline_data paths: {e}")

    # 3. Update Scenes and Generations
    scenes = db.query(Scene).filter(Scene.project_id == project.id).all()
    scene_ids = [s.id for s in scenes]

    for scene in scenes:
        if scene.image_path and scene.image_path.startswith(f"{old_slug}/"):
            scene.image_path = f"{new_slug}/" + scene.image_path[len(f"{old_slug}/"):]

        if scene.audio_path and scene.audio_path.startswith(f"{old_slug}/"):
            scene.audio_path = f"{new_slug}/" + scene.audio_path[len(f"{old_slug}/"):]

        if scene.images_list:
            try:
                imgs = json.loads(scene.images_list)
                if isinstance(imgs, list):
                    updated_imgs = [
                        (f"{new_slug}/" + p[len(f"{old_slug}/"):]) if isinstance(p, str) and p.startswith(f"{old_slug}/") else p
                        for p in imgs
                    ]
                    scene.images_list = json.dumps(updated_imgs)
            except Exception:
                pass

        if scene.reference_images:
            try:
                refs = json.loads(scene.reference_images)
                if isinstance(refs, list):
                    updated_refs = [
                        (f"{new_slug}/" + p[len(f"{old_slug}/"):]) if isinstance(p, str) and p.startswith(f"{old_slug}/") else p
                        for p in refs
                    ]
                    scene.reference_images = json.dumps(updated_refs)
            except Exception:
                pass

    if scene_ids:
        generations = db.query(Generation).filter(Generation.scene_id.in_(scene_ids)).all()
        for gen in generations:
            if gen.output_paths:
                try:
                    out_paths = json.loads(gen.output_paths)
                    if isinstance(out_paths, list):
                        updated_paths = [
                            (f"{new_slug}/" + p[len(f"{old_slug}/"):]) if isinstance(p, str) and p.startswith(f"{old_slug}/") else p
                            for p in out_paths
                        ]
                        gen.output_paths = json.dumps(updated_paths)
                except Exception:
                    pass
            if gen.reference_media_ids:
                try:
                    ref_ids = json.loads(gen.reference_media_ids)
                    if isinstance(ref_ids, list):
                        updated_ref_ids = [
                            (f"{new_slug}/" + p[len(f"{old_slug}/"):]) if isinstance(p, str) and p.startswith(f"{old_slug}/") else p
                            for p in ref_ids
                        ]
                        gen.reference_media_ids = json.dumps(updated_ref_ids)
                except Exception:
                    pass

    sync_project_json(project.id, db)


# Background worker task reference
worker_task = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global worker_task
    from .services import voice_engine
    from .database import SessionLocal, Scene, Project
    
    # Auto-heal orphaned processing states from previous server crashes/restarts
    try:
        cleanup_db = SessionLocal()
        orphaned = cleanup_db.query(Scene).filter(Scene.audio_status == "processing").all()
        if orphaned:
            print(f"[STARTUP] Found {len(orphaned)} orphaned audio processing scene(s). Recovering states...")
            for s in orphaned:
                if s.audio_path:
                    s.audio_status = "completed"
                else:
                    s.audio_status = "idle"
            cleanup_db.commit()
        cleanup_db.close()
    except Exception as cleanup_err:
        print(f"[STARTUP] Failed to cleanup orphaned scene statuses: {cleanup_err}")

    # Auto-heal desynchronized project folder names and slugs
    try:
        heal_db = SessionLocal()
        projects_to_heal = heal_db.query(Project).all()
        for p in projects_to_heal:
            if p.title and p.title.strip().lower() != "untitled" and p.slug and p.slug.startswith("untitled"):
                target_slug = generate_project_slug(p.title, heal_db, current_project_id=p.id, current_slug=p.slug)
                if target_slug != p.slug:
                    print(f"[STARTUP] Healing project folder '{p.slug}' -> '{target_slug}' for project '{p.title}'...")
                    rename_project_workspace_and_paths(p, target_slug, heal_db)
                    heal_db.commit()
        heal_db.close()
    except Exception as heal_err:
        print(f"[STARTUP] Failed to heal project folders: {heal_err}")

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

@app.get("/api/debug-queue")
async def debug_queue():
    global worker_task, task_queue
    exc = None
    if worker_task and worker_task.done() and not worker_task.cancelled():
        try:
            exc = str(worker_task.exception())
        except Exception as e:
            exc = str(e)
            
    stack = []
    if worker_task:
        for f in worker_task.get_stack():
            stack.append(f"{f.f_code.co_filename}:{f.f_lineno} in {f.f_code.co_name}")
            
    items = []
    if task_queue:
        for t in list(task_queue._queue)[:5]:
            items.append({
                "type": t.task_type,
                "scene_id": t.scene_id,
                "project_id": t.project_id,
                "payload": t.payload
            })
            
    return {
        "worker_task_exists": worker_task is not None,
        "worker_task_done": worker_task.done() if worker_task else None,
        "worker_task_cancelled": worker_task.cancelled() if worker_task else None,
        "worker_task_exception": exc,
        "coroutine_stack": stack,
        "queue_size": task_queue.qsize() if task_queue else None,
        "next_tasks": items
    }

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
    title = payload.title.strip() if payload.title and payload.title.strip() else "Untitled"
    slug = generate_project_slug(title, db)
        
    project = Project(
        title=title,
        slug=slug,
        status="draft"
    )
    db.add(project)
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
    slug = generate_project_slug(new_title, db)

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
        theme_region=getattr(project, "theme_region", "cambodia") or "cambodia",
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

    if project.scenes:
        for s in project.scenes:
            neg = s.negative_prompt
            scene = Scene(
                project_id=new_project.id,
                scene_number=s.scene_number,
                narration_khmer=s.narration_khmer,
                image_prompt_english=s.image_prompt_english,
                negative_prompt=neg,
                image_status="idle",
                audio_status="idle",
                user_refinement_prompt=s.user_refinement_prompt,
                character_id=s.character_id,
                character_name=s.character_name,
            )
            db.add(scene)
    elif new_project.structured_json_data:
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
        except json.JSONDecodeError:
            pass

    db.commit()
    db.refresh(new_project)
    sync_project_json(new_project.id, db)

    proj_workspace_dir = os.path.join(workspace_dir, slug)
    os.makedirs(proj_workspace_dir, exist_ok=True)

    return new_project

@app.get("/api/projects", response_model=List[ProjectOutList])
async def get_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.is_pinned.desc(), Project.id.desc()).all()
    return projects

@app.get("/api/projects/summary", response_model=List[ProjectSummary])
async def get_projects_summary(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.is_pinned.desc(), Project.id.desc()).all()
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
                is_pinned=project.is_pinned,
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

    if "title" in update_data and update_data["title"] is not None:
        new_title = update_data["title"].strip()
        if new_title:
            new_slug = generate_project_slug(new_title, db, current_project_id=project.id, current_slug=project.slug)
            if new_slug != project.slug:
                rename_project_workspace_and_paths(project, new_slug, db)
            project.title = new_title
        del update_data["title"]

    if "slug" in update_data and update_data["slug"] is not None:
        custom_slug = update_data["slug"].strip()
        if custom_slug and custom_slug != project.slug:
            validated_slug = generate_project_slug(custom_slug, db, current_project_id=project.id, current_slug=project.slug)
            rename_project_workspace_and_paths(project, validated_slug, db)
        del update_data["slug"]
    
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

    # Invalidate audio if narration changed or character changed and audio exists
    if "narration_khmer" in update_data:
        new_text = (update_data["narration_khmer"] or "").strip()
        orig_text = (scene.audio_text or scene.narration_khmer or "").strip()
        if new_text != orig_text:
            if scene.audio_status == "completed" or scene.audio_path:
                scene.audio_status = "outdated"
        elif scene.audio_text and new_text == (scene.audio_text or "").strip() and scene.audio_path:
            # If user restored text back to match audio, restore status to completed
            scene.audio_status = "completed"

    # Resolve character name if character_id changed
    if "character_id" in update_data:
        char_id = update_data["character_id"]
        if char_id != scene.character_id:
            if scene.audio_status == "completed" or scene.audio_path:
                scene.audio_status = "outdated"
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
    split_mode: Optional[str] = "enter"

@app.post("/api/projects/{project_id}/segment-script")
async def segment_project_script(project_id: int, payload: ScriptSegmentPayload, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    long_script = payload.long_script or ""
    split_mode = payload.split_mode or "enter"
    clean_script = re.sub(r"\(.*?\)", "", long_script)
    
    if split_mode == "enter":
        raw_lines = [l.strip() for l in clean_script.split("\n") if l.strip()]
        chunks = []
        for line in raw_lines:
            trimmed = re.sub(r"[\s\u200B\uFEFF]+$", "", line).strip()
            if not trimmed:
                continue
            if trimmed.endswith("។") or trimmed.endswith("៕"):
                chunks.append(trimmed)
            else:
                chunks.append(f"{trimmed}។")
    else:
        # Split strictly by Khmer full stop ។ or ៕
        raw_chunks = [re.sub(r"\n+", " ", c).strip() for c in re.split(r"[។៕]+", clean_script) if c.strip()]
        chunks = []
        for c in raw_chunks:
            trimmed = re.sub(r"[\s\u200B\uFEFF]+$", "", c).strip()
            if not trimmed:
                continue
            if trimmed.endswith("។") or trimmed.endswith("៕"):
                chunks.append(trimmed)
            else:
                chunks.append(f"{trimmed}។")
    
    scenes = db.query(Scene).filter(Scene.project_id == project_id).order_by(Scene.scene_number).all()
    
    for i, chunk in enumerate(chunks):
        if i < len(scenes):
            if (scenes[i].narration_khmer or "").strip() != chunk.strip():
                scenes[i].narration_khmer = chunk
                if scenes[i].audio_status == "completed" or scenes[i].audio_path:
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
        if not payload.scenes:
            raise HTTPException(status_code=400, detail="No scenes provided in payload")
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


class ReorderScenesPayload(BaseModel):
    scene_ids: List[int]

@app.put("/api/projects/{project_id}/reorder-scenes", response_model=ProjectOut)
async def reorder_project_scenes(project_id: int, payload: ReorderScenesPayload, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    existing_scenes = db.query(Scene).filter(Scene.project_id == project_id).all()
    scene_map = {s.id: s for s in existing_scenes}

    # Validate that IDs belong to project
    for sid in payload.scene_ids:
        if sid not in scene_map:
            raise HTTPException(status_code=400, detail=f"Scene ID {sid} does not belong to project {project_id}")

    # Build the reordered list
    ordered_scenes = [scene_map[sid] for sid in payload.scene_ids]
    # Append any scenes that were not in payload (just in case)
    for s in existing_scenes:
        if s not in ordered_scenes:
            ordered_scenes.append(s)

    slug = project.slug or f"project-{project.id}"
    project_dir = os.path.join(workspace_dir, slug)
    os.makedirs(project_dir, exist_ok=True)
    audio_fmt = project.audio_format or "wav"
    ext = "mp3" if audio_fmt.lower() == "mp3" else "wav"

    # --- Two-Phase File Re-indexing for Audio & Images ---
    # Phase 1: Move existing scene files to temporary unique files to avoid collisions during swapping
    temp_audio_map = {}  # scene_id -> temp_filepath
    temp_img_map = {}    # scene_id -> temp_filepath

    for scene in ordered_scenes:
        old_num = scene.scene_number
        if old_num is None:
            continue
        # 1. Audio staging
        canonical_aud = os.path.join(project_dir, f"scene_{old_num:03d}.{ext}")
        aud_src = None
        if os.path.exists(canonical_aud):
            aud_src = canonical_aud
        elif scene.audio_path:
            full_audio_path = os.path.join(workspace_dir, scene.audio_path)
            if os.path.exists(full_audio_path):
                aud_src = full_audio_path

        if aud_src and os.path.exists(aud_src):
            tmp_aud_name = f"_tmp_reorder_{uuid.uuid4().hex[:8]}_{scene.id}.{ext}"
            tmp_aud_path = os.path.join(project_dir, tmp_aud_name)
            try:
                shutil.move(aud_src, tmp_aud_path)
                temp_audio_map[scene.id] = tmp_aud_path
            except Exception as e:
                print(f"Error staging audio for scene {scene.id}: {e}")

        # 2. Canonical Image staging
        canonical_img = os.path.join(project_dir, f"scene_{old_num:03d}.png")
        if os.path.exists(canonical_img):
            tmp_img_name = f"_tmp_reorder_{uuid.uuid4().hex[:8]}_{scene.id}.png"
            tmp_img_path = os.path.join(project_dir, tmp_img_name)
            try:
                shutil.move(canonical_img, tmp_img_path)
                temp_img_map[scene.id] = tmp_img_path
            except Exception as e:
                print(f"Error staging canonical image for scene {scene.id}: {e}")

    # Phase 2: Place files into their new sequence numbers (1-indexed)
    timeline_dict = {}
    if project.timeline_data:
        try:
            timeline_dict = json.loads(project.timeline_data)
        except Exception:
            timeline_dict = {}
    old_volumes = timeline_dict.get("scene_volumes", {})
    new_volumes = {}

    for new_idx, scene in enumerate(ordered_scenes):
        new_num = new_idx + 1
        old_num = scene.scene_number
        scene.scene_number = new_num

        # Remap volume
        if old_num is not None and str(old_num) in old_volumes:
            new_volumes[str(new_num)] = old_volumes[str(old_num)]

        # Place Audio
        new_canonical_aud = os.path.join(project_dir, f"scene_{new_num:03d}.{ext}")
        if scene.id in temp_audio_map:
            tmp_aud_path = temp_audio_map[scene.id]
            try:
                shutil.move(tmp_aud_path, new_canonical_aud)
                scene.audio_path = f"{slug}/scene_{new_num:03d}.{ext}"
            except Exception as e:
                print(f"Error moving audio to canonical path for scene {scene.id}: {e}")
        else:
            scene.audio_path = None
            if scene.audio_status == "completed":
                scene.audio_status = "idle"

        # Place Image
        new_canonical_img = os.path.join(project_dir, f"scene_{new_num:03d}.png")
        if scene.image_path:
            old_canonical_rel = f"{slug}/scene_{old_num:03d}.png" if old_num is not None else None
            # If image_path was previously pointing to canonical scene_{old_num}.png
            if old_canonical_rel and scene.image_path == old_canonical_rel and scene.id in temp_img_map:
                tmp_img_path = temp_img_map[scene.id]
                try:
                    shutil.move(tmp_img_path, new_canonical_img)
                    scene.image_path = f"{slug}/scene_{new_num:03d}.png"
                except Exception as e:
                    print(f"Error moving image to canonical path for scene {scene.id}: {e}")
            else:
                # Active image is a variant or external file
                src_img = os.path.join(workspace_dir, scene.image_path)
                if os.path.exists(src_img):
                    try:
                        shutil.copyfile(src_img, new_canonical_img)
                    except Exception as e:
                        print(f"Error copying variant to canonical image: {e}")
                elif scene.id in temp_img_map:
                    # Fallback to previously mirrored image
                    tmp_img_path = temp_img_map[scene.id]
                    try:
                        shutil.move(tmp_img_path, new_canonical_img)
                        scene.image_path = f"{slug}/scene_{new_num:03d}.png"
                    except Exception as e:
                        print(f"Error fallback moving image: {e}")
        elif scene.id in temp_img_map:
            # Had a canonical image without explicit image_path
            tmp_img_path = temp_img_map[scene.id]
            try:
                shutil.move(tmp_img_path, new_canonical_img)
                scene.image_path = f"{slug}/scene_{new_num:03d}.png"
            except Exception as e:
                print(f"Error moving canonical image: {e}")
        else:
            scene.image_path = None
            if os.path.exists(new_canonical_img):
                try:
                    os.remove(new_canonical_img)
                except Exception:
                    pass

    # Clean up any leftover temp files
    for p in list(temp_audio_map.values()) + list(temp_img_map.values()):
        if os.path.exists(p):
            try:
                os.remove(p)
            except Exception:
                pass

    # Save new timeline volumes
    if "scene_volumes" in timeline_dict or new_volumes:
        timeline_dict["scene_volumes"] = new_volumes
        project.timeline_data = json.dumps(timeline_dict)

    db.commit()
    db.refresh(project)

    # Re-compile master voiceover with the new sequence
    try:
        from .services.voice_engine import compile_master_voiceover
        compile_master_voiceover(project.id, db)
    except Exception as e:
        print(f"Error recompiling master voiceover after reorder: {e}")

    # Synchronize structured JSON data
    sync_project_json(project.id, db)
    db.refresh(project)

    project.scenes.sort(key=lambda x: x.scene_number)
    return project


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
    theme_region = project.theme_region or "cambodia"
    scene_staging = project.scene_staging or "studio"

    # Always persist user refinement instruction
    scene.user_refinement_prompt = payload.instruction
    change_summary = f"Flow Scene Adjustment: {payload.instruction}"

    # Only mutate the base visual prompt and Khmer script if explicitly requested (e.g. Refine Text Only)
    from .services.flow_engine import find_flow_asset_for_image

    # Resolve target image (0 or 1): base image to modify
    target_image_path = None
    if payload.target_image is not None:
        target_image_path = payload.target_image.strip() if payload.target_image else None
    elif payload.reference_image is not None:
        target_image_path = payload.reference_image.strip() if payload.reference_image else None
    else:
        # Default target fallback to active scene image if nothing specified
        target_image_path = scene.image_path

    resolved_target = None
    target_asset_info = None
    target_info = None
    if target_image_path:
        target_asset_info = find_flow_asset_for_image(target_image_path)
        if os.path.isabs(target_image_path) and os.path.exists(target_image_path):
            resolved_target = target_image_path
        else:
            full_target = os.path.join(workspace_dir, target_image_path)
            resolved_target = full_target if os.path.exists(full_target) else target_image_path
        target_label = target_asset_info.get("display_name") if target_asset_info else os.path.basename(target_image_path)
        target_info = {
            "path": resolved_target,
            "label": f"Target Image ({target_label})",
            "description": "Base frame to modify slightly while preserving scene geometry and characters"
        }

    # Resolve reference guides (0 to N): style, outfit, and prop references
    raw_refs = []
    if payload.reference_images:
        raw_refs.extend(payload.reference_images)
    if scene.reference_images:
        try:
            stored_refs = json.loads(scene.reference_images)
            for r in stored_refs:
                if r and r not in raw_refs:
                    raw_refs.append(r)
        except Exception:
            pass

    # Exclude target from references
    if target_image_path:
        raw_refs = [r for r in raw_refs if r != target_image_path and r != resolved_target]

    resolved_refs = []
    reference_images_info = []
    for idx, ref in enumerate(raw_refs):
        if not ref:
            continue
        abs_r = ref if (os.path.isabs(ref) and os.path.exists(ref)) else os.path.join(workspace_dir, ref)
        candidate_r = abs_r if os.path.exists(abs_r) else ref
        if candidate_r not in resolved_refs:
            resolved_refs.append(candidate_r)
            r_asset = find_flow_asset_for_image(ref)
            r_name = r_asset.get("display_name") if r_asset else os.path.basename(ref)
            reference_images_info.append({
                "path": candidate_r,
                "label": f"Ref #{idx+1} ({r_name})",
                "description": "Visual reference guide for style, outfit, or attributes"
            })

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
            theme_region=theme_region,
            scene_staging=scene_staging,
            target_info=target_info,
            reference_images_info=reference_images_info
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

    # 4. Trigger immediate image generation via Flow MCP / queue
    generating = False
    if payload.generate_image:
        ref_summary = ", ".join([r["label"] for r in reference_images_info]) if reference_images_info else "none"
        if resolved_target:
            t_name = target_asset_info.get("display_name") if target_asset_info else os.path.basename(target_image_path)
            gen_prompt = f"Modify target image '{t_name}': {payload.instruction}. Borrow visual styling from references: {ref_summary}. Base scene: {scene.image_prompt_english}"
        else:
            gen_prompt = f"Create new scene from scratch: {payload.instruction}. Incorporate styling and characters from references: {ref_summary}. Scene context: {scene.image_prompt_english}"

        # Place target image at position 0 so Flow treats it as primary img2img canvas
        flow_refs = ([resolved_target] if resolved_target else []) + [r for r in resolved_refs if r != resolved_target]

        task_payload = {
            "prompt": gen_prompt,
            "instruction": payload.instruction,
            "target_image": resolved_target,
            "style": project.illustration_style,
            "negative_prompt": scene.negative_prompt,
            "aspect_ratio": payload.aspect_ratio or project.aspect_ratio or "16:9",
            "guidance_scale": 7.5,
            "inference_steps": 10,
            "model": payload.model or "nano2",
            "count": payload.count or 1,
            "image_provider": payload.image_provider or "flow",
            "reference_images": flow_refs,
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
        "target_image": target_image_path,
        "reference_images": [r["path"] for r in reference_images_info],
        "change_summary": change_summary,
        "generating": generating
    }



@app.post("/api/scenes/{scene_id}/generate-image")
async def generate_scene_image(scene_id: int, payload: ImageGeneratePayload, db: Session = Depends(get_db)):
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")
        
    if scene.image_status == "processing":
        return {"status": "already_queued"}

    project = db.query(Project).filter(Project.id == scene.project_id).first()
    setting = db.query(Setting).first()

    # Resolve target image and references
    target_img = payload.target_image
    refs = []
    if payload.reference_images:
        refs.extend(payload.reference_images)
    if scene.reference_images:
        try:
            stored_refs = json.loads(scene.reference_images)
            for r in stored_refs:
                if r and r not in refs:
                    refs.append(r)
        except Exception:
            pass

    if target_img and target_img in refs:
        refs.remove(target_img)
    if target_img:
        refs.insert(0, target_img)

    task_payload = {
        "prompt": scene.image_prompt_english,
        "style": project.illustration_style,
        "negative_prompt": scene.negative_prompt,
        "aspect_ratio": payload.aspect_ratio or project.aspect_ratio or "16:9",
        "guidance_scale": payload.guidance_scale or 7.5,
        "inference_steps": payload.inference_steps or 10,
        "model": payload.model or "nano2",
        "count": payload.count or 1,
        "image_provider": payload.image_provider or (setting.image_provider if setting else "local") or "local",
        "target_image": target_img,
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
            scene.image_status = "completed" if scene.image_path else "idle"
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
        
    scene.image_status = "completed" if scene.image_path else "idle"
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
        
    if scene.audio_status == "processing":
        return {"status": "already_processing"}
        
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
        if scene.character_id != character_id:
            if scene.audio_status == "completed" or scene.audio_path:
                scene.audio_status = "outdated"
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
        if scene.narration_khmer and scene.audio_status != "processing":
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
async def trigger_video_render(project_id: int, payload: Optional[dict] = None, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload:
        data_to_save = payload.get("timeline_data") if (isinstance(payload, dict) and "timeline_data" in payload) else payload
        if isinstance(data_to_save, dict):
            project.timeline_data = json.dumps(data_to_save)
            db.commit()
            db.refresh(project)
    
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

