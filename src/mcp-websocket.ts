import { PluginBridge } from "./plugin-bridge";

export interface McpWebSocketOptions {
  url?: string; // WebSocket server URL
  reconnectInterval?: number; // Reconnect delay in ms
  maxReconnectAttempts?: number; // Max reconnect attempts (0 = infinite)
}

export class McpWebSocketTransport {
  private bridge: PluginBridge;
  private opts: McpWebSocketOptions;
  private ws?: WebSocket;
  private reconnectTimer?: number;
  private reconnectAttempts = 0;
  private running = false;
  public connectionStatus: "disconnected" | "connecting" | "connected" = "disconnected";

  constructor(bridge: PluginBridge, opts?: McpWebSocketOptions) {
    this.bridge = bridge;
    this.opts = Object.assign(
      {
        url: "ws://127.0.0.1:4124/mcp",
        reconnectInterval: 5000,
        maxReconnectAttempts: 0, // Infinite
      },
      opts || {}
    );
  }

  async start(): Promise<void> {
    console.log("[MCP WebSocket] Starting WebSocket transport...");
    this.running = true;
    this.connect();
  }

  stop(): void {
    console.log("[MCP WebSocket] Stopping WebSocket transport...");
    this.running = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
  }

  private connect(): void {
    if (!this.running) return;

    try {
      console.log(`[MCP WebSocket] Connecting to ${this.opts.url}...`);
      this.connectionStatus = "connecting";
      this.ws = new WebSocket(this.opts.url!);

      this.ws.onopen = () => {
        console.log("[MCP WebSocket] ✅ Connected successfully");
        this.connectionStatus = "connected";
        this.reconnectAttempts = 0;
        // Send initialize message
        this.send({
          jsonrpc: "2.0",
          id: 0,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
              name: "obsidian-mcp-connector",
              version: "0.2.0",
            },
          },
        });
      };

      this.ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("[MCP WebSocket] Received:", message);
          const response = await this.handleMessage(message);
          if (response) {
            this.send(response);
          }
        } catch (error) {
          console.error("[MCP WebSocket] Error handling message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("[MCP WebSocket] ❌ Connection error:", error);
        this.connectionStatus = "disconnected";
      };

      this.ws.onclose = (event) => {
        console.log(`[MCP WebSocket] Disconnected (code: ${event.code})`);
        this.connectionStatus = "disconnected";
        this.ws = undefined;

        if (event.code === 1006) {
          console.warn("[MCP WebSocket] ⚠️  Connection closed abnormally. Is the bridge server running?");
        }

        this.scheduleReconnect();
      };
    } catch (error) {
      console.error("[MCP WebSocket] Connection error:", error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.running) return;

    const maxAttempts = this.opts.maxReconnectAttempts!;
    if (maxAttempts > 0 && this.reconnectAttempts >= maxAttempts) {
      console.error("[MCP WebSocket] Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `[MCP WebSocket] Reconnecting in ${this.opts.reconnectInterval}ms (attempt ${this.reconnectAttempts})...`
    );

    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, this.opts.reconnectInterval!);
  }

  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      console.log("[MCP WebSocket] Sent:", message);
    } else {
      console.warn("[MCP WebSocket] Cannot send, not connected");
    }
  }

  private async handleMessage(message: any): Promise<any> {
    const { jsonrpc, id, method, params } = message;

    // JSON-RPC 2.0: Notifications have no id and should not receive a response
    const isNotification = id === undefined || id === null;

    if (jsonrpc !== "2.0") {
      // Only respond to requests, not notifications
      if (isNotification) return null;
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32600, message: "Invalid JSON-RPC version" },
      };
    }

    try {
      switch (method) {
        case "initialize":
          return {
            jsonrpc: "2.0",
            id,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: {
                tools: {},
              },
              serverInfo: {
                name: "obsidian-mcp-connector",
                version: "0.2.0",
              },
            },
          };

        case "tools/list":
          const tools = this.bridge.getAllTools();
          return {
            jsonrpc: "2.0",
            id,
            result: {
              tools: tools.map((t) => ({
                name: t.name,
                description: t.description,
                inputSchema: t.inputSchema,
              })),
            },
          };

        case "tools/call":
          const { name, arguments: args } = params;
          const result = await this.bridge.invokeTool(name, args || {});
          return {
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
                },
              ],
            },
          };

        case "ping":
          return {
            jsonrpc: "2.0",
            id,
            result: {},
          };

        // MCP notifications - handle silently
        case "notifications/initialized":
        case "notifications/progress":
        case "notifications/message":
        case "notifications/resources/list_changed":
        case "notifications/resources/updated":
        case "notifications/prompts/list_changed":
        case "notifications/tools/list_changed":
          console.log(`[MCP WebSocket] Received notification: ${method}`);
          return null; // Don't respond to notifications

        default:
          // Unknown method - only respond with error if it's a request
          if (isNotification) {
            console.log(`[MCP WebSocket] Ignoring unknown notification: ${method}`);
            return null;
          }
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32601,
              message: `Method not found: ${method}`,
            },
          };
      }
    } catch (error) {
      console.error("[MCP WebSocket] Error handling method:", method, error);
      // Only respond with error if it's a request
      if (isNotification) return null;
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}
