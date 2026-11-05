#!/usr/bin/env bash
set -e

# Resolve gflow binary
GFLOW_BIN="${GFLOW_BIN:-$(command -v gflow 2>/dev/null || echo "gflow")}"

if ! command -v "$GFLOW_BIN" &>/dev/null && [ ! -f "$GFLOW_BIN" ]; then
  echo "Error: gflow binary not found. Please ensure gflow-cli is installed (pip install gflow-cli)."
  exit 1
fi

PORT=${1:-8765}
PROFILE=${2:-cavepaint}

echo "=========================================================="
echo " Starting Google Flow MCP Streamable HTTP Daemon"
echo " Host:     127.0.0.1"
echo " Port:     $PORT"
echo " Profile:  $PROFILE"
echo " Endpoint: http://127.0.0.1:$PORT/mcp"
echo "=========================================================="
echo ""
echo "If this is your first time using profile '$PROFILE', run:"
echo "  $GFLOW_BIN auth login --profile $PROFILE --browser chrome"
echo ""

# Ensure terminal columns default to at least 120 to prevent narrow wrapping
if [ -z "$COLUMNS" ] || [ "$COLUMNS" -lt 80 ]; then
  export COLUMNS=120
fi

exec "$GFLOW_BIN" serve --host 127.0.0.1 --port "$PORT" --profile "$PROFILE"
