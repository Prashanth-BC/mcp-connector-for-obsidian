# Obsidian MCP Connector

Connect your Obsidian vault to AI assistants and automation tools through the Model Context Protocol (MCP). This plugin enables seamless integration between your knowledge base and MCP-compatible clients like Claude Code.

## Why Use This Plugin?

- **AI-Powered Knowledge Management**: Let AI assistants read, search, and manage your notes
- **Advanced Task Management**: Create, edit, and track tasks with rich metadata using natural language
- **Dataview Integration**: Execute powerful queries to surface insights from your vault
- **Cross-Platform**: Works on Windows, macOS, Linux, and Android (self-contained on device)
- **Privacy-First**: Runs entirely on your local machine - no cloud services required
- **Auto-Reconnection**: Robust connection handling with automatic recovery

## Key Features

### Task Management
- ✅ Full CRUD operations with Dataview metadata support
- ✅ Priority levels, due dates, tags, and custom fields
- ✅ Auto-generated unique task IDs for tracking
- ✅ Recurring tasks and event scheduling
- ✅ Smart search by text, priority, tags, and dates
- ✅ Subtask management with proper indentation

### Dataview Integration
- ✅ Execute TABLE, LIST, and TASK queries
- ✅ Access page metadata and inline fields
- ✅ Complex filtering with WHERE/FROM/SORT clauses
- ✅ Structured and markdown output formats

### Vault Operations
- ✅ List, read, and search notes
- ✅ File metadata access
- ✅ Path-based organization
- ✅ Full-text search capabilities

## How It Works

The plugin uses a **unified WebSocket architecture** that works across all platforms:

```
MCP Client (Claude Code) ←→ Bridge Server ←→ Obsidian Plugin ←→ Your Vault
    (HTTP/MCP)                (WebSocket)        (Obsidian API)
```

1. **Bridge Server** runs locally and translates between HTTP/MCP and WebSocket protocols
2. **Obsidian Plugin** connects to the bridge and exposes vault operations as MCP tools
3. **MCP Clients** like Claude Code can then interact with your vault through natural language

**Supported Platforms:**
- ✅ Windows, macOS, Linux (full desktop support)
- ✅ Android (self-contained with Termux)
- ⚠️ iOS (requires external bridge server)

## Quick Start

### 1. Install the Plugin

```bash
# Build the plugin
npm ci
npm run build

# Copy to your vault
cp -r mcp-connector /path/to/vault/.obsidian/plugins/
```

Enable the plugin in Obsidian Settings → Community plugins → MCP Connector

### 2. Start the Bridge Server

```bash
# Linux/Mac
.obsidian/plugins/mcp-connector/start-bridge.sh

# Windows
.obsidian\plugins\mcp-connector\start-bridge.cmd

# Wait for: [WS Bridge] ✅ Obsidian plugin connected - Bridge is now READY
```

### 3. Connect Your MCP Client

```bash
# Claude Code
claude mcp add --transport http obsidian http://127.0.0.1:4125/mcp

# Or configure in .mcp.json
{
  "mcpServers": {
    "obsidian": {
      "url": "http://127.0.0.1:4125/mcp"
    }
  }
}
```

### 4. Start Using It!

Ask your AI assistant to:
- "List all my tasks with high priority"
- "Search my notes for references to machine learning"
- "Create a task to review the project plan by Friday"
- "Show me all notes in the Projects folder"

## Use Cases

### For Knowledge Workers
- **AI-Assisted Research**: Let AI assistants help you explore and connect ideas across your vault
- **Smart Task Management**: Create and organize tasks using natural language
- **Automated Workflows**: Build automation scripts that interact with your notes

### For Developers
- **Project Documentation**: Query project notes and technical documentation programmatically
- **Issue Tracking**: Manage development tasks with rich metadata
- **Code Integration**: Connect your code with your knowledge base

### For Students
- **Study Management**: Track assignments, readings, and deadlines
- **Research Organization**: Query and organize research notes efficiently
- **Note Synthesis**: Let AI help you connect concepts across your notes

## Documentation

- **[Architecture](docs/ARCHITECTURE.md)** - Technical details and system design
- **[Setup Guide](docs/SETUP.md)** - Installation and platform-specific configuration
- **[Tool Reference](docs/TOOLS.md)** - Complete API documentation for all MCP tools
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions

## Development

### Building

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
npm test
```

### Project Structure

```
src/
├── main.ts                        # Main plugin entry point
├── mcp-websocket.ts               # WebSocket transport
├── plugin-bridge.ts               # Tool registration and routing
├── settings.ts                    # Plugin settings UI
└── tools/                         # Tool adapters
    ├── mcp-http-ws-bridge.js      # Bridge server
    ├── dataview.ts                # Dataview integration
    └── tasks.ts                   # Task management
```

## Contributing

Contributions are welcome! Whether it's:
- 🐛 Bug reports and fixes
- ✨ Feature requests and implementations
- 📚 Documentation improvements
- 🧪 Test coverage enhancements

Please feel free to open issues or submit pull requests.

## License

This project is licensed under the GNU General Public License v3.0 or later (GPL-3.0-or-later).

**Summary:**
- ✅ Run, study, share, and modify the code freely
- ✅ Distribute modified versions with source code under GPL-3.0-or-later
- ❌ Apply additional restrictions that contradict the GPL

For alternative licensing arrangements, please reach out to discuss dual licensing options.

## Acknowledgments

Built with:
- [Obsidian](https://obsidian.md) - The extensible knowledge base
- [Model Context Protocol](https://modelcontextprotocol.io) - AI integration standard
- [Dataview](https://github.com/blacksmithgu/obsidian-dataview) - Powerful query engine for Obsidian