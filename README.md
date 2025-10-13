# Obsidian MCP Connector

This repository provides an Obsidian plug### Claude Desktop / Other MCP Clients
Configure a direct HTTP server entry pointing to: `http://127.0.0.1:4123/mcp` (or your configured port). No subprocess or extra wrapper is required.

**Notes:**
- Ensure the plugin is enabled first so the server is listening
- Restart the client if it cached an older capability response
- If you enable auth later, add the Bearer token header in the client's MCP config exposes a local Model Context Protocol (MCP) / HTTP connector. It discovers other loaded plugins (Dataview, Templater, Tasks) and registers bridge functions for them. It includes:

- Configurable port number for the local server
- Adapters for Dataview and Tasks
- Example Node.js CLI client
- Unit test framework support

## Security
- The plugin binds to `127.0.0.1` and **does not** listen on external interfaces.
- No authentication is required for local requests as security is provided by network binding restrictions.

## How to build
1. `npm ci`
2. `npm run build`
3. Place `manifest.json` and `main.js` in a new folder under your Obsidian vault's `.obsidian/plugins/obsidian-mcp-connector/`
4. Reload Obsidian and enable the plugin.

## Endpoints
- `POST http://127.0.0.1:<port>/mcp` — send JSON-RPC requests (example: `{ "jsonrpc":"2.0","id":1,"method":"vault.listNotes" }`)
- `GET  http://127.0.0.1:<port>/tools` — returns the list of available tools

The default port is `4123` but can be configured in the plugin settings.

## Example curl

```bash
curl -X POST http://127.0.0.1:4123/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"dataview.query","params":{"query":"TABLE file.name"}}'
```

```bash
curl -X POST http://127.0.0.1:4123/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"vault.listNotes" }'
```

## Development

This plugin is built using TypeScript and includes:
- Source code in the `src/` directory
- Unit tests in the `tests/` directory 
- Build configuration with esbuild for fast compilation
- TypeScript configuration for development

### Testing
Run the test suite with:
```bash
npm test
```

### Building
Build the plugin for development:
```bash
npm run build
```

Watch for changes during development:
```bash
npm run watch
```

## Settings UI & Port Configuration
The plugin includes a Settings tab (Obsidian UI) where you can configure the server port number. The port setting is persisted in Obsidian's plugin data and will take effect when the plugin is reloaded.

## MCP Client Configuration

The HTTP MCP server starts automatically when the plugin is enabled in Obsidian. You do NOT need to run any additional process; HTTP is the only supported transport in this trimmed build.

### How it works:
1. **Obsidian plugin** starts an HTTP server (default port 4123) 
2. **MCP clients** connect directly to the HTTP server
3. **Plugin bridge** translates MCP protocol requests to Obsidian API calls

### **For Claude Code (HTTP - Recommended)**
Direct HTTP connection (no subprocess needed, plugin auto-starts the server on enable):

```bash
# Add HTTP MCP server (replace 4123 with your configured port)
claude mcp add --transport http obsidian-http http://127.0.0.1:4123/mcp

# Or add to project scope for team sharing  
claude mcp add --transport http obsidian-http --scope project http://127.0.0.1:4123/mcp
```


### Claude Desktop / Other MCP Clients
Configure a direct HTTP server entry pointing to: `http://127.0.0.1:4123/mcp` (or your configured port). No subprocess or extra wrapper is required.

Notes:
- Ensure the plugin is enabled first so the server is listening.
- Restart the client if it cached an older capability response.
- If you enable auth later, add the Bearer token header in the client’s MCP config.

## CLI client
A ready-to-run `src/tools/cli-client.js` script is included. You can copy this outside the plugin folder and run it with `node`. Set the environment variable `OBSIDIAN_MCP_PORT` if you've configured a custom port (default is 4123).

## Templater adapter
The adapter tries `renderTemplate`, `run`, `compile`, and finally falls back to a simple interpolation. If you want full Templater execution inside the vault context (e.g. file-based template commands), we'll add a helper to open a temporary file context and run Templater's file-based render APIs.

## Project Structure

```
src/
├── main.ts              # Main plugin entry point
├── mcp-server.ts        # HTTP MCP server implementation
├── plugin-bridge.ts     # Bridge between MCP and Obsidian APIs
├── settings.ts          # Plugin settings and UI
└── tools/               # Tool adapters and utilities
    ├── cli-client.js    # Standalone CLI client
    ├── dataview.ts      # Dataview plugin adapter
    ├── tasks.ts         # Tasks plugin adapter
    └── templater.ts     # Templater plugin adapter
tests/                   # Unit tests
manifest.json           # Obsidian plugin manifest
package.json           # Node.js dependencies and build scripts
tsconfig.json          # TypeScript configuration
```

## Next Steps (Suggested)
- Add richer Dataview response shaping and pagination
- Add a Templater adapter that can execute templates in file contexts
- Add integration tests with a disposable Obsidian environment
- Add optional SSL/TLS support for enhanced security
- Implement MCP `resources` & `prompts` capabilities for richer client UI capability display

## License

This project is licensed under the GNU General Public License v3.0 or later (GPL-3.0-or-later). See the `LICENSE` file for the full text.

Summary (not a substitute for the license):
- You may run, study, share, and modify the code.
- If you distribute modified versions (including over a network if they constitute distribution), they must also be licensed under GPL-3.0-or-later and provide source code.
- No additional restrictions may be applied that contradict the GPL.

If you need a different licensing arrangement (e.g., proprietary embedding without copyleft obligations), you can reach out to discuss dual licensing.