#!/usr/bin/env bash
set -e

PYTHON_BIN="python3"
PIP_BIN="pip"
GFLOW_BIN="gflow"

echo "Checking for gflow-cli updates..."
$PIP_BIN install --upgrade gflow-cli

echo "Installed version:"
$GFLOW_BIN --version

echo "Updating Playwright Chromium if needed..."
$PYTHON_BIN -m playwright install chromium

echo "Update complete! You can restart your daemon using: ./scripts/start_flow_daemon.sh"
