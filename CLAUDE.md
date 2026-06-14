# CavePaint - Local Content Creation Engine

CavePaint is a local video and content creation studio designed to automate the process of turning raw research and concepts into complete audio-visual timelines. It uses an AI-powered pipeline integrating large language models for scene drafting, local Stable Diffusion for image generation, and local text-to-speech models for narration.

## Technology Stack
- **Frontend**: Next.js 16 (Turbopack), React 18, Tailwind CSS, TypeScript. Icons by Lucide React.
- **Backend**: FastAPI, Python 3.10+.
- **Database**: SQLite with SQLAlchemy ORM.
- **Task Queue**: Native Python `asyncio.Queue` via background workers.
- **AI Integrations**: 
  - **LLM Orchestrator** (Hot-swappable via UI settings):
    - Google Gemini (`gemini-2.5-flash`) for text/scene generation and orchestration.
    - Groq (`llama3-70b-8192`) as a high-speed alternative engine.
  - Draw Things (Local Stable Diffusion REST API) for image synthesis.
  - VoxCPM2 (Local TTS) for Khmer voice synthesis.

---

## System Architecture

The application is structured into a decoupled frontend/backend system, relying on local directories (`workspace/`) for physical asset management.

### 1. Database & State (`backend/database.py`)
- Uses an SQLite file stored at `workspace/studio.db`.
- **`Project` Table**: Stores high-level metadata (title, slug, script narrative, illustration style, global voice style, master audio path, structured JSON data).
- **`Scene` Table**: Belongs to a project. Stores individual scene data (`scene_number`, `narration_khmer`, `image_prompt_english`, `audio_path`, `image_path`, and individual task statuses like `idle`, `processing`, `completed`, `failed`).
- **`Character` Table**: Stores global character profiles for voice cloning (`name`, `gender`, `personality_tag`, `reference_text`, `audio_path`).
- **`Setting` Table**: Stores persistent orchestrator configurations (e.g., `active_provider` and `active_slot`).

### 2. Backend API (`backend/main.py`)
- Provides RESTful routes for CRUD operations on Projects, Scenes, and Characters.
- Acts as the dispatcher, writing to the database and dropping generation task payloads into the asynchronous task queue.
- Exposes `workspace/` assets dynamically via a `/static/` router mount.

### 3. Background Task Lifecycle (`backend/queue_worker.py`)
- An infinite background loop (`start_queue_worker`) processes AI generation requests strictly **sequentially**. This single-lane execution pipeline is crucial for preventing out-of-memory (OOM) crashes when managing heavy local GPU models (Image and Audio).
- Handles different task types: `image`, `audio` (bulk project generation), and `audio_single` (targeted granular line regeneration / cloning execution).
- Safely handles failures, updates SQLite states (`processing` -> `completed` / `failed`), and handles database commits and rollbacks.

---

## Core Features & Detailed Engine Integration

### 1. Project Management & AI Orchestration (Overview Tab)
- Defines the core "Raw Research" and "Video Concept".
- Configures global parameters like "Illustration Style" and "Script Narrative".
- **Dynamic Settings Injection**: The sidebar features an "Engine Settings" modal overlay, pulling global state from `GET /api/settings`. The UI allows users to hot-swap between Gemini and Groq, and select which API key slot to use (Slot 1 or Slot 2). 
- **LLM Orchestrator (`backend/services/llm_orchestrator.py`)**: 
  - The backend securely routes API generation events through the orchestrator. It queries the `Setting` SQLite table for the `active_provider` and `active_slot`.
  - It dynamically resolves environment variables (`GEMINI_KEY_1`, `GROQ_KEY_2`, etc.) via `.env` or `.env.local` loaded automatically at boot by `dotenv`. If a variable is missing, it explicitly raises a descriptive `HTTPException` advising the missing key path.
  - Generates structural outputs conforming to rigid aesthetic constraints (e.g., 2D flat vector stickman art, bold clean outlines, and uniform plain solid backgrounds).
- **Orchestrator API Endpoints**:
  - `GET /api/settings` & `PUT /api/settings`: Fetch and save hot-swappable engine preferences (`active_provider`, `active_slot`).
  - `POST /api/projects/{id}/generate-field`: Takes a `field_name` (like `script_narrative` or `structured_json_data`), bundles the current project context (`raw_research` and `video_concept`), passes it to the orchestrator, and immediately commits the generated text/JSON back into the project database.

### 2. Visual Synthesis (Images Tab & `draw_things.py`)
The Images Tab is designed as a three-column workspace for iterative, scene-by-scene visual asset generation using a local Python engine (e.g., Draw Things pipeline).

**Architecture Layout**
- **Column 1: Left List Panel**
  - **Illustration Style Box:** A global configuration input for defining the overarching art style of the project.
  - **Prompts Navigation Deck:** A vertically scrolling list of parsed scenes with green checkmarks indicating successfully generated assets.
- **Column 2: Center Workspace Editor**
  - **Scene Script Segment:** Read-only reference of the translated Khmer script segment for the active scene.
  - **Engine Prompt Configuration:** A textarea for the positive image prompt, featuring auto-save-on-blur.
  - **Acoustic / Negative Constraints:** A textarea for negative prompts (e.g., "watermark, text, bad anatomy").
  - **User Iteration Bar:** An inline input attached to the Gemini API (`/refine`). Users can type natural language instructions to programmatically rewrite the prompt.
- **Column 3: Right Operations Board**
  - **Python Engine Parameters:** Controls for generation properties, including Aspect Ratio grids (1:1, 4:3, 16:9, etc.) and an Inference Steps slider.
  - **Render Output Frame:** The primary display canvas, equipped with a spinning loader during generation and an interactive Lightbox Zoom button upon completion.
  - **Footer Buttons:** Core control row containing Generate, Stop Rendering, and Delete (Trash) operations.

**Backend Communication**
- **`PUT /api/projects/{id}`**: Saves the global `illustration_style` on blur.
- **`POST /api/scenes/{id}/refine`**: Dispatches existing prompts and user instruction to Gemini for intelligent rewrites.
- **`POST /api/scenes/{id}/generate-image`**: Queues the image task passing `aspect_ratio`, `guidance_scale`, and `inference_steps` down to the local Draw Things REST API (`http://127.0.0.1:7860/sdapi/v1/txt2img`).

### 3. Voice Synthesis (Voice Tab & `voice_engine.py`)
The Voice Tab is built as a complex dual-pane orchestrator managing Global Character models and synchronizing them across timeline audio generation using VoxCPM2.

**Architecture Layout**
- **Left Pane: Dual-Tab Factory Architecture**
  - **Tab 1: Character Library (Active Cast View):** Grid displaying all globally saved character profiles mapped from `workspace/shared_characters/`. Features a quick-preview `<audio>` button. Activating a card locks in `selectedCharacterId` and visually highlights it.
  - **Tab 2: Voice Factory (Creation View):** Governed by a top-level mode switcher.
    - *AI Voice Design Mode:* Disables uploads. Exposes parameter chips for Gender, Age, Tone, and Speed. Includes a "Generate Audition Sample" workflow that renders a temporary file and locks the Save button until verified.
    - *Custom Clone Mode:* Hides text parameters. Exposes Character Name, Reference Text, and a drag-and-drop `.wav` upload target.
- **Right Pane: Timeline Progress**
  - **Global Status Monitor:** Persistent tracker (`VOXCPM2: IDLE`) in the panel header.
  - **Timeline Cards & Speaker Badges:** Displays scenes sequentially using strict data mapping to render crisp badges (e.g., `🎙️ Warm Narrator` or a muted "UNASSIGNED LINE" if unassigned).
  - **Batch Operations:** Footer contains "Generate All Lines" (which passes the active character context), "Stop", and "Clear Audio".

**Backend Communication & Pipeline Mechanics**
- **`POST /api/characters/preview`**: Invokes the engine without DB persistence, synthesizing a temporary file (`workspace/shared_characters/temp_preview.wav`).
- **`POST /api/characters`**: Commits a character to SQLite. If in AI Design mode, the backend programmatically promotes `temp_preview.wav` to a permanent slugified path.
- **Strict Cloning Injection (`/generate-voice` & `/generate-audio`)**:
  - Generation endpoints dynamically intercept the `character_id`. When present, they enforce `task_type="audio_single"`, forcing the ML Engine into strict Voice Cloning mode.
  - **VoxCPM2 Engine Mechanics (`voice_engine.py`)**: Employs a **Hot/Cold Memory Lifecycle Manager** to gracefully load/unload the model from VRAM. When running in strict cloning mode, it asserts the physical existence of the reference `.wav` and completely bypasses fallback text-tag logic to guarantee 100% vocal consistency across the scene timeline.
- **Database Synchronization (`queue_worker.py`)**: As audio chunks finish rendering, the worker explicitly updates the `Scene` rows with `character_id`, `character_name`, and `audio_status = "completed"`.

### 4. Output Render (Output Tab)
- A final review UI presenting the synthesized local assets.
- Renders the vertical production timeline binding the physical `.png` visual file and the compiled `.wav` audio track side-by-side for final verification. 
- Serves as the pre-computation verification layout before shipping to external NLEs (Non-Linear Editors) or FFmpeg compositors.

## Environment & Run Context
- Frontend UI should be launched via standard Next.js Turbopack workflows (`npm run dev`).
- The Python Backend **must** be executed within its isolated Conda environment (`conda activate voice`) to ensure correct bindings to tensor libraries and audio compilation libraries (`soundfile`, `numpy`).
