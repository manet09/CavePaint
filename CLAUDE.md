# CavePaint (video_studio) Project Status

## Architecture
CavePaint is a local content creation engine designed to synthesize videos from scripts using AI. The architecture is split into two main layers:

1. **Frontend (Next.js + React + Tailwind CSS)**:
   - A desktop-like workspace UI divided into 4 primary tabs: Overview, Images, Voice, Output.
   - Built with centralized React Context (`ProjectContext`) to manage global project state and active scenes.
   - Communicates with the backend via REST API calls.

2. **Backend (FastAPI + Python + SQLite)**:
   - Serves as the orchestration layer and data store.
   - Database schemas defined via SQLAlchemy (`Project`, `Scene`).
   - Uses a background `asyncio.Queue` worker (`queue_worker.py`) to process sequential, long-running ML tasks (image rendering, audio generation) locally to prevent blocking the UI and manage VRAM efficiently.
   - Services layer integrates with external/local models (`gemini.py` for text parsing, `draw_things.py` for image generation, `voice_engine.py` for text-to-speech).

## What We Have Done So Far
- **Database schema & API Scaffolding**: Endpoints for project creation, project updates, and scene management are fully built in `main.py`.
- **Background Worker System**: A task queue is implemented in `queue_worker.py` to handle `image` and `audio` rendering requests asynchronously.
- **Frontend Workspace Layout**: 
  - A sleek sidebar and persistent header.
  - **OverviewTab**: High-density 3-column workspace for inputting research, writing scripts, and defining global concepts.
  - **ImagesTab**: A robust, asymmetrical UI with a left navigation deck for parsed prompts, a central prompt refinement editor, and a right-side operations board for engine parameter tweaks.
  - **VoiceTab**: Dedicated UI to load/unload models into VRAM and sequence Khmer text-to-speech tasks.
  - **OutputTab**: Vertical production timeline that maps out the final rendered assets for each scene.

## What is Still Missing

### Backend (Missing Implementations)
1. **Static File Mounting**: The FastAPI app is missing `app.mount("/static", ...)` to serve the workspace directory. Because of this, generated images and audio files cannot be loaded by the frontend.
2. **True Text-to-Speech Engine**: `voice_engine.py` is currently mocking the VoxCPM model loading and audio generation (producing sine waves instead of actual speech).
3. **Video Compilation Service**: There is no logic or endpoint to stitch the sequenced image and audio assets together into a final `.mp4` video (e.g., using FFmpeg).
4. **Configuration / Secrets Management**: No centralized settings to manage API keys for Gemini or configurable local endpoints for Draw Things.

### UI (Missing Implementations)
1. **Unwired Buttons in ImagesTab**: The "Generate" and "Trash" buttons in the right-side Operations Board are currently UI mockups. They need `onClick` handlers connected to the backend endpoints (`/api/scenes/{scene_id}/generate-image` and `/api/scenes/{scene_id}/image`).
2. **Unwired Wands in OverviewTab**: The magic wand buttons meant to trigger auto-generation of fields (e.g., Video Concept, Script) do not have event handlers yet.
3. **Final Video Player**: The OutputTab currently displays a vertical list of the assets (images and audio separately), but it lacks an overarching video player to preview the stitched, final output.
4. **Global Settings Modal**: A UI to configure API keys, toggle local/remote model execution, and customize local API ports.
