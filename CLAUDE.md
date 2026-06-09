# CavePaint (video_studio) Project Status & Developer Guide

This document provides a comprehensive overview of the CavePaint project architecture, UI components, backend integration, and the remaining tasks. It is designed to onboard other autonomous agents or developers to quickly understand the codebase and pick up where the last agent left off.

## Architecture Overview
CavePaint is a local content creation engine designed to synthesize videos from scripts using AI. 

1. **Frontend (Next.js + React + Tailwind CSS)**:
   - A desktop-like workspace UI built with responsive layout and dark/light modes.
   - Centralized React Context (`app/context/ProjectContext.tsx`) manages global state, active projects, active scenes, and fetching data.
   - Component-driven architecture within `app/components`.
   
2. **Backend (FastAPI + Python + SQLite)**:
   - Located in the `backend/` directory. `main.py` serves as the primary router and orchestrator.
   - Uses SQLAlchemy (`database.py`) for the `Project` and `Scene` schemas.
   - Employs a background `asyncio.Queue` worker (`queue_worker.py`) to process sequential, long-running ML tasks locally (to prevent blocking the UI).
   - Serves generated static files from the `workspace/` directory via `app.mount("/static", ...)`.

---

## UI Components & Backend Integration

The frontend UI consists of the main layout (`app/page.tsx`) wrapping a `Sidebar` and 4 main workspace tabs. 

### 1. `Sidebar.tsx`
- **Purpose**: Project management sidebar. Shows a list of past projects and handles the creation of new ones. Manages the app theme toggle and collapse state.
- **Backend Communication**:
  - `GET /api/projects` (via Context) to list projects.
  - `POST /api/projects` to create a new project.
- **Status**: Mostly functional. The "Settings" button and project context menus ("Rename", "Duplicate", "Delete") are currently UI mockups and need wiring.

### 2. `OverviewTab.tsx`
- **Purpose**: A high-density 3-column workspace for data entry. Allows users to input raw research, write narrative scripts, define visual concepts, audio styles, and view structured JSON output.
- **Backend Communication**:
  - Auto-saves on input `onBlur` using `PUT /api/projects/{project_id}`.
- **Status**: The magic wand (`<Wand2 />`) buttons on the Video Concept, Script, Illustration Style, Vocal Parameters, and JSON panels are UNWIRED. They need to be connected to generation/parsing endpoints (like `/api/projects/{project_id}/parse`).

### 3. `ImagesTab.tsx`
- **Purpose**: An asymmetrical workspace for generating and refining images per scene. 
  - **Left**: Navigation deck for parsed scenes and global style reference.
  - **Center**: Editor for refining image prompts and setting negative/acoustic constraints.
  - **Right**: Operations board for engine parameters (Aspect Ratio, Guidance Scale, Inference Steps) and rendering output preview.
- **Backend Communication**:
  - `POST /api/scenes/{scene_id}/refine` (refines the prompt based on user instructions).
  - `POST /api/scenes/{scene_id}/generate-image` (triggers generation worker).
  - `DELETE /api/scenes/{scene_id}/image` (deletes the generated asset).
- **Status**: Functional, but the "Negative Prompt" textarea isn't being saved or passed to the backend payload. Backend integration for generation requires the `queue_worker.py` to be running.

### 4. `VoiceTab.tsx`
- **Purpose**: UI to sequence Khmer text-to-speech tasks and manage model VRAM loading.
- **Backend Communication**:
  - `POST /api/model/load` and `POST /api/model/unload` to manage model state.
  - `PUT /api/projects/{project_id}` to save the Global Voice Style.
  - `POST /api/projects/{project_id}/generate-voice` to queue all scene scripts for audio generation.
- **Status**: Functional on frontend. The backend `voice_engine.py` is currently mocking the generation (sine waves).

### 5. `OutputTab.tsx`
- **Purpose**: A vertical production timeline mapping out the final rendered assets (image + audio) for each scene. 
- **Backend Communication**: Strictly reads from the project context and serves static files from `http://localhost:8000/static/...`.
- **Status**: Displays components per scene, but lacks a centralized final video compilation.

---

## What is Still Missing (Remaining Tasks)

If you are picking up this project, prioritize the following tasks:

### 1. UI Integrations & Wiring
- **OverviewTab Wands**: Wire the `<Wand2 />` buttons in `OverviewTab.tsx`. These should trigger backend generation/parsing endpoints (e.g. hooking up to `/api/projects/{project_id}/parse` to structure the JSON scenes).
- **Sidebar Actions**: Implement the logic for project "Rename", "Duplicate", and "Delete" in the sidebar's dropdown menu.
- **Global Settings Modal**: Wire the "Settings" button in `Sidebar.tsx` to open a modal that configures API keys, toggles local/remote model execution, or customizes local API ports.
- **ImagesTab Adjustments**: Ensure the `negative_prompt` from the UI is correctly persisted to the database and passed to the generation backend payload.
- **Final Video Player**: Update `OutputTab.tsx` to feature an overarching video player that previews the stitched `.mp4` video output instead of just a vertical list of disjointed assets.

### 2. Backend Implementations
- **Video Compilation Service**: There is no logic or endpoint to stitch the sequenced image and audio assets together into a final `.mp4` video. Implement a service utilizing `FFmpeg` to combine the assets sequentially based on their scene order.
- **True Text-to-Speech Engine**: Replace the mocked generation in `voice_engine.py` with an actual VoxCPM or equivalent Khmer text-to-speech model.
- **Configuration / Secrets Management**: Implement a centralized configuration manager (e.g., using `pydantic-settings` or `.env` files) to handle API keys for Gemini and endpoints for Draw Things.
- **Database Schema Update**: Add a `negative_prompt` column to the `Scene` model in `database.py` and ensure the API updates it.
