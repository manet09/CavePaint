# CavePaint Video Studio

CavePaint is a local AI video studio that helps you turn research and story concepts into fully illustrated, voiced explainer videos. It combines LLM scripting, image generation (cloud or local), and voice synthesis in a scene-by-scene timeline.

---

## Features

- **Brainstorming & Scripting**: Draft narrative scripts and scene breakdowns with Gemini or Groq.
- **Image Generation**: Create scene visuals using Google Flow (cloud) or Draw Things (local Stable Diffusion).
- **Voice Synthesis**: Generate narration audio for each scene with local voice cloning (VoxCPM2).
- **Interactive Timeline**: Arrange scenes, preview audio, swap image variants, and export.

---

## Quick Start

### 1. Configure Keys
```bash
cp .env.example .env.local
# Open .env.local and add your GEMINI_KEY_1 or GROQ_KEY_1
```

### 2. Start Backend (Terminal 1)
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

### 3. Start Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser!

---

## Detailed Setup & Image Engines

For a complete beginner-friendly guide covering prerequisites, Draw Things (local SD), Google Flow MCP, and troubleshooting, read **[SETUP.md](./SETUP.md)**.

---

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: FastAPI, SQLite, SQLAlchemy
- **AI Integrations**: Gemini, Groq, Google Flow MCP, Draw Things, VoxCPM2
