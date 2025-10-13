import { App, Plugin } from "obsidian";
import { McpServer } from "./mcp-server";
import { PluginBridge } from "./plugin-bridge";
import { DEFAULT_SETTINGS, ObsidianMcpSettingsTab } from "./settings";

export default class ObsidianMcpBridge extends Plugin {
  server?: McpServer;
  bridge?: PluginBridge;
  settings: typeof DEFAULT_SETTINGS = DEFAULT_SETTINGS;

  async onload() {
    console.log("[obsidian-mcp-bridge] loading...");
    await this.loadSettings();

    this.bridge = new PluginBridge(this.app, this);
    
    const serverOptions = { 
      host: "127.0.0.1", 
      port: this.settings.port,
      authToken: this.settings.enableAuth ? this.settings.authToken : undefined
    };
    
    this.server = new McpServer(this.bridge, serverOptions);
    await this.server.start();

    this.addSettingTab(new ObsidianMcpSettingsTab(this.app, this));

    this.register(() => {
      this.server?.stop();
    });
  }

  onunload() {
    console.log("[obsidian-mcp-bridge] unloading...");
    this.server?.stop();
  }

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data || {});
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}