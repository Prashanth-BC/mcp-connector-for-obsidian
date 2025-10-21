import { App, Platform, Plugin } from "obsidian";
import { PluginBridge } from "./plugin-bridge";
import { DEFAULT_SETTINGS, ObsidianMcpSettingsTab } from "./settings";
import { McpWebSocketTransport } from "./mcp-websocket";

// Types for our transport interfaces
interface McpTransport {
  start(): Promise<void>;
  stop(): void;
}

export default class ObsidianMcpBridge extends Plugin {
  transport?: McpTransport;
  bridge?: PluginBridge;
  settings: typeof DEFAULT_SETTINGS = DEFAULT_SETTINGS;

  async onload() {
    console.log("[obsidian-mcp-bridge] loading...");
    await this.loadSettings();

    this.bridge = new PluginBridge(this.app, this);

    // Detect platform and load appropriate transport
    const isMobile = Platform.isMobile;
    console.log(`[obsidian-mcp-bridge] Platform: ${isMobile ? "Mobile" : "Desktop"}`);

    try {
      // Use WebSocket transport for both desktop and mobile
      console.log(`[obsidian-mcp-bridge] Loading WebSocket transport for ${isMobile ? "mobile" : "desktop"}...`);
      const wsUrl = this.settings.websocketUrl || "ws://127.0.0.1:4124/mcp";
      this.transport = new McpWebSocketTransport(this.bridge, { url: wsUrl });
      await this.transport.start();
    } catch (error) {
      console.error("[obsidian-mcp-bridge] Failed to start transport:", error);
      // Continue loading plugin even if transport fails
    }

    this.addSettingTab(new ObsidianMcpSettingsTab(this.app, this));

    this.register(() => {
      this.transport?.stop();
    });
  }

  onunload() {
    console.log("[obsidian-mcp-bridge] unloading...");
    this.transport?.stop();
  }

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data || {});
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}