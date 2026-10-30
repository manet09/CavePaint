import os
import json
import asyncio
import shutil
from dataclasses import dataclass
from typing import Optional
from .database import SessionLocal, Scene, Project, Character, Setting, Generation, sync_project_json
from .services import draw_things, voice_engine, flow_engine

@dataclass
class GenerationTask:
    task_type: str  # "image" or "audio"
    project_id: int
    scene_id: int
    payload: dict

# Dedicated queues for image rendering and neural audio synthesis
image_queue = asyncio.Queue()
audio_queue = asyncio.Queue()

class DualTaskQueue:
    """Dispatches tasks to dedicated image or audio queues to avoid head-of-line blocking."""
    async def put(self, task: GenerationTask):
        if task.task_type in ("audio", "audio_single"):
            await audio_queue.put(task)
        else:
            await image_queue.put(task)
            
    def qsize(self):
        return image_queue.qsize() + audio_queue.qsize()
        
    @property
    def _queue(self):
        return list(image_queue._queue) + list(audio_queue._queue)

task_queue = DualTaskQueue()

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

            # Resolve image provider
            setting = db.query(Setting).first()
            image_provider = task.payload.get("image_provider") or (setting.image_provider if setting else "local") or "local"
            
            prompt = task.payload.get("prompt") or ""
            style = task.payload.get("style") or ""
            negative_prompt = task.payload.get("negative_prompt") or ""
            full_prompt = f"{style}, {prompt}".strip(", ")
            
            aspect_ratio = task.payload.get("aspect_ratio", "16:9")
            workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace"))
            loop = asyncio.get_running_loop()

            try:
                if image_provider == "flow":
                    model = task.payload.get("model", "nano2")
                    count = int(task.payload.get("count", 1))
                    instructions = task.payload.get("instruction") or task.payload.get("instructions")

                    target_image = task.payload.get("target_image")

                    # Resolve reference images (merge payload and stored scene references)
                    refs = []
                    if task.payload.get("reference_images"):
                        p_refs = task.payload.get("reference_images")
                        if isinstance(p_refs, list):
                            refs.extend(p_refs)
                        elif p_refs:
                            refs.append(p_refs)
                    if scene.reference_images:
                        try:
                            db_refs = json.loads(scene.reference_images)
                            for r in db_refs:
                                if r and r not in refs:
                                    refs.append(r)
                        except Exception:
                            pass

                    # If target_image is specified, ensure it is at index 0 (primary img2img base)
                    if target_image:
                        if target_image in refs:
                            refs.remove(target_image)
                        refs.insert(0, target_image)

                    render_result = await loop.run_in_executor(
                        None,
                        lambda: flow_engine.trigger_flow_render(
                            prompt=full_prompt,
                            project_slug=project.slug,
                            scene_number=scene.scene_number,
                            aspect_ratio=aspect_ratio,
                            model=model,
                            count=count,
                            reference_images=refs,
                            flow_project_id=project.flow_project_id,
                            instructions=instructions
                        )
                    )

                    db.refresh(scene)
                    db.refresh(project)
                    if scene.image_status != "processing":
                        print("Task was cancelled during execution.")
                        return

                    # Persist newly created Flow project ID
                    if render_result.get("flow_project_id") and not project.flow_project_id:
                        project.flow_project_id = render_result["flow_project_id"]

                    output_paths = render_result.get("output_paths", [])
                    if not output_paths:
                        raise Exception("Flow render completed but produced no output file paths.")

                    try:
                        current_images = json.loads(scene.images_list) if scene.images_list else []
                    except Exception:
                        current_images = []

                    for p in output_paths:
                        if p not in current_images:
                            current_images.append(p)

                    scene.images_list = json.dumps(current_images)
                    scene.image_path = output_paths[0]
                    scene.image_status = "completed"

                    # Record Generation audit entry
                    gen_entry = Generation(
                        scene_id=scene.id,
                        provider="flow",
                        model=model,
                        aspect_ratio=aspect_ratio,
                        count=count,
                        prompt=full_prompt,
                        reference_media_ids=json.dumps(refs),
                        output_paths=json.dumps(output_paths),
                        flow_media_ids=json.dumps(render_result.get("flow_media_ids", [])),
                        status="completed"
                    )
                    db.add(gen_entry)
                    db.commit()

                    # Mirror canonical scene file for downstream video automation
                    try:
                        proj_dir = os.path.join(workspace_dir, project.slug)
                        canonical_file = os.path.join(proj_dir, f"scene_{scene.scene_number:03d}.png")
                        src_file = os.path.join(workspace_dir, scene.image_path)
                        if os.path.exists(src_file):
                            shutil.copyfile(src_file, canonical_file)
                    except Exception as m_err:
                        print(f"Error mirroring canonical scene image: {m_err}")

                    sync_project_json(project.id, db)

                else:
                    # Local Draw Things Render
                    guidance_scale = float(task.payload.get("guidance_scale", 7.5))
                    inference_steps = int(task.payload.get("inference_steps", 10))

                    ar_map = {
                        "1:1": (768, 768),
                        "4:3": (1024, 768),
                        "16:9": (1024, 576),
                        "9:16": (576, 1024),
                        "2:3": (640, 960)
                    }
                    width, height = ar_map.get(aspect_ratio, (576, 1024))

                    target_image = task.payload.get("target_image")
                    init_image_path = None
                    if target_image:
                        init_candidate = target_image if os.path.isabs(target_image) else os.path.join(workspace_dir, target_image)
                        if os.path.exists(init_candidate):
                            init_image_path = init_candidate

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
                        init_image_path,
                        negative_prompt
                    )
                    
                    db.refresh(scene)
                    if scene.image_status != "processing":
                        print("Task was cancelled during execution.")
                        return
                    
                    rel_save_path = os.path.relpath(save_path, workspace_dir).replace("\\", "/")

                    try:
                        current_images = json.loads(scene.images_list) if scene.images_list else []
                    except Exception:
                        current_images = []

                    if rel_save_path not in current_images:
                        current_images.append(rel_save_path)

                    scene.images_list = json.dumps(current_images)
                    scene.image_path = rel_save_path
                    scene.image_status = "completed"

                    # Record Generation audit entry
                    gen_entry = Generation(
                        scene_id=scene.id,
                        provider="local",
                        model="draw_things",
                        aspect_ratio=aspect_ratio,
                        count=1,
                        prompt=full_prompt,
                        output_paths=json.dumps([rel_save_path]),
                        status="completed"
                    )
                    db.add(gen_entry)
                    db.commit()

                    # Mirror canonical scene file for downstream video automation
                    try:
                        proj_dir = os.path.join(workspace_dir, project.slug)
                        canonical_file = os.path.join(proj_dir, f"scene_{scene.scene_number:03d}.png")
                        src_file = os.path.join(workspace_dir, scene.image_path)
                        if os.path.exists(src_file):
                            shutil.copyfile(src_file, canonical_file)
                    except Exception as m_err:
                        print(f"Error mirroring canonical scene image: {m_err}")

                    sync_project_json(project.id, db)

            except Exception as img_err:
                print(f"Error during {image_provider} image generation: {img_err}")
                db.refresh(scene)
                scene.image_status = "failed"
                db.commit()
                raise img_err
            
        elif task.task_type == "audio":
            if scene.audio_status != "processing":
                print("Audio task cancelled in queue. Skipping.")
                return
                
            text = task.payload.get("text")
            
            workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace"))
            
            loop = asyncio.get_running_loop()
            save_path = await loop.run_in_executor(
                None,
                voice_engine.generate_scene_audio_chunk,
                text,
                project.slug,
                project.voice_profile_tag or "default",
                scene.scene_number,
                project.audio_format or "wav"
            )
            
            rel_save_path = os.path.relpath(save_path, workspace_dir).replace("\\", "/")
            scene.audio_path = rel_save_path
            scene.audio_text = text or scene.narration_khmer
            scene.audio_status = "completed"
            db.commit()
            
            try:
                # Compile master timeline immediately after a chunk completes
                voice_engine.compile_master_voiceover(project.id, db)
            except Exception as compile_err:
                print(f"Failed to compile master voiceover: {compile_err}")
                db.rollback()

            sync_project_json(project.id, db)
                
        elif task.task_type == "audio_single":
            if scene.audio_status != "processing":
                print("Single audio task cancelled in queue. Skipping.")
                return
                
            text = task.payload.get("text")
            character_id = task.payload.get("character_id")
            
            reference_audio_path = None
            reference_text = None
            character_name = None
            
            workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace"))
            
            if character_id:
                character = db.query(Character).filter(Character.id == character_id).first()
                if character:
                    reference_audio_path = os.path.join(workspace_dir, character.audio_path)
                    reference_text = character.reference_text
                    character_name = character.name
            
            loop = asyncio.get_running_loop()
            save_path = await loop.run_in_executor(
                None,
                voice_engine.generate_single_scene_audio,
                text,
                project.slug,
                scene.scene_number,
                reference_audio_path,
                reference_text,
                project.audio_format or "wav",
                project.voice_profile_tag or "(Male, Adult, Documentary tone, Normal speed)"
            )
            
            rel_save_path = os.path.relpath(save_path, workspace_dir).replace("\\", "/")
            scene.audio_path = rel_save_path
            scene.audio_text = text or scene.narration_khmer
            
            if character_id:
                scene.character_id = character_id
                scene.character_name = character_name
                
            scene.audio_status = "completed"
            db.commit()
            
            try:
                voice_engine.compile_master_voiceover(project.id, db)
            except Exception as compile_err:
                print(f"Failed to compile master voiceover: {compile_err}")
                db.rollback()

            sync_project_json(project.id, db)
            
    except Exception as e:
        print(f"Error processing task: {e}")
        db.rollback()
        
        # Mark as failed
        try:
            scene = db.query(Scene).filter(Scene.id == task.scene_id).first()
            if scene:
                if task.task_type == "image":
                    scene.image_status = "failed"
                elif task.task_type in ("audio", "audio_single"):
                    scene.audio_status = "failed"
                db.commit()
        except Exception as fallback_e:
            print(f"Failed to update status to failed: {fallback_e}")
            
    finally:
        db.close()

async def _image_worker_loop():
    print("Image queue worker started...")
    while True:
        task = await image_queue.get()
        try:
            await process_task(task)
        except asyncio.CancelledError:
            print("Image queue worker cancelled.")
            break
        except Exception as e:
            print(f"Image worker encountered error: {e}")
        finally:
            image_queue.task_done()

async def _audio_worker_loop():
    print("Audio queue worker started...")
    while True:
        task = await audio_queue.get()
        try:
            await process_task(task)
        except asyncio.CancelledError:
            print("Audio queue worker cancelled.")
            break
        except Exception as e:
            print(f"Audio worker encountered error: {e}")
        finally:
            audio_queue.task_done()

async def start_queue_worker():
    """Runs dedicated image and audio background workers concurrently."""
    print("Starting dual background queue workers (Image & Audio lanes)...")
    await asyncio.gather(_image_worker_loop(), _audio_worker_loop())
