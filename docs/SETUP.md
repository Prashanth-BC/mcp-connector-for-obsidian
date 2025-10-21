# Setup Guide

This guide covers installation, configuration, and platform-specific setup instructions.

## Installation

### 1. Build the Plugin

```bash
npm ci
npm run build
```

This creates the `mcp-connector/` directory containing:
- `main.js` - Bundled plugin code
- `mcp-http-ws-bridge.js` - Bridge server
- `manifest.json` - Plugin manifest
- `start-bridge.sh` / `start-bridge.cmd` - Startup scripts

### 2. Install in Obsidian

Copy the `mcp-connector/` folder to your vault's `.obsidian/plugins/` directory:

```bash
# Example
cp -r mcp-connector /path/to/your/vault/.obsidian/plugins/
```

Then:
1. Open Obsidian
2. Go to Settings → Community plugins
3. Enable "MCP Connector"

## Quick Start

### 1. Start the Bridge Server

**IMPORTANT:** The bridge needs 30 seconds to fully start before MCP clients can connect.

```bash
# Linux/Mac - Use the startup script (kills existing processes automatically)
.obsidian/plugins/mcp-connector/start-bridge.sh

# Windows - Use the startup script (kills existing processes automatically)
.obsidian\plugins\mcp-connector\start-bridge.cmd

# Or start manually
node .obsidian/plugins/mcp-connector/mcp-http-ws-bridge.js

# Wait for: [WS Bridge] ✅ Obsidian plugin connected - Bridge is now READY
```

### 2. Configure Obsidian Plugin

- Open Obsidian Settings → MCP Connector
- WebSocket URL: `ws://127.0.0.1:4124/mcp` (default)
- Reload plugin if needed

### 3. Connect MCP Client

```bash
# Add to Claude Code (after 30 seconds!)
claude mcp add --transport http obsidian http://127.0.0.1:4125/mcp
```

Or in `.mcp.json`:
```json
{
  "mcpServers": {
    "obsidian": {
      "url": "http://127.0.0.1:4125/mcp",
      "description": "Obsidian vault access via WebSocket bridge..."
    }
  }
}
```

### 4. Test It

```bash
# List all notes
curl -X POST http://127.0.0.1:4125/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"vault.listNotes"}'

# Query with Dataview
curl -X POST http://127.0.0.1:4125/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"dataview.query","params":{"query":"TABLE file.name"}}'

# List tasks with metadata
curl -X POST http://127.0.0.1:4125/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tasks.list","params":{"status":"todo"}}'
```

## Platform-Specific Setup

### Option A: Desktop (Windows/macOS/Linux)

**1. Install dependencies**
```bash
cd /path/to/mcp-connector-for-obsidian
npm install ws
```

**2. Start the bridge server**
```bash
# Local only
node src/tools/mcp-http-ws-bridge.js

# Allow WiFi connections from Android
node src/tools/mcp-http-ws-bridge.js --host 0.0.0.0
```

**3. Configure Obsidian plugin**
- Settings → MCP Connector
- WebSocket URL: `ws://127.0.0.1:4124/mcp`

**4. Configure MCP client**
```bash
claude mcp add --transport http obsidian http://127.0.0.1:4125/mcp
```

### Option B: Android with Termux (Recommended)

Run the bridge **directly on your Android device** - no separate computer needed!

**1. Install Termux and Node.js**
```bash
# In Termux app (download from F-Droid, not Play Store)
pkg update && pkg upgrade
pkg install nodejs
```

**2. Get storage permission**
```bash
termux-setup-storage
```

**3. Copy bridge script and install dependencies**
```bash
# Navigate to your Obsidian vault (adjust path)
cd ~/storage/shared/Documents/ObsidianVault

# Copy the bridge script
cp .obsidian/plugins/mcp-connector/mcp-http-ws-bridge.js ~/

# Install WebSocket library
cd ~
npm install ws
```

**4. Start the bridge server**
```bash
# Start normally (keeps terminal open)
node ~/mcp-http-ws-bridge.js

# Or run in background
nohup node ~/mcp-http-ws-bridge.js > ~/bridge.log 2>&1 &

# Check if running
ps aux | grep mcp-http-ws-bridge
```

**5. Configure Obsidian plugin**
- Settings → MCP Connector
- WebSocket URL: `ws://127.0.0.1:4124/mcp`
- Reload plugin

**6. Configure MCP client**
```bash
claude mcp add --transport http obsidian-mobile http://127.0.0.1:4125/mcp
```

**7. Optional: Auto-start with Termux:Boot**
```bash
# Install Termux:Boot from F-Droid
mkdir -p ~/.termux/boot
cat > ~/.termux/boot/start-bridge.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock
node ~/mcp-http-ws-bridge.js > ~/bridge.log 2>&1 &
EOF
chmod +x ~/.termux/boot/start-bridge.sh
```

### Option C: iOS (Limited Support)

iOS requires running the bridge server on a separate device (computer or Android device with Termux).

**1. Start bridge on computer/Android**
```bash
# On computer - allow network access
node src/tools/mcp-http-ws-bridge.js --host 0.0.0.0

# On Android with Termux
node ~/mcp-http-ws-bridge.js --host 0.0.0.0
```

**2. Configure Obsidian plugin (iOS)**
- Settings → MCP Connector
- WebSocket URL: `ws://YOUR_SERVER_IP:4124/mcp`
  - Replace `YOUR_SERVER_IP` with the IP of your computer/Android device
  - Both devices must be on the same WiFi network

**3. Configure MCP client**
```bash
claude mcp add --transport http obsidian-ios http://YOUR_SERVER_IP:4125/mcp
```

## Configuration Options

### Bridge Server Options

```bash
node mcp-http-ws-bridge.js [options]

Options:
  --ws-port <port>     WebSocket port (default: 4124)
  --http-port <port>   HTTP port (default: 4125)
  --host <address>     Bind address (default: 127.0.0.1)
                       Use 0.0.0.0 for network access
```

### Custom Ports Example

```bash
# Use custom ports
node mcp-http-ws-bridge.js --ws-port 8080 --http-port 8081

# Update plugin WebSocket URL to match
# Settings → ws://127.0.0.1:8080/mcp
```

## Connection Order

The plugin has built-in auto-reconnect, so **start order doesn't matter**:

✅ **Option 1: Bridge first, then plugin**
```
1. Start bridge server
2. Open Obsidian (plugin auto-connects)
```

✅ **Option 2: Plugin first, then bridge**
```
1. Open Obsidian (plugin shows disconnected)
2. Start bridge server (plugin auto-reconnects in ~5s)
```

## Network Configuration

### Same Device
```
WebSocket: ws://127.0.0.1:4124/mcp
HTTP: http://127.0.0.1:4125/mcp
```

### Android on WiFi (accessing desktop bridge)
```bash
# Find your computer's IP
ipconfig  # Windows
ifconfig  # Mac/Linux

# Configure plugin
WebSocket: ws://YOUR_COMPUTER_IP:4124/mcp
```

### Android Emulator (accessing host)
```
WebSocket: ws://10.0.2.2:4124/mcp
HTTP: http://10.0.2.2:4125/mcp
```

## Development Setup

### Building for Development

```bash
# Install dependencies
npm ci

# Build once
npm run build

# Watch for changes
npm run watch
```

### Testing

```bash
# Run test suite
npm test
```

### Directory Structure After Build

```
.obsidian/plugins/mcp-connector/
├── main.js                      # Bundled plugin
├── manifest.json                # Plugin manifest
├── mcp-http-ws-bridge.js        # Bridge server
├── start-bridge.sh              # Linux/Mac startup
└── start-bridge.cmd             # Windows startup
```
