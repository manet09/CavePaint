# CavePaint Video Studio

CavePaint is a local AI-powered video and content creation studio designed to transform research and concept drafts into audio-visual timelines. It integrates LLM orchestrators (Gemini & Groq), image synthesis engines (Google Flow MCP & Draw Things), and local voice cloning/synthesis (VoxCPM2).

---

## Quick Start (How to Run)

The easiest way to start all services (Backend API, Next.js Frontend, and Google Flow MCP daemon) is using the unified startup script:

```bash
./start.sh
```

### What this does automatically:
1. **Activates Conda Environment:** Automatically finds and activates the `voice` Conda environment.
2. **Pre-flight Checks:** Verifies dependencies (`python`, `uvicorn`, `npm`, `node`, `gflow`) and checks port availability.
3. **Starts All 3 Services Concurrently:**
   - **GFlow MCP Daemon:** `http://127.0.0.1:8765/mcp` (using profile `cavepaint`)
   - **Backend API (FastAPI):** `http://localhost:8000` (Interactive API docs at `http://localhost:8000/docs`)
   - **Frontend Studio (Next.js):** `http://localhost:3000`
4. **Unified Logging:** Streams logs from all services in a single terminal with color-coded prefixes (`[backend]`, `[frontend]`, `[gflow]`).
5. **Clean Shutdown:** Press <kbd>Ctrl</kbd> + <kbd>C</kbd> at any time to gracefully terminate all services and clear ports.

---

## Startup Options & Flags

| Command | Description |
|---|---|
| `./start.sh` | Launch all 3 services concurrently in the current terminal (default). |
| `./start.sh --tabs` | Open each service in its own macOS Terminal tab/window. |
| `./start.sh -k` or `./start.sh --kill` | Force kill any stale processes occupying ports `8000`, `3000`, or `8765` before launching. |
| `./start.sh --no-gflow` | Start only the Backend and Frontend (skip Google Flow daemon). |
| `./start.sh --no-backend` | Start only Frontend and Google Flow daemon. |
| `./start.sh --no-frontend` | Start only Backend and Google Flow daemon. |
| `./start.sh -h` or `./start.sh --help` | Display command-line usage and help. |

---

## Manual Startup (Alternative)

If you prefer to run each service manually in separate terminal tabs:

### Terminal 1: Flow Daemon (MCP Server)
```bash
./scripts/start_flow_daemon.sh
```
*Runs on `127.0.0.1:8765` using profile `cavepaint`.*

### Terminal 2: Backend API
```bash
conda activate voice
uvicorn backend.main:app --reload --port 8000
```
*FastAPI backend running at `http://localhost:8000`.*

### Terminal 3: Frontend Studio
```bash
cd frontend && npm run dev
```
*Next.js application running at `http://localhost:3000`.*

---

## Architecture & Ports

- **Frontend:** Next.js 16 (Turbopack), React 19, Tailwind CSS (`http://localhost:3000`)
- **Backend API:** FastAPI running under Python 3.10+ in Conda env `voice` (`http://localhost:8000`)
- **Google Flow MCP Daemon:** `gflow-cli` HTTP MCP server on port `8765` (`http://127.0.0.1:8765/mcp`)
- **Database:** SQLite database located at `workspace/studio.db`
- **File Assets:** Local physical assets managed under `workspace/`

For detailed setup instructions, troubleshooting, and Google authentication guides, see [FLOW_SETUP_GUIDE.md](file://./FLOW_SETUP_GUIDE.md).
