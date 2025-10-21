# Troubleshooting

This guide covers common issues and their solutions.

## Bridge Server Startup Timing ⚠️ IMPORTANT

**The bridge server requires ~30 seconds to become fully ready!**

When the bridge starts, it goes through these phases:
1. **Ports open** (0-2s) - HTTP and WebSocket servers start listening
2. **Waiting for Obsidian** (2-30s) - Bridge waits for the Obsidian plugin to connect
3. **Ready** (30s+) - Bridge can now accept MCP client requests

### Solution: Check readiness before connecting MCP clients

```bash
# Start the bridge
node .obsidian/plugins/mcp-connector/mcp-http-ws-bridge.js

# Check if ready
curl http://127.0.0.1:4125/ready

# Response when ready (200): {"ready":true,"message":"Bridge is ready to accept MCP requests"}
# Response when not ready (503): {"ready":false,"message":"Waiting for Obsidian plugin to connect"}
```

## Bridge Server Not Running

**Symptom:** Plugin shows "❌ Disconnected" in settings

### Solution:

```bash
# Start the bridge server first
node .obsidian/plugins/mcp-connector/mcp-http-ws-bridge.js

# Or in Termux on Android
node ~/mcp-http-ws-bridge.js
```

The plugin will **automatically reconnect** every 5 seconds once the bridge is running.

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

## Check Connection Status

1. Open Obsidian Settings → MCP Connector
2. Look for status indicator:
   - ✅ Connected - Everything working
   - 🔄 Connecting - Attempting connection
   - ❌ Disconnected - Bridge not running

3. Click "Refresh Status" button to manually update

## Port Already in Use

**Symptom:** Error: "EADDRINUSE: address already in use"

### Solution A: Kill existing processes

```bash
# Linux/Mac
lsof -ti:4124 | xargs kill
lsof -ti:4125 | xargs kill

# Windows
netstat -ano | findstr :4124
taskkill /PID <PID> /F
netstat -ano | findstr :4125
taskkill /PID <PID> /F
```

### Solution B: Use custom ports

```bash
# Start with custom ports
node mcp-http-ws-bridge.js --ws-port 8080 --http-port 8081

# Update plugin WebSocket URL to match
# Settings → ws://127.0.0.1:8080/mcp

# Update MCP client URL
# http://127.0.0.1:8081/mcp
```

## Can't Connect from Android

**Symptom:** Android device can't connect to bridge running on desktop

### Solution:

```bash
# 1. Check your computer's IP address
ipconfig  # Windows
ifconfig  # Mac/Linux

# 2. Start bridge with network access
node mcp-http-ws-bridge.js --host 0.0.0.0

# 3. Ensure firewall allows connections on ports 4124 and 4125

# 4. In Obsidian mobile settings
# WebSocket URL: ws://YOUR_COMPUTER_IP:4124/mcp
```

### Firewall Configuration

**Windows:**
```bash
# Allow incoming connections
netsh advfirewall firewall add rule name="MCP WS" dir=in action=allow protocol=TCP localport=4124
netsh advfirewall firewall add rule name="MCP HTTP" dir=in action=allow protocol=TCP localport=4125
```

**macOS:**
```bash
# System Preferences → Security & Privacy → Firewall → Firewall Options
# Add node to allowed applications
```

**Linux (ufw):**
```bash
sudo ufw allow 4124/tcp
sudo ufw allow 4125/tcp
```

## Android Emulator Connection

**Symptom:** Can't connect from Android emulator to bridge on host

### Solution:

Use special IP `10.0.2.2` to access host machine:

```
WebSocket URL: ws://10.0.2.2:4124/mcp
MCP URL: http://10.0.2.2:4125/mcp
```

## Plugin Not Loading in Obsidian

**Symptom:** Plugin doesn't appear in Settings → Community plugins

### Solution:

1. **Check plugin directory structure:**
```
.obsidian/plugins/mcp-connector/
├── main.js
├── manifest.json
├── mcp-http-ws-bridge.js
└── ...
```

2. **Verify manifest.json is valid:**
```bash
cat .obsidian/plugins/mcp-connector/manifest.json
```

3. **Reload Obsidian:**
   - Ctrl+R (Windows/Linux)
   - Cmd+R (macOS)

4. **Check developer console for errors:**
   - View → Toggle Developer Tools → Console

## MCP Client Can't Connect

**Symptom:** `claude mcp add` fails or times out

### Checklist:

1. **Wait for bridge to be ready (30 seconds):**
```bash
curl http://127.0.0.1:4125/ready
```

2. **Check bridge is running:**
```bash
curl http://127.0.0.1:4125/health
```

3. **Verify Obsidian plugin is connected:**
   - Settings → MCP Connector → Status should show ✅ Connected

4. **Test with curl:**
```bash
curl -X POST http://127.0.0.1:4125/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"vault.listNotes"}'
```

## Tasks Not Saving

**Symptom:** `tasks.create` returns success but task doesn't appear

### Solution:

1. **Check file exists:**
```bash
# If file doesn't exist, it will be created
# Verify the path is correct
```

2. **Check file permissions:**
```bash
ls -la path/to/file.md
```

3. **Verify task format in console:**
   - View → Toggle Developer Tools → Console
   - Look for task creation logs

4. **Check for write errors:**
   - Look for "Error writing task" in console

## Dataview Plugin Not Found

**Symptom:** "Dataview plugin not found" error

### Solution:

1. **Install Dataview plugin:**
   - Settings → Community plugins → Browse
   - Search for "Dataview"
   - Install and enable

2. **Reload Obsidian:**
   - Ctrl+R (Windows/Linux)
   - Cmd+R (macOS)

3. **Verify Dataview is enabled:**
   - Settings → Community plugins → Dataview should be toggled on

## WebSocket Connection Drops

**Symptom:** Connection status changes from ✅ to ❌ frequently

### Solution:

1. **Check bridge logs for errors:**
```bash
# If running in foreground, watch console output
# If in background, check log file
tail -f ~/bridge.log  # If using nohup
```

2. **Increase reconnect interval (if needed):**
   - Edit `src/mcp-websocket.ts`
   - Increase `RECONNECT_INTERVAL` from 5000ms

3. **Check network stability:**
   - If on WiFi, ensure strong signal
   - Try wired connection if available

## Task Metadata Not Parsing

**Symptom:** Task metadata like `[due:: 2025-01-15]` not recognized

### Solution:

1. **Use correct format:**
   - `[key:: value]` (note the space after ::)
   - NOT `[key::value]` or `[key: value]`

2. **Use uppercase for priority:**
   - `[priority:: HIGH]` ✅
   - NOT `[priority:: high]` ❌

3. **Use ISO date format:**
   - `[due:: 2025-01-15]` ✅
   - NOT `[due:: 15-01-2025]` ❌

4. **Verify Dataview is installed and enabled**

## Bridge Server Crashes

**Symptom:** Bridge server exits unexpectedly

### Solution:

1. **Check Node.js version:**
```bash
node --version
# Requires Node.js 14 or higher
```

2. **Check for missing dependencies:**
```bash
npm install ws
```

3. **Run with error logging:**
```bash
node mcp-http-ws-bridge.js 2>&1 | tee bridge.log
```

4. **Check for port conflicts:**
```bash
# See "Port Already in Use" section above
```

## Termux-Specific Issues

### Permission Denied

```bash
# Grant storage permission
termux-setup-storage

# Check permissions
ls -la ~/storage/shared/
```

### Node.js Not Found

```bash
# Install Node.js
pkg update && pkg upgrade
pkg install nodejs

# Verify installation
node --version
npm --version
```

### Bridge Won't Start in Background

```bash
# Use nohup and redirect output
nohup node ~/mcp-http-ws-bridge.js > ~/bridge.log 2>&1 &

# Check if running
ps aux | grep mcp-http-ws-bridge

# View logs
tail -f ~/bridge.log
```

### Auto-start Not Working

1. **Verify Termux:Boot is installed:**
   - Install from F-Droid

2. **Check boot script permissions:**
```bash
chmod +x ~/.termux/boot/start-bridge.sh
```

3. **Test boot script manually:**
```bash
~/.termux/boot/start-bridge.sh
```

4. **Reboot device and check:**
```bash
ps aux | grep mcp-http-ws-bridge
```

## Getting Help

If you encounter issues not covered here:

1. **Check the logs:**
   - Obsidian: View → Toggle Developer Tools → Console
   - Bridge: Terminal output or log file

2. **Test with minimal setup:**
   - Create fresh test vault
   - Install only MCP Connector
   - Test basic connection

3. **Verify versions:**
```bash
node --version
npm --version
# Check Obsidian version in Help → About
```

4. **Report the issue:**
   - GitHub Issues: https://github.com/your-repo/issues
   - Include: OS, Node version, logs, steps to reproduce
