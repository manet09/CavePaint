#!/usr/bin/env bash
set -e

PYTHON_BIN="${PYTHON_BIN:-$(command -v python3 || command -v python)}"
PIP_BIN="${PIP_BIN:-$(command -v pip3 || command -v pip)}"
GFLOW_BIN="${GFLOW_BIN:-$(command -v gflow || echo "gflow")}"

echo "Checking for gflow-cli updates..."
$PIP_BIN install --upgrade gflow-cli

echo "Installed version:"
$GFLOW_BIN --version

echo "Updating Playwright Chromium if needed..."
$PYTHON_BIN -m playwright install chromium

echo "Update complete! You can restart your daemon using: ./scripts/start_flow_daemon.sh"
