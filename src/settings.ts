import { App, PluginSettingTab, Setting } from 'obsidian';

export interface ObsidianMcpSettings {
  websocketUrl: string;
}

export const DEFAULT_SETTINGS: ObsidianMcpSettings = {
  websocketUrl: "ws://127.0.0.1:4124/mcp",
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

    containerEl.createEl('h2', { text: 'Obsidian MCP Connector Settings' });

    // Connection Status
    const statusEl = containerEl.createDiv({ cls: 'mcp-status-container' });
    const status = this.plugin.transport?.connectionStatus || 'disconnected';
    const statusIcon = status === 'connected' ? '✅' : status === 'connecting' ? '🔄' : '❌';
    const statusText = status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : 'Disconnected';

    statusEl.createEl('p', {
      text: `${statusIcon} Status: ${statusText}`,
      cls: `mcp-status mcp-status-${status}`
    });

    if (status === 'disconnected') {
      statusEl.createEl('p', {
        text: '⚠️  Bridge server not running. Start it with: node .obsidian/plugins/mcp-connector/mcp-http-ws-bridge.js',
        cls: 'mod-warning'
      });
    }

    containerEl.createEl('p', {
      text: 'This plugin uses WebSocket to connect to a bridge server. The plugin will automatically reconnect if the connection is lost.'
    });

    new Setting(containerEl)
      .setName('WebSocket Bridge URL')
      .setDesc('WebSocket bridge URL (default: ws://127.0.0.1:4124/mcp)')
      .addText(text => text
        .setPlaceholder('ws://127.0.0.1:4124/mcp')
        .setValue(this.plugin.settings?.websocketUrl || 'ws://127.0.0.1:4124/mcp')
        .onChange(async (value) => {
          this.plugin.settings.websocketUrl = value || 'ws://127.0.0.1:4124/mcp';
          await this.plugin.saveSettings();
        }));

    containerEl.createEl('h3', { text: 'Quick Start' });

    containerEl.createEl('p', {
      text: '1. Start the bridge server: node .obsidian/plugins/mcp-connector/mcp-http-ws-bridge.js'
    });

    containerEl.createEl('p', {
      text: '2. Reload this plugin (if already loaded)'
    });

    containerEl.createEl('p', {
      text: '3. Connect your MCP client to: http://127.0.0.1:4125/mcp'
    });

    // Refresh button
    new Setting(containerEl)
      .setName('Refresh Status')
      .setDesc('Manually check connection status')
      .addButton(button => button
        .setButtonText('Refresh')
        .onClick(() => {
          this.display();
        }));
  }
}