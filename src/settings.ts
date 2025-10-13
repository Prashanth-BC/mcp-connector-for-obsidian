import { App, PluginSettingTab, Setting } from 'obsidian';

export interface ObsidianMcpSettings {
  port: number;
  authToken: string;
  enableAuth: boolean;
}

export const DEFAULT_SETTINGS: ObsidianMcpSettings = {
  port: 4123,
  authToken: "",
  enableAuth: false,
};

export class ObsidianMcpSettingsTab extends PluginSettingTab {
  plugin: any;

  constructor(app: App, plugin: any) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Obsidian MCP Bridge Settings' });

    new Setting(containerEl)
      .setName('Server Port')
      .setDesc('Port number for the local MCP HTTP server (default: 4123)')
      .addText(text => text
        .setPlaceholder('4123')
        .setValue(String(this.plugin.settings?.port || 4123))
        .onChange(async (value) => {
          const port = parseInt(value) || 4123;
          if (port > 0 && port <= 65535) {
            this.plugin.settings.port = port;
            await this.plugin.saveSettings();
          }
        }));

    new Setting(containerEl)
      .setName('Enable Authentication')
      .setDesc('Require bearer token authentication for MCP connections')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings?.enableAuth || false)
        .onChange(async (value) => {
          this.plugin.settings.enableAuth = value;
          await this.plugin.saveSettings();
          this.display(); // Refresh to show/hide auth token field
        }));

    if (this.plugin.settings?.enableAuth) {
      new Setting(containerEl)
        .setName('Authentication Token')
        .setDesc('Bearer token that clients must provide (leave empty to auto-generate)')
        .addText(text => text
          .setPlaceholder('your-secret-token')
          .setValue(this.plugin.settings?.authToken || '')
          .onChange(async (value) => {
            this.plugin.settings.authToken = value || this.generateToken();
            await this.plugin.saveSettings();
          }));

      if (this.plugin.settings?.authToken) {
        containerEl.createEl('p', { 
          text: `Current token: ${this.plugin.settings.authToken}`,
          cls: 'mod-warning'
        });
        containerEl.createEl('p', { 
          text: 'Add this to your Claude Desktop config: "Authorization": "Bearer ' + this.plugin.settings.authToken + '"'
        });
      }
    }
  }

  private generateToken(): string {
    return 'obsidian-' + Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}