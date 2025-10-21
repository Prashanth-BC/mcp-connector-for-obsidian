#!/bin/bash

# MCP Connector Workspace Launcher
# Starts the bridge server and Claude Code in separate tmux sessions

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIDGE_SCRIPT="${SCRIPT_DIR}/.obsidian/plugins/mcp-connector/start-bridge.sh"
SESSION_NAME="mcp-workspace"

echo "========================================="
echo "MCP Connector Workspace Launcher"
echo "========================================="
echo ""

# Check for tmux
if ! command -v tmux &> /dev/null; then
    echo "Error: tmux is not installed."
    echo "Please install tmux:"
    echo "  - Ubuntu/Debian: sudo apt install tmux"
    echo "  - macOS: brew install tmux"
    echo "  - Fedora: sudo dnf install tmux"
    exit 1
fi

# Check for claude
if ! command -v claude &> /dev/null; then
    echo "Error: Claude Code CLI is not installed."
    echo "Please install Claude Code from: https://claude.ai/code"
    exit 1
fi

# Check if bridge script exists
if [ ! -f "$BRIDGE_SCRIPT" ]; then
    echo "Error: Bridge script not found at: $BRIDGE_SCRIPT"
    echo "Please ensure the MCP Connector plugin is installed in this vault."
    exit 1
fi

# Kill existing session if it exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "Stopping existing workspace session..."
    tmux kill-session -t "$SESSION_NAME"
fi

echo "Starting MCP Connector workspace..."
echo ""

# Create new tmux session with bridge server
tmux new-session -d -s "$SESSION_NAME" -n "bridge" "bash -c '$BRIDGE_SCRIPT; echo; echo \"Bridge stopped. Press any key to exit.\"; read'"

# Create second window for Claude Code
tmux new-window -t "$SESSION_NAME" -n "claude" "bash -c 'echo \"Waiting for bridge to start...\"; sleep 3; clear; claude; echo; echo \"Claude Code stopped. Press any key to exit.\"; read'"

# Split the bridge window to show logs
tmux select-window -t "$SESSION_NAME:bridge"
tmux split-window -v -t "$SESSION_NAME:bridge" "bash -c 'echo \"=== Bridge Server Logs ===\"'; echo \"Monitoring bridge server...\"; echo; tail -f ~/.local/state/mcp-connector/bridge.log 2>/dev/null || echo \"Log file not available yet\"; read'"

# Resize the split (give more space to the bridge output)
tmux resize-pane -t "$SESSION_NAME:bridge.1" -y 10

echo "✓ Workspace started successfully!"
echo ""
echo "Tmux session '$SESSION_NAME' created with:"
echo "  - Window 1 (bridge): Bridge server with logs"
echo "  - Window 2 (claude): Claude Code CLI"
echo ""
echo "Commands:"
echo "  tmux attach -t $SESSION_NAME    # Attach to workspace"
echo "  tmux kill-session -t $SESSION_NAME    # Stop workspace"
echo ""
echo "Tmux shortcuts (after attaching):"
echo "  Ctrl+B then 1    # Switch to bridge window"
echo "  Ctrl+B then 2    # Switch to Claude window"
echo "  Ctrl+B then [    # Scroll mode (q to exit)"
echo "  Ctrl+B then d    # Detach (keeps running)"
echo ""
echo "Attaching to workspace in 2 seconds..."
sleep 2

# Attach to the Claude window by default
tmux select-window -t "$SESSION_NAME:claude"
tmux attach-session -t "$SESSION_NAME"
