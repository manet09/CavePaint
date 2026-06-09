import os
import asyncio
from dataclasses import dataclass
from typing import Optional
from .database import SessionLocal, Scene, Project
from .services import draw_things, voice_engine

@dataclass
class GenerationTask:
    task_type: str  # "image" or "audio"
    project_id: int
    scene_id: int
    payload: dict

# Global task queue
task_queue = asyncio.Queue()

async def process_task(task: GenerationTask):
    print(f"Processing task: {task}")
    db = SessionLocal()
    try:
        scene = db.query(Scene).filter(Scene.id == task.scene_id).first()
        project = db.query(Project).filter(Project.id == task.project_id).first()
        if not scene or not project:
            print(f"Scene {task.scene_id} or Project {task.project_id} not found.")
            return

        if task.task_type == "image":
            if scene.image_status != "processing":
                print("Task cancelled in queue. Skipping.")
                return
            
            prompt = task.payload.get("prompt") or ""
            style = task.payload.get("style") or ""
            full_prompt = f"{style}, {prompt}".strip(", ")
            
            aspect_ratio = task.payload.get("aspect_ratio", "16:9")
            guidance_scale = task.payload.get("guidance_scale", 7.5)
            inference_steps = task.payload.get("inference_steps", 30)

            # Map aspect ratio to width and height
            ar_map = {
                "1:1": (512, 512),
                "4:3": (768, 576),
                "16:9": (1024, 576),
                "9:16": (576, 1024),
                "3:4": (576, 768)
            }
            width, height = ar_map.get(aspect_ratio, (1024, 576))

            workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace"))
            init_image_path = None
            if scene.image_path:
                init_image_path = os.path.join(workspace_dir, scene.image_path)

            loop = asyncio.get_running_loop()
            save_path = await loop.run_in_executor(
                None, 
                draw_things.trigger_local_render, 
                full_prompt, 
                project.slug, 
                scene.scene_number,
                width,
                height,
                guidance_scale,
                inference_steps,
                init_image_path
            )
            
            db.refresh(scene)
            if scene.image_status == "idle":
                print("Task was cancelled during execution.")
                return
            
            rel_save_path = os.path.relpath(save_path, workspace_dir).replace("\\", "/")
            scene.image_path = rel_save_path
            scene.image_status = "completed"
            db.commit()
            
        elif task.task_type == "audio":
            scene.audio_status = "processing"
            db.commit()
            
            text = task.payload.get("text")
            loop = asyncio.get_running_loop()
            save_path = await loop.run_in_executor(
                None,
                voice_engine.generate_scene_audio,
                text,
                project.slug,
                scene.scene_number
            )
            
            
            workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace"))
            rel_save_path = os.path.relpath(save_path, workspace_dir).replace("\\", "/")
            scene.audio_path = rel_save_path
            scene.audio_status = "completed"
            db.commit()
            
    except Exception as e:
        print(f"Error processing task: {e}")
        db.rollback()
        
        # Mark as failed
        try:
            scene = db.query(Scene).filter(Scene.id == task.scene_id).first()
            if scene:
                if task.task_type == "image":
                    scene.image_status = "failed"
                elif task.task_type == "audio":
                    scene.audio_status = "failed"
                db.commit()
        except Exception as fallback_e:
            print(f"Failed to update status to failed: {fallback_e}")
            
    finally:
        db.close()

async def start_queue_worker():
    """Long-running background polling worker loop."""
    print("Queue worker started. Enforcing single-lane execution...")
    while True:
        task = await task_queue.get()
        try:
            # Process tasks sequentially item-by-item to avoid memory fragmentation
            await process_task(task)
        except asyncio.CancelledError:
            print("Queue worker cancelled.")
            break
        except Exception as e:
            print(f"Queue worker encountered error: {e}")
        finally:
            task_queue.task_done()
