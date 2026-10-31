import os
import time
import json
import shutil
import glob
import asyncio
import subprocess
import soundfile as sf
import imageio_ffmpeg
from typing import Dict, Any, List, Optional

WORKSPACE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "workspace"))

# In-memory render job status tracking: { project_id: { "status": "idle"|"rendering"|"completed"|"failed", "progress": int, "output_path": str, "error": str } }
RENDER_JOBS: Dict[int, Dict[str, Any]] = {}

ASPECT_RATIO_RESOLUTIONS = {
    "16:9": (1920, 1080),
    "9:16": (1080, 1920),
    "1:1": (1080, 1080),
    "4:3": (1440, 1080),
    "2:3": (1080, 1620),
}

def get_audio_duration(file_path: str) -> float:
    """Returns duration in seconds using soundfile, fallback to 0.0 on error."""
    if not file_path or not os.path.exists(file_path):
        return 0.0
    try:
        info = sf.info(file_path)
        return float(info.duration)
    except Exception:
        return 0.0

def get_project_coupling_status(project, db) -> Dict[str, Any]:
    """
    Computes scene-by-scene coupling readiness and durations.
    Canonical files:
      Image: workspace/<slug>/scene_{num:03d}.png
      Audio: workspace/<slug>/scene_{num:03d}.wav (or .mp3)
    """
    slug = project.slug or f"project-{project.id}"
    project_dir = os.path.join(WORKSPACE_DIR, slug)
    os.makedirs(project_dir, exist_ok=True)

    scenes = sorted(project.scenes, key=lambda s: s.scene_number)
    
    # Read timeline_data if present
    timeline_data = {}
    if project.timeline_data:
        try:
            timeline_data = json.loads(project.timeline_data)
        except Exception:
            timeline_data = {}

    scene_volumes = timeline_data.get("scene_volumes", {})

    scenes_data = []
    coupled_count = 0
    total_duration = 0.0

    for scene in scenes:
        num = scene.scene_number
        canonical_img_name = f"scene_{num:03d}.png"
        canonical_img_full = os.path.join(project_dir, canonical_img_name)
        
        # Check active image path
        has_canonical_image = os.path.exists(canonical_img_full)
        has_active_image = bool(scene.image_path and os.path.exists(os.path.join(WORKSPACE_DIR, scene.image_path)))
        image_exists = has_canonical_image or has_active_image

        rel_img_path = f"{slug}/{canonical_img_name}" if has_canonical_image else (scene.image_path or "")

        # Check audio
        audio_fmt = project.audio_format or "wav"
        canonical_aud_name = f"scene_{num:03d}.{audio_fmt}"
        canonical_aud_full = os.path.join(project_dir, canonical_aud_name)
        
        has_canonical_audio = os.path.exists(canonical_aud_full)
        has_active_audio = bool(scene.audio_path and os.path.exists(os.path.join(WORKSPACE_DIR, scene.audio_path)))
        audio_exists = has_canonical_audio or has_active_audio

        rel_aud_path = f"{slug}/{canonical_aud_name}" if has_canonical_audio else (scene.audio_path or "")
        aud_full_path = canonical_aud_full if has_canonical_audio else (os.path.join(WORKSPACE_DIR, scene.audio_path) if scene.audio_path else "")

        aud_mtime = int(os.path.getmtime(aud_full_path) * 1000) if (audio_exists and os.path.exists(aud_full_path)) else 0
        img_full_path = os.path.join(WORKSPACE_DIR, rel_img_path) if rel_img_path else ""
        img_mtime = int(os.path.getmtime(img_full_path) * 1000) if (image_exists and os.path.exists(img_full_path)) else 0

        duration = get_audio_duration(aud_full_path) if audio_exists else 0.0
        
        # Volume override
        vol = float(scene_volumes.get(str(num), 1.0))

        # Coupling state
        if image_exists and audio_exists and duration > 0:
            coupling_status = "ready"
            coupled_count += 1
            total_duration += duration
        elif image_exists and not audio_exists:
            coupling_status = "missing_audio"
        elif audio_exists and not image_exists:
            coupling_status = "missing_image"
        else:
            coupling_status = "uncoupled"

        scenes_data.append({
            "id": scene.id,
            "scene_number": num,
            "coupling_status": coupling_status,
            "image_path": rel_img_path,
            "image_exists": image_exists,
            "image_mtime": img_mtime,
            "audio_path": rel_aud_path,
            "audio_exists": audio_exists,
            "audio_status": scene.audio_status or "idle",
            "audio_mtime": aud_mtime,
            "duration": round(duration, 3),
            "volume": vol,
            "narration_khmer": scene.narration_khmer or "",
            "image_prompt_english": scene.image_prompt_english or "",
        })

    # Check for master voiceover timeline file
    audio_fmt = project.audio_format or "wav"
    canonical_master_name = f"master_voiceover.{audio_fmt}"
    canonical_master_full = os.path.join(project_dir, canonical_master_name)
    master_exists = os.path.exists(canonical_master_full)
    master_mtime = os.path.getmtime(canonical_master_full) if master_exists else 0.0

    # Calculate latest scene audio timestamp
    latest_scene_mtime = 0.0
    for s_item in scenes_data:
        if s_item.get("audio_mtime", 0) > 0:
            latest_scene_mtime = max(latest_scene_mtime, s_item["audio_mtime"] / 1000.0)

    # Auto-compile master voiceover if missing or outdated and at least one scene has audio
    has_any_audio = any(s_item["audio_exists"] for s_item in scenes_data)
    if has_any_audio and (not master_exists or master_mtime < latest_scene_mtime):
        try:
            from .voice_engine import compile_master_voiceover
            compile_master_voiceover(project.id, db)
            master_exists = os.path.exists(canonical_master_full)
            master_mtime = os.path.getmtime(canonical_master_full) if master_exists else time.time()
        except Exception as e:
            print(f"Error auto-compiling master voiceover in get_project_coupling_status: {e}")

    cache_buster = int(max(master_mtime, latest_scene_mtime, time.time() if not master_exists else 0) * 1000)

    # Check for final output video
    final_video_name = "final_output.mp4"
    final_video_path = os.path.join(project_dir, final_video_name)
    has_final_video = os.path.exists(final_video_path)

    # Check for bgm directory
    bgm_dir = os.path.join(project_dir, "bgm")
    bgm_files = []
    if os.path.exists(bgm_dir):
        for f in os.listdir(bgm_dir):
            if f.lower().endswith((".mp3", ".wav", ".m4a", ".aac", ".ogg")):
                full = os.path.join(bgm_dir, f)
                bgm_files.append({
                    "filename": f,
                    "relative_path": f"{slug}/bgm/{f}",
                    "duration": round(get_audio_duration(full), 2),
                    "size_bytes": os.path.getsize(full)
                })

    job = RENDER_JOBS.get(project.id, {"status": "idle", "progress": 0, "output_path": None, "error": None})

    return {
        "project_id": project.id,
        "slug": slug,
        "aspect_ratio": project.aspect_ratio or "16:9",
        "total_scenes": len(scenes),
        "coupled_count": coupled_count,
        "coupling_percent": round((coupled_count / len(scenes) * 100) if scenes else 0, 1),
        "total_duration": round(total_duration, 2),
        "is_ready_to_render": coupled_count > 0 and coupled_count == len(scenes),
        "has_final_video": has_final_video,
        "final_video_path": f"{slug}/{final_video_name}" if has_final_video else None,
        "bgm_files": bgm_files,
        "timeline_data": timeline_data,
        "render_job": job,
        "master_audio_path": f"{slug}/{canonical_master_name}" if master_exists else None,
        "master_audio_exists": master_exists,
        "audio_cache_buster": cache_buster,
        "scenes": scenes_data
    }

async def render_project_video(project_id: int, db) -> Dict[str, Any]:
    """
    Renders the assembled project video using FFmpeg.
    Assembles:
      1. Image sequence held for each scene's audio duration.
      2. Scene audio tracks concatenated with individual volume adjustments.
      3. Background music mixed in with start offset, volume, and optional ducking.
      4. Text overlays burned in with selected font, color, and position.
    """
    from ..database import Project
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise Exception("Project not found")

    slug = project.slug or f"project-{project.id}"
    project_dir = os.path.join(WORKSPACE_DIR, slug)
    
    # Mark job as rendering
    RENDER_JOBS[project_id] = {
        "status": "rendering",
        "progress": 10,
        "output_path": None,
        "error": None
    }

    try:
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
        aspect_ratio = project.aspect_ratio or "16:9"
        out_w, out_h = ASPECT_RATIO_RESOLUTIONS.get(aspect_ratio, (1920, 1080))

        # Parse timeline_data
        timeline_data = {}
        if project.timeline_data:
            try:
                timeline_data = json.loads(project.timeline_data)
            except Exception:
                timeline_data = {}

        bgm_config = timeline_data.get("bgm", {})
        scene_volumes = timeline_data.get("scene_volumes", {})
        text_overlays = timeline_data.get("text_overlays", [])
        master_voice_vol = float(timeline_data.get("master_voice_volume", 1.0))
        master_bgm_vol = float(timeline_data.get("master_bgm_volume", 0.35))
        ducking_enabled = bool(timeline_data.get("ducking", True))

        # Gather coupled scenes
        scenes = sorted(project.scenes, key=lambda s: s.scene_number)
        coupled_items = []
        for s in scenes:
            num = s.scene_number
            img = os.path.join(project_dir, f"scene_{num:03d}.png")
            if not os.path.exists(img) and s.image_path:
                img = os.path.join(WORKSPACE_DIR, s.image_path)
            
            aud = os.path.join(project_dir, f"scene_{num:03d}.{project.audio_format or 'wav'}")
            if not os.path.exists(aud) and s.audio_path:
                aud = os.path.join(WORKSPACE_DIR, s.audio_path)
            
            if os.path.exists(img) and os.path.exists(aud):
                dur = get_audio_duration(aud)
                if dur > 0:
                    scene_vol = float(scene_volumes.get(str(num), 1.0))
                    vol = max(0.0, scene_vol * master_voice_vol)
                    coupled_items.append({
                        "scene_number": num,
                        "image_path": img,
                        "audio_path": aud,
                        "duration": dur,
                        "volume": vol
                    })

        if not coupled_items:
            raise Exception("No coupled scenes found (must have at least one scene with both image and audio).")

        RENDER_JOBS[project_id]["progress"] = 25

        # Create temporary working directory for rendering artifacts
        temp_dir = os.path.join(project_dir, ".render_tmp")
        os.makedirs(temp_dir, exist_ok=True)

        # Step 1: Create concat list for video images
        # FFmpeg concat demuxer format:
        # file 'image.png'
        # duration 4.52
        concat_file_path = os.path.join(temp_dir, "images_concat.txt")
        with open(concat_file_path, "w", encoding="utf-8") as f:
            for item in coupled_items:
                f.write(f"file '{item['image_path']}'\n")
                f.write(f"duration {item['duration']:.3f}\n")
            # Repeat last file per FFmpeg concat demuxer requirements
            f.write(f"file '{coupled_items[-1]['image_path']}'\n")

        # Step 2: Render each scene audio with individual volume to temporary WAVs
        scene_wav_paths = []
        for idx, item in enumerate(coupled_items):
            adj_wav = os.path.join(temp_dir, f"scene_{idx:03d}_vol.wav")
            vol_val = item["volume"]
            cmd_vol = [
                ffmpeg_exe, "-y",
                "-i", item["audio_path"],
                "-filter:a", f"volume={vol_val:.2f}",
                adj_wav
            ]
            subprocess.run(cmd_vol, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            scene_wav_paths.append(adj_wav)

        RENDER_JOBS[project_id]["progress"] = 45

        # Step 3: Concat voiceover tracks together
        voice_concat_txt = os.path.join(temp_dir, "voice_concat.txt")
        with open(voice_concat_txt, "w", encoding="utf-8") as f:
            for wav_p in scene_wav_paths:
                f.write(f"file '{wav_p}'\n")
        
        master_voice_rendered = os.path.join(temp_dir, "master_voice_combined.wav")
        cmd_concat_audio = [
            ffmpeg_exe, "-y",
            "-f", "concat", "-safe", "0",
            "-i", voice_concat_txt,
            "-c:a", "pcm_s16le",
            master_voice_rendered
        ]
        subprocess.run(cmd_concat_audio, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        RENDER_JOBS[project_id]["progress"] = 60

        # Step 4: Prepare background music if available (supports multi-clip BGM)
        bgm_clips = timeline_data.get("bgm_clips", [])
        if not bgm_clips and timeline_data.get("bgm"):
            bgm_clips = [timeline_data.get("bgm")]

        valid_bgm_clips = []
        for clip in bgm_clips:
            rel = clip.get("relative_path")
            fpath = os.path.join(WORKSPACE_DIR, rel) if rel else None
            if fpath and os.path.exists(fpath):
                valid_bgm_clips.append({
                    "path": fpath,
                    "start_time": max(0.0, float(clip.get("start_time", 0.0))),
                    "duration": max(0.0, float(clip.get("duration", 0.0))),
                    "media_offset": max(0.0, float(clip.get("media_offset", 0.0))),
                    "volume": max(0.0, float(clip.get("volume", 1.0))),
                })

        mixed_audio_path = os.path.join(temp_dir, "mixed_audio.wav")
        if valid_bgm_clips:
            cmd_mix = [ffmpeg_exe, "-y", "-i", master_voice_rendered]
            for clip in valid_bgm_clips:
                cmd_mix.extend(["-i", clip["path"]])

            filter_parts = ["[0:a]volume=1.0[voice];"]
            bgm_out_labels = []

            for idx, clip in enumerate(valid_bgm_clips):
                input_idx = idx + 1
                duck_factor = 0.35 if ducking_enabled else 1.0
                clip_vol = master_bgm_vol * clip["volume"] * duck_factor

                delay_ms = int(clip["start_time"] * 1000)
                dur = clip["duration"]
                offset = clip["media_offset"]

                trim_filter = ""
                if dur > 0:
                    trim_filter = f"atrim={offset:.3f}:{offset + dur:.3f},asetpts=PTS-STARTPTS,"
                elif offset > 0:
                    trim_filter = f"atrim=start={offset:.3f},asetpts=PTS-STARTPTS,"

                filter_parts.append(
                    f"[{input_idx}:a]{trim_filter}volume={clip_vol:.2f},adelay={delay_ms}|{delay_ms}[bgm{idx}];"
                )
                bgm_out_labels.append(f"[bgm{idx}]")

            if len(bgm_out_labels) == 1:
                filter_parts.append(f"[voice]{bgm_out_labels[0]}amix=inputs=2:duration=first:normalize=0:dropout_transition=0,alimiter=limit=0.98:attack=5:release=50[aout]")
            else:
                filter_parts.append(f"{''.join(bgm_out_labels)}amix=inputs={len(bgm_out_labels)}:normalize=0:dropout_transition=0[bgm_mix];")
                filter_parts.append(f"[voice][bgm_mix]amix=inputs=2:duration=first:normalize=0:dropout_transition=0,alimiter=limit=0.98:attack=5:release=50[aout]")

            filter_complex = "".join(filter_parts)
            cmd_mix.extend([
                "-filter_complex", filter_complex,
                "-map", "[aout]",
                mixed_audio_path
            ])
            subprocess.run(cmd_mix, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        else:
            mixed_audio_path = master_voice_rendered

        RENDER_JOBS[project_id]["progress"] = 75

        # Step 5: Build video filter chain (scaling + letterbox + text overlays)
        video_filters = [
            f"scale={out_w}:{out_h}:force_original_aspect_ratio=decrease",
            f"pad={out_w}:{out_h}:(ow-iw)/2:(oh-ih)/2:color=black",
            "format=yuv420p"
        ]

        font_path = "/System/Library/Fonts/Supplemental/Arial.ttf"
        khmer_font_path = "/System/Library/Fonts/Supplemental/Khmer Sangam MN.ttf"

        for txt in text_overlays:
            content = txt.get("text", "").replace("'", "\\'").replace(":", "\\:")
            if not content.strip():
                continue

            t_start = float(txt.get("start_time", 0.0))
            t_dur = float(txt.get("duration", 3.0))
            t_end = t_start + t_dur
            color = txt.get("color", "#FFFFFF").replace("#", "0x")
            pos = txt.get("position", "bottom")
            font_size = int(txt.get("font_size", 36))
            
            is_khmer = any('\u1780' <= c <= '\u17ff' for c in content)
            active_font = khmer_font_path if is_khmer and os.path.exists(khmer_font_path) else font_path

            if "x_percent" in txt and "y_percent" in txt:
                x_pct = max(0.0, min(1.0, float(txt.get("x_percent", 50)) / 100.0))
                y_pct = max(0.0, min(1.0, float(txt.get("y_percent", 85)) / 100.0))
                x_expr = f"(w-text_w)*{x_pct:.3f}"
                y_expr = f"(h-text_h)*{y_pct:.3f}"
            elif pos == "top":
                x_expr = "(w-text_w)/2"
                y_expr = "60"
            elif pos == "center":
                x_expr = "(w-text_w)/2"
                y_expr = "(h-text_h)/2"
            else:  # bottom
                x_expr = "(w-text_w)/2"
                y_expr = "h-text_h-80"

            drawtext = (
                f"drawtext=fontfile='{active_font}':text='{content}':"
                f"fontsize={font_size}:fontcolor={color}:"
                f"box=1:boxcolor=black@0.65:boxborderw=12:"
                f"x={x_expr}:y={y_expr}:"
                f"enable='between(t,{t_start:.2f},{t_end:.2f})'"
            )
            video_filters.append(drawtext)

        vf_string = ",".join(video_filters)

        # Step 6: Final MP4 compilation
        final_mp4_path = os.path.join(project_dir, "final_output.mp4")
        cmd_final = [
            ffmpeg_exe, "-y",
            "-f", "concat", "-safe", "0",
            "-i", concat_file_path,
            "-i", mixed_audio_path,
            "-vf", vf_string,
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "20",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            "-pix_fmt", "yuv420p",
            final_mp4_path
        ]

        RENDER_JOBS[project_id]["progress"] = 85
        subprocess.run(cmd_final, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        try:
            shutil.rmtree(temp_dir)
        except Exception:
            pass

        RENDER_JOBS[project_id] = {
            "status": "completed",
            "progress": 100,
            "output_path": f"{slug}/final_output.mp4",
            "error": None
        }

        return RENDER_JOBS[project_id]

    except Exception as e:
        import traceback
        err_msg = str(e) or "Render failed"
        print(f"[RENDER ERROR] {err_msg}\n{traceback.format_exc()}")
        RENDER_JOBS[project_id] = {
            "status": "failed",
            "progress": 0,
            "output_path": None,
            "error": err_msg
        }
        raise e
