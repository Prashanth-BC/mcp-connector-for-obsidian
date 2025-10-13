import * as http from "http";
import { PluginBridge } from "./plugin-bridge";

export interface McpServerOptions { 
  host?: string; 
  port?: number;
  authToken?: string; // Optional bearer token for authentication
}

export class McpServer {
  private server?: http.Server;
  private bridge: PluginBridge;
  private opts: McpServerOptions;

  constructor(bridge: PluginBridge, opts?: McpServerOptions) {
    this.bridge = bridge;
    this.opts = Object.assign({ host: "127.0.0.1", port: 4123 }, opts || {});
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        console.log(`[MCP Server] ${req.method} ${req.url}`);

        // Check authentication if token is configured
        if (this.opts.authToken && !this.isAuthenticated(req)) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32600,
              message: "Authentication required. Please provide Bearer token in Authorization header."
            }
          }));
          return;
        }

        if (req.method === "POST" && (req.url === "/" || req.url === "/mcp")) {
          let body = "";
          req.on("data", chunk => (body += chunk.toString()));
          req.on("end", async () => {
            try {
              console.log(`[MCP Server] Request body: ${body}`);
              const request = JSON.parse(body);
              
              // Check if this is an MCP protocol request or JSON-RPC
              if (this.isMcpRequest(request)) {
                console.log(`[MCP Server] Handling MCP request: ${request.method}`);
                const mcpResponse = await this.handleMcpRequest(request);
                if (mcpResponse) {
                  res.writeHead(200, { "Content-Type": "application/json" });
                  res.end(JSON.stringify(mcpResponse));
                } else {
                  res.writeHead(200, { "Content-Type": "application/json" });
                  res.end();
                }
              } else {
                console.log(`[MCP Server] Handling JSON-RPC request: ${request.method}`);
                // Handle as JSON-RPC (existing behavior)
                const reply = await this.bridge.handleRpc(request);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(reply));
              }
            } catch (e) {
              console.error(`[MCP Server] Error processing request:`, e);
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ 
                jsonrpc: "2.0",
                id: null,
                error: { code: -1, message: String(e) }
              }));
            }
          });
        } else if (req.method === "GET" && req.url === "/tools") {
          const tools = this.bridge.listTools();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ tools }));
        } else if (req.method === "GET" && req.url === "/") {
          // Health check endpoint for MCP
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ 
            name: "obsidian-connector",
            version: "0.2.0",
            description: "MCP server for Obsidian vault access"
          }));
        } else {
          console.log(`[MCP Server] 404 - Unknown endpoint: ${req.method} ${req.url}`);
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Not found" }));
        }
      });

      this.server.on("error", (err) => reject(err));
      this.server.listen(this.opts.port!, this.opts.host!, () => {
  console.log(`[obsidian-connector] listening on http://${this.opts.host}:${this.opts.port}`);
        resolve();
      });
    });
  }

  private isAuthenticated(req: http.IncomingMessage): boolean {
    if (!this.opts.authToken) {
      return true; // No auth required if no token configured
    }
    
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return false;
    }
    
    const token = authHeader.replace(/^Bearer\s+/, '');
    return token === this.opts.authToken;
  }

  private isMcpRequest(request: any): boolean {
    // MCP requests have specific methods like 'initialize', 'tools/list', 'tools/call'
    return request.method && (
      request.method === 'initialize' ||
      request.method.startsWith('tools/') ||
      request.method === 'notifications/initialized'
    );
  }

  private async handleMcpRequest(request: any) {
    const { method, params, id } = request;

    try {
      switch (method) {
        case 'initialize':
          return {
            jsonrpc: "2.0",
            id,
            result: {
              protocolVersion: '2024-11-05',
              // We currently only advertise the tools capability.
              // Tool metadata includes description & inputSchema via tools/list.
              // Additional capabilities (resources, prompts) can be added later.
              capabilities: { 
                tools: {
                  listChanged: true
                }
              },
              serverInfo: {
                name: 'obsidian-connector',
                version: '0.2.0',
                description: 'Direct MCP access to Obsidian vault and plugins'
              }
            }
          };

        case 'tools/list':
          const tools = this.bridge.listTools();
          return {
            jsonrpc: "2.0",
            id,
            result: { tools }
          };

        case 'tools/call':
          const { name, arguments: args } = params;
          
          // Map MCP tool names to internal methods
          const methodMap: Record<string, string> = {
            'vault_list_notes': 'vault.listNotes',
            'vault_get_note': 'vault.getNote', 
            'vault_search': 'vault.search',
            'vault_get_metadata': 'vault.getFileMetadata',
            'dataview_query': 'dataview.query',
            'tasks_query': 'tasks.query',
            'plugins_list': 'plugins.list'
          };

          const internalMethod = methodMap[name] || name;
          const rpcRequest = {
            jsonrpc: "2.0",
            id: 1,
            method: internalMethod,
            params: args || {}
          };

          const result = await this.bridge.handleRpc(rpcRequest);
          
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [{
                type: 'text',
                text: this.formatMcpResult(name, result)
              }]
            }
          };

        case 'notifications/initialized':
          // No response needed for notifications
          console.log(`[MCP Server] Client initialized`);
          return null;

        default:
          throw new Error(`Unknown MCP method: ${method}`);
      }
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -1,
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  private formatMcpResult(toolName: string, result: any): string {
    // Format results as markdown for better display in Claude
    switch (toolName) {
      case 'vault_list_notes':
        if (Array.isArray(result)) {
          return `# Notes in Vault (${result.length})\n\n${result.map(path => `- ${path}`).join('\n')}`;
        }
        break;

      case 'vault_get_note':
        return typeof result === 'string' ? result : JSON.stringify(result);

      case 'vault_search':
        if (Array.isArray(result)) {
          return `# Search Results (${result.length})\n\n${result.map(path => `- ${path}`).join('\n')}`;
        }
        break;

      case 'dataview_query':
        return typeof result === 'string' ? result : JSON.stringify(result);

      case 'tasks_query':
        if (Array.isArray(result)) {
          return `# Tasks (${result.length})\n\n${result.map(task => `- ${task}`).join('\n')}`;
        }
        break;

      case 'plugins_list':
        if (Array.isArray(result)) {
          return `# Loaded Plugins (${result.length})\n\n${result.map(plugin => `- ${plugin}`).join('\n')}`;
        }
        break;
    }

    // Fallback to JSON
    return JSON.stringify(result, null, 2);
  }

  stop() {
    if (this.server) {
      try { this.server.close(); } catch (e) { console.error(e); }
      this.server = undefined;
    }
  }
}