import os
import gc
import asyncio
import time
import torch
import soundfile as sf
import numpy as np

try:
    from voxcpm import VoxCPM
except ImportError:
    VoxCPM = None

_VOXCPM_MODEL_LOADED = False
_VOXCPM_MODEL = None
_UNLOAD_TASK = None
_LAST_ACTIVITY_TIME = time.time()

def load_model() -> bool:
    global _VOXCPM_MODEL_LOADED, _VOXCPM_MODEL, _LAST_ACTIVITY_TIME
    _LAST_ACTIVITY_TIME = time.time()
    
    if not _VOXCPM_MODEL_LOADED:
        print("Loading VoxCPM Model into Unified Memory...")
        if VoxCPM is not None:
            _VOXCPM_MODEL = VoxCPM.from_pretrained("ravuthz/VoxCPM2-khmer", load_denoiser=False)
        else:
            print("voxcpm module not found, mocking load.")
            _VOXCPM_MODEL = "MockModelData"
        _VOXCPM_MODEL_LOADED = True
    
    _cancel_unload_task()
    return True

def _cancel_unload_task():
    global _UNLOAD_TASK
    if _UNLOAD_TASK is not None:
        _UNLOAD_TASK.cancel()
        _UNLOAD_TASK = None

async def _idle_unloader():
    while True:
        await asyncio.sleep(5) # check periodically
        if _VOXCPM_MODEL_LOADED and (time.time() - _LAST_ACTIVITY_TIME) >= 45:
            unload_model()
            break

def schedule_unload():
    global _UNLOAD_TASK
    _cancel_unload_task()
    try:
        loop = asyncio.get_running_loop()
        _UNLOAD_TASK = loop.create_task(_idle_unloader())
    except RuntimeError:
        # Fallback if no event loop is running
        pass

def unload_model() -> bool:
    global _VOXCPM_MODEL_LOADED, _VOXCPM_MODEL
    print("Unloading VoxCPM Model to recover Unified Memory...")
    _VOXCPM_MODEL = None
    _VOXCPM_MODEL_LOADED = False
    
    # Explicit garbage collection
    gc.collect()
    
    # PyTorch device cache flusher
    if torch.backends.mps.is_available():
        torch.mps.empty_cache()
        print("MPS cache cleared.")
    elif torch.cuda.is_available():
        torch.cuda.empty_cache()
        print("CUDA cache cleared.")
        
    return True

def generate_scene_audio_chunk(text: str, project_slug: str, profile_tag: str, scene_number: int):
    global _VOXCPM_MODEL_LOADED, _LAST_ACTIVITY_TIME, _VOXCPM_MODEL
    
    if not _VOXCPM_MODEL_LOADED:
        load_model()
        
    _LAST_ACTIVITY_TIME = time.time()
    
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "workspace"))
    project_dir = os.path.join(workspace_dir, project_slug)
    os.makedirs(project_dir, exist_ok=True)
    
    seed_path = os.path.join(project_dir, "voice_profile_seed.wav")
    seed_text = "ភ្នំពេញគឺជាទីក្រុងធំនៃប្រទេសកម្ពុជា។"
    
    sample_rate = 22050
    
    # 1. Automated Voice Seed Profile Creation
    if not os.path.exists(seed_path):
        print(f"Generating Voice Design Seed Profile for {project_slug}...")
        if VoxCPM is not None and hasattr(_VOXCPM_MODEL, 'generate'):
            # Real model call
            design_prompt = f"{profile_tag}{seed_text}"
            seed_audio = _VOXCPM_MODEL.generate(
                text=design_prompt,
                cfg_value=2.0,
                inference_timesteps=15
            )
        else:
            # Mock audio for testing
            duration = 1.0
            t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
            seed_audio = 0.5 * np.sin(2 * np.pi * 440 * t)
            
        try:
            sf.write(seed_path, seed_audio, sample_rate)
        except Exception as e:
            print(f"Failed to write seed audio: {e}")

    # 3. Acoustic Cushion Layer (Padding)
    # Ensure text chunk ends with the proper sentence token
    text = text.strip()
    if not text.endswith("។"):
        text += "។"
        
    if VoxCPM is not None and hasattr(_VOXCPM_MODEL, 'generate'):
        raw_audio = _VOXCPM_MODEL.generate(
            text=text,
            prompt_wav_path=seed_path,
            prompt_text=seed_text,
            cfg_value=2.0,
            inference_timesteps=15
        )
    else:
        duration = 1.5
        t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
        raw_audio = 0.5 * np.sin(2 * np.pi * 440 * t)

    # 0.20-second buffer of absolute silence
    silence_frames = int(0.20 * sample_rate)
    silence = np.zeros(silence_frames, dtype=raw_audio.dtype if hasattr(raw_audio, 'dtype') else np.float32)
    
    # Append the silence
    padded_audio = np.concatenate((raw_audio, silence))
    
    # Flattened path layout
    save_path = os.path.join(project_dir, f"scene_{scene_number}.wav")
    
    try:
        sf.write(save_path, padded_audio, sample_rate)
    except Exception as e:
        print(f"Failed to write padded audio: {e}")

    _LAST_ACTIVITY_TIME = time.time()
    schedule_unload()
    return save_path

def compile_master_voiceover(project_id: int, db_session):
    from ..database import Scene, Project
    
    project = db_session.query(Project).filter(Project.id == project_id).first()
    if not project:
        print(f"compile_master_voiceover: Project {project_id} not found.")
        return
        
    scenes = db_session.query(Scene).filter(Scene.project_id == project_id).order_by(Scene.scene_number.asc()).all()
    
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "workspace"))
    
    segments = []
    base_sample_rate = 22050
    
    for scene in scenes:
        if scene.audio_path:
            full_path = os.path.join(workspace_dir, scene.audio_path)
            if os.path.exists(full_path):
                try:
                    data, sr = sf.read(full_path)
                    segments.append(data)
                    base_sample_rate = sr
                except Exception as e:
                    print(f"Error reading {full_path}: {e}")
                    
    if segments:
        master_audio = np.concatenate(segments, axis=0)
        
        project_dir = os.path.join(workspace_dir, project.slug)
        os.makedirs(project_dir, exist_ok=True)
        master_path = os.path.join(project_dir, "master_voiceover.wav")
        
        try:
            sf.write(master_path, master_audio, base_sample_rate)
            rel_master_path = os.path.relpath(master_path, workspace_dir).replace("\\", "/")
            project.master_audio_path = rel_master_path
            db_session.commit()
            print(f"Master voiceover compiled and saved to {master_path}")
        except Exception as e:
            print(f"Failed to write master voiceover: {e}")
            db_session.rollback()
    else:
        print("No valid audio segments found to concatenate.")
