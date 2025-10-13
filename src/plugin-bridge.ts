import { App, Plugin, TFile } from "obsidian";
import { DataviewAdapter } from "./tools/dataview";
import { TasksAdapter } from "./tools/tasks";

export type RpcRequest = { jsonrpc?: string; id?: any; method: string; params?: any };
export type RpcResponse = { jsonrpc: string; id?: any; result?: any; error?: any };

export class PluginBridge {
  app: App;
  plugin: Plugin;
  // Store tool metadata so we can expose description & inputSchema via MCP
  tools: Map<string, { run: (params: any) => Promise<any>; description?: string; inputSchema?: any }> = new Map();

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;

    this.registerCoreTools();
    this.discoverAndRegisterPlugins();
  }

  listTools() {
    const entries: { name: string; description?: string; inputSchema?: any }[] = [];
    for (const [name, meta] of this.tools) {
      entries.push({ name, description: meta.description, inputSchema: meta.inputSchema });
    }
    return entries;
  }

  async handleRpc(rpc: RpcRequest): Promise<RpcResponse> {
    const id = rpc.id;
    const method = rpc.method;
    const params = rpc.params || {};

    const tool = this.tools.get(method);
    if (!tool) {
      return { jsonrpc: "2.0", id, error: `Unknown method: ${method}` };
    }

    try {
      const result = await tool.run(params);
      return { jsonrpc: "2.0", id, result };
    } catch (e) {
      return { jsonrpc: "2.0", id, error: String(e) };
    }
  }

  // Core vault & helper tools
  registerCoreTools() {
    this.tools.set("vault.listNotes", {
      description: "List all markdown note paths in the vault",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      run: async () => {
  const files = this.app.vault.getMarkdownFiles();
  return files.map((f: any) => f.path);
      }
    });

    this.tools.set("vault.getNote", {
      description: "Return the full markdown content of a note by path",
      inputSchema: {
        type: "object",
        required: ["path"],
        properties: { path: { type: "string", description: "Path to the markdown file inside the vault" } },
        additionalProperties: false
      },
      run: async (params) => {
        const path = params.path;
        const file = this.app.vault.getAbstractFileByPath(path as string);
        if (!file) throw new Error("file not found");
        if (!(file instanceof TFile)) throw new Error("not a file");
        return await this.app.vault.read(file);
      }
    });

    this.tools.set("vault.search", {
      description: "Search note paths containing the query substring (case-sensitive) in path or basename",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: { query: { type: "string", description: "Substring to match in file path or basename" } },
        additionalProperties: false
      },
      run: async (params) => {
        const query = params.query || "";
  const files = this.app.vault.getMarkdownFiles().filter((f: any) => f.path.includes(query) || f.basename.includes(query));
  return files.map((f: any) => f.path);
      }
    });

    this.tools.set("vault.getFileMetadata", {
      description: "Get basic metadata (path, basename, size) for a markdown file",
      inputSchema: {
        type: "object",
        required: ["path"],
        properties: { path: { type: "string", description: "Path to the markdown file" } },
        additionalProperties: false
      },
      run: async (params) => {
        const path = params.path;
        const file = this.app.vault.getAbstractFileByPath(path as string);
        if (!file || !(file instanceof TFile)) throw new Error("file not found");
        return { path: file.path, basename: file.basename, size: file.stat?.size ?? null };
      }
    });
  }

  // Discover other plugins and register bridges for known ones
  discoverAndRegisterPlugins() {
    const plugins = (this.plugin as any).app.plugins.plugins as Record<string, any>;

    // Debug: Add plugin inspection tool
    this.tools.set("plugins.inspect", {
      description: "Inspect a plugin by id or list available plugin ids when none provided",
      inputSchema: {
        type: "object",
        properties: { plugin: { type: "string", description: "Plugin id to inspect" } },
        additionalProperties: false
      },
      run: async (params) => {
        const pluginId = params.plugin;
        if (!pluginId) return Object.keys(plugins);
        const plugin = plugins[pluginId];
        if (!plugin) return { error: "Plugin not found" };
        return {
          id: pluginId,
          manifest: plugin.manifest,
          hasApi: !!plugin.api,
          apiMethods: plugin.api ? Object.getOwnPropertyNames(plugin.api) : [],
          pluginType: typeof plugin,
          keys: Object.keys(plugin)
        };
      }
    });

    // Dataview - try multiple approaches
    const dataviewPlugin = plugins["dataview"];
    let dataviewApi = null;
    
    // Method 1: Plugin API property
    if (dataviewPlugin?.api) {
      dataviewApi = dataviewPlugin.api;
    }
    // Method 2: Global app dataview API (common pattern)
    else if ((this.app as any).plugins?.dataview?.api) {
      dataviewApi = (this.app as any).plugins.dataview.api;
    }
    // Method 3: Window global (sometimes used by Dataview)
    else if ((window as any).DataviewAPI) {
      dataviewApi = (window as any).DataviewAPI;
    }

    if (dataviewApi) {
      const adapter = new DataviewAdapter(this.app, dataviewApi);
      this.tools.set("dataview.query", {
        description: "Execute a Dataview query string and return results (string or structured)",
        inputSchema: {
          type: "object",
            required: ["query"],
            properties: { query: { type: "string", description: "Dataview query" } },
            additionalProperties: false
        },
        run: adapter.query.bind(adapter)
      });
      this.tools.set("dataview.page", {
        description: "Return Dataview page object for a given note path",
        inputSchema: {
          type: "object",
          required: ["path"],
          properties: { path: { type: "string", description: "Note path" } },
          additionalProperties: false
        },
        run: adapter.page.bind(adapter)
      });
    } else {
      // Provide alternative direct access without adapter
      this.tools.set("dataview.query", {
        description: "Execute a Dataview query string (fallback direct API access)",
        inputSchema: {
          type: "object",
          required: ["query"],
          properties: { query: { type: "string", description: "Dataview query" } },
          additionalProperties: false
        },
        run: async (params) => {
          const query = params.query;
          if (!query) throw new Error("Missing query parameter");
          const dv = dataviewPlugin || 
                     (this.app as any).plugins?.dataview || 
                     (window as any).DataviewAPI;
          if (!dv) throw new Error("Dataview plugin not accessible");
          if (typeof dv.query === 'function') return await dv.query(query);
          if (typeof dv.api?.query === 'function') return await dv.api.query(query);
          if (typeof dv.queryMarkdown === 'function') return await dv.queryMarkdown(query);
          throw new Error("Dataview query method not found");
        }
      });
    }

    // Templater (attempt a few known ids)
    const templater = plugins["templater-obsidian"] || plugins["templater"];
    if (templater?.api) {
      this.tools.set("templater.render", {
        description: "Render a Templater template with optional context object",
        inputSchema: {
          type: "object",
          required: ["template"],
          properties: {
            template: { type: "string", description: "Template string or template path depending on Templater config" },
            context: { type: "object", description: "Key/value context provided to the template", additionalProperties: true }
          },
          additionalProperties: false
        },
        run: async (params) => {
          const template = params.template;
          if (!template) throw new Error("missing template");
          if (typeof templater.api.renderTemplate === 'function') {
            return await templater.api.renderTemplate(template, params.context || {});
          }
          if (typeof templater.api.fill_template === 'function') {
            return await templater.api.fill_template(template, params.context || {});
          }
          throw new Error('templater API not supported in this version');
        }
      });
    }

    // Tasks via adapter
    const tasksPlugin = plugins["tasks"] || plugins["obsidian-tasks-plugin"];
    if (tasksPlugin?.api) {
      const adapter = new TasksAdapter(this.app, tasksPlugin.api);
      this.tools.set("tasks.query", {
        description: "Query tasks via the Tasks plugin API (syntax depends on Tasks plugin)",
        inputSchema: {
          type: "object",
          properties: { query: { type: "string", description: "Query / filter expression (optional)" } },
          additionalProperties: true
        },
        run: adapter.query.bind(adapter)
      });
      this.tools.set("tasks.list", {
        description: "List all tasks via the Tasks plugin API",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        run: adapter.list.bind(adapter)
      });
    }

    // Expose raw plugin list
    this.tools.set("plugins.list", {
      description: "Return a list of installed plugin ids",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      run: async () => Object.keys(plugins)
    });
  }
}