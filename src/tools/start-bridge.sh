#!/bin/bash
# Start the MCP WebSocket Bridge Server
# This script kills any existing bridge process before starting a new one

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIDGE_SCRIPT="$SCRIPT_DIR/mcp-http-ws-bridge.js"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}[Bridge] Checking for existing bridge processes...${NC}"

# Find and kill existing node processes running the bridge
EXISTING_PIDS=$(pgrep -f "mcp-http-ws-bridge.js")

if [ -n "$EXISTING_PIDS" ]; then
    echo -e "${YELLOW}[Bridge] Found existing bridge process(es): $EXISTING_PIDS${NC}"
    echo -e "${YELLOW}[Bridge] Killing existing processes...${NC}"

    for PID in $EXISTING_PIDS; do
        kill "$PID" 2>/dev/null
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}[Bridge] Killed process $PID${NC}"
        else
            echo -e "${RED}[Bridge] Failed to kill process $PID (may need sudo)${NC}"
        fi
    done

    # Wait a moment for processes to terminate
    sleep 1
else
    echo -e "${GREEN}[Bridge] No existing bridge processes found${NC}"
fi

# Start the bridge server
echo -e "${GREEN}[Bridge] Starting WebSocket bridge server...${NC}"
echo -e "${YELLOW}[Bridge] Script location: $BRIDGE_SCRIPT${NC}"

# Check if the bridge script exists
if [ ! -f "$BRIDGE_SCRIPT" ]; then
    echo -e "${RED}[Bridge] Error: Bridge script not found at $BRIDGE_SCRIPT${NC}"
    exit 1
fi

# Start the server
node "$BRIDGE_SCRIPT"
