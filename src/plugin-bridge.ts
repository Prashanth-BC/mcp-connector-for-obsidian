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

  getAllTools() {
    return this.listTools();
  }

  async invokeTool(name: string, args: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return await tool.run(args);
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
      description: "List all markdown note paths in the vault. PRIORITY: Use for direct file access when you need to list all notes. For structured queries with metadata/filtering, prefer dataview.query instead.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      run: async () => {
  const files = this.app.vault.getMarkdownFiles();
  return files.map((f: any) => f.path);
      }
    });

    this.tools.set("vault.getNote", {
      description: "Return the full markdown content of a note by path. PRIORITY: Use for direct file content access. For metadata access, prefer dataview.page. For task-specific content, use tasks.* tools first.",
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
      description: "Search note paths containing the query substring (case-sensitive) in path or basename. PRIORITY: Use for searching by filename/path only. For content search with metadata, prefer dataview.query. For task search, use tasks.search instead.",
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
      description: "Get basic metadata (path, basename, size) for a markdown file. PRIORITY: Use for basic file system metadata only. For Dataview frontmatter and inline metadata, use dataview.page instead.",
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
        description: "Execute a Dataview query string and return results (string or structured). PRIORITY: Use for structured queries with metadata/filtering. Supports TABLE, LIST, TASK queries. For tasks specifically, prefer tasks.query for simpler syntax. For basic file access, use vault.* tools. Examples: 'TABLE file.name, file.mtime FROM \"Projects\"' or 'TASK WHERE !completed AND contains(text, \"urgent\")'",
        inputSchema: {
          type: "object",
            required: ["query"],
            properties: { query: { type: "string", description: "Dataview query (TABLE/LIST/TASK with optional WHERE/FROM/SORT clauses)" } },
            additionalProperties: false
        },
        run: adapter.query.bind(adapter)
      });
      this.tools.set("dataview.page", {
        description: "Return Dataview page object for a given note path including frontmatter and inline metadata. PRIORITY: Use for accessing note metadata (frontmatter, inline fields like [key:: value]). Returns structured data with all Dataview-indexed properties. For basic file info only, use vault.getFileMetadata instead.",
        inputSchema: {
          type: "object",
          required: ["path"],
          properties: { path: { type: "string", description: "Note path relative to vault root" } },
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

    // Tasks via Dataview adapter (uses Dataview's TASK queries)
    // Also get Tasks plugin API for editing capabilities
    const tasksPlugin = plugins["tasks"] || plugins["obsidian-tasks-plugin"];
    const tasksApi = tasksPlugin?.api;

    if (dataviewApi) {
      const tasksAdapter = new TasksAdapter(this.app, dataviewApi, tasksApi);

      this.tools.set("tasks.query", {
        description: "Query tasks using Dataview TASK syntax (e.g., 'TASK WHERE !completed' or just '!completed'). Returns both markdown and structured data with file/line metadata. PRIORITY 1: Use this for all task queries. Supports filtering by completion status, dates, tags, text content. Examples: '!completed', 'due < date(tomorrow)', 'contains(text, \"urgent\")'. For complex queries with page metadata, use dataview.query with TASK instead.",
        inputSchema: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string", description: "Dataview TASK query or WHERE condition (e.g., '!completed AND priority = \"high\"')" },
            includeMetadata: { type: "boolean", description: "Include structured task data with file paths and line numbers (default: true)" }
          },
          additionalProperties: false
        },
        run: tasksAdapter.query.bind(tasksAdapter)
      });

      this.tools.set("tasks.list", {
        description: "List tasks with optional filtering by status and path. Returns structured data with file/line metadata. PRIORITY 1: Use for simple status-based filtering. For more complex queries (dates, tags, text), use tasks.query instead.",
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string", description: "Filter by status: 'todo' (incomplete), 'done' (completed), or 'all' (default: 'all')" },
            path: { type: "string", description: "Filter by file path (optional)" },
            includeMetadata: { type: "boolean", description: "Include structured task data with file paths and line numbers (default: true)" }
          },
          additionalProperties: false
        },
        run: tasksAdapter.list.bind(tasksAdapter)
      });

      this.tools.set("tasks.getByPriority", {
        description: "Get tasks by priority level using Dataview [priority:: HIGH/MEDIUM/LOW] metadata. Returns structured data with file/line metadata. PRIORITY 1: Use for priority-based filtering. Note: This searches for Dataview inline metadata [priority:: value], not Tasks plugin emoji priorities.",
        inputSchema: {
          type: "object",
          required: ["priority"],
          properties: {
            priority: { type: "string", description: "Priority level: 'HIGH', 'MEDIUM', or 'LOW' (searches for [priority:: value] in tasks)" },
            includeMetadata: { type: "boolean", description: "Include structured task data with file paths and line numbers (default: true)" }
          },
          additionalProperties: false
        },
        run: tasksAdapter.getTasksByPriority.bind(tasksAdapter)
      });

      this.tools.set("tasks.getWithDueDates", {
        description: "Get tasks with due dates using [due:: YYYY-MM-DD] Dataview metadata, optionally filtered by date range. Returns structured data with file/line metadata. PRIORITY 1: Use for date-based filtering. Searches for tasks with [due::] field. For events/appointments, use [due::] for event date, [scheduled::] for reminders.",
        inputSchema: {
          type: "object",
          properties: {
            before: { type: "string", description: "Due before date in YYYY-MM-DD format (optional)" },
            after: { type: "string", description: "Due after date in YYYY-MM-DD format (optional)" },
            includeMetadata: { type: "boolean", description: "Include structured task data with file paths and line numbers (default: true)" }
          },
          additionalProperties: false
        },
        run: tasksAdapter.getTasksWithDueDates.bind(tasksAdapter)
      });

      this.tools.set("tasks.getOverdue", {
        description: "Get all overdue incomplete tasks using [due::] Dataview metadata. Returns tasks where due date is before today and task is not completed. Returns structured data with file/line metadata. PRIORITY 1: Use for finding overdue items. Only returns incomplete tasks with [due::] field set to past dates.",
        inputSchema: {
          type: "object",
          properties: {
            includeMetadata: { type: "boolean", description: "Include structured task data with file paths and line numbers (default: true)" }
          },
          additionalProperties: false
        },
        run: tasksAdapter.getOverdueTasks.bind(tasksAdapter)
      });

      this.tools.set("tasks.getByTag", {
        description: "Get tasks containing a specific tag. Returns structured data with file/line metadata. PRIORITY 1: Use for tag-based filtering. Searches for #tag in task text. Provide tag name without # symbol.",
        inputSchema: {
          type: "object",
          required: ["tag"],
          properties: {
            tag: { type: "string", description: "Tag name WITHOUT the # symbol (e.g., 'urgent' not '#urgent')" },
            includeMetadata: { type: "boolean", description: "Include structured task data with file paths and line numbers (default: true)" }
          },
          additionalProperties: false
        },
        run: tasksAdapter.getTasksByTag.bind(tasksAdapter)
      });

      this.tools.set("tasks.getRecurring", {
        description: "Get all recurring tasks (tasks with [recurrence::] or [repeat::] Dataview metadata). Returns structured data with file/line metadata. PRIORITY 1: Use for finding recurring/repeating tasks and events. Searches for [recurrence:: every week] or similar patterns. For events, use [recurrence:: every week/month/year].",
        inputSchema: {
          type: "object",
          properties: {
            includeMetadata: { type: "boolean", description: "Include structured task data with file paths and line numbers (default: true)" }
          },
          additionalProperties: false
        },
        run: tasksAdapter.getRecurringTasks.bind(tasksAdapter)
      });

      this.tools.set("tasks.getStats", {
        description: "Get task statistics (total, completed, incomplete counts) and helpful query templates. Returns overview of tasks across vault or specific file. PRIORITY 1: Use for task summaries and learning available query patterns.",
        inputSchema: {
          type: "object",
          properties: {
            path: { type: "string", description: "Optional file path to filter statistics to specific file (omit for vault-wide stats)" }
          },
          additionalProperties: false
        },
        run: tasksAdapter.getTaskStats.bind(tasksAdapter)
      });

      this.tools.set("tasks.search", {
        description: "Search tasks by text content (case-insensitive substring match). Returns structured data with file/line metadata. PRIORITY 1: Use for text-based task search. Searches task description and metadata text. For more complex queries, use tasks.query instead.",
        inputSchema: {
          type: "object",
          required: ["text"],
          properties: {
            text: { type: "string", description: "Search text (case-insensitive substring to find in task content)" },
            includeMetadata: { type: "boolean", description: "Include structured task data with file paths and line numbers (default: true)" }
          },
          additionalProperties: false
        },
        run: tasksAdapter.searchTasks.bind(tasksAdapter)
      });

      // Task editing tools (programmatic, no UI)
      this.tools.set("tasks.createTemporaryTask", {
        description: "Generate a properly formatted task line WITHOUT saving to file. WHEN TO USE: (1) Creating subtasks with specific indentation for manual insertion, (2) Generating task lines for use with Edit/Write operations, (3) When you need manual control over file location or formatting. Returns formatted task string with Dataview metadata and auto-generated [id::] field. Use tasks.create if you want the task saved immediately. FORMAT: Returns '- [ ] description [due:: YYYY-MM-DD] [priority:: HIGH] [id:: auto-generated]'. For subtasks, use Edit tool to insert with tab indentation.",
        inputSchema: {
          type: "object",
          required: ["description"],
          properties: {
            description: { type: "string", description: "Task description text" },
            tags: { type: "array", items: { type: "string" }, description: "Optional array of tags WITHOUT # symbol (e.g., ['urgent', 'work'])" },
            metadata: {
              type: "object",
              description: "Optional Dataview metadata as key-value pairs. Common fields: {due: 'YYYY-MM-DD', scheduled: 'YYYY-MM-DD', priority: 'HIGH/MEDIUM/LOW', start: 'YYYY-MM-DD', recurrence: 'every week'}. Auto-generates [id::] if not provided.",
              additionalProperties: true
            }
          },
          additionalProperties: false
        },
        run: tasksAdapter.createTemporaryTask.bind(tasksAdapter)
      });

      this.tools.set("tasks.create", {
        description: "Create and SAVE a new task immediately using Dataview inline metadata format. WHEN TO USE: Creating standalone tasks that should be saved right away to default or specified file. Don't need manual control over formatting/location. Returns the created task with file path and line number. FORMAT: Saves as '- [ ] description [due:: YYYY-MM-DD] [priority:: HIGH] [id:: auto-generated]'. Auto-generates [id::] and [created::] fields. For subtasks or manual insertion, use tasks.createTemporaryTask instead.",
        inputSchema: {
          type: "object",
          required: ["description"],
          properties: {
            description: { type: "string", description: "Task description text" },
            file: { type: "string", description: "Optional file path to save the task to (defaults to tasks_for_review.md if not specified)" },
            tags: { type: "array", items: { type: "string" }, description: "Optional array of tags WITHOUT # symbol (e.g., ['urgent', 'work'])" },
            metadata: {
              type: "object",
              description: "Optional Dataview metadata as key-value pairs. Common fields: {due: 'YYYY-MM-DD', scheduled: 'YYYY-MM-DD', priority: 'HIGH/MEDIUM/LOW', start: 'YYYY-MM-DD', recurrence: 'every week'}. Auto-generates [id::] and [created::] if not provided.",
              additionalProperties: true
            }
          },
          additionalProperties: false
        },
        run: tasksAdapter.createTask.bind(tasksAdapter)
      });

      this.tools.set("tasks.edit", {
        description: "Edit an existing task programmatically using Dataview format. CRITICAL: ALWAYS PRESERVE existing metadata! When editing, you MUST include original [id::] if present, original [created::] date if present. Only modify/add the fields that need to change. Never delete existing metadata unless explicitly requested. Use tasks.findById to locate tasks by ID before editing. Requires exact file path and line number (1-based).",
        inputSchema: {
          type: "object",
          required: ["file", "lineNumber"],
          properties: {
            file: { type: "string", description: "File path containing the task (relative to vault root)" },
            lineNumber: { type: "number", description: "Line number in the file (1-based, first line = 1)" },
            description: { type: "string", description: "Optional new task description (omit to keep current)" },
            tags: { type: "array", items: { type: "string" }, description: "Optional array of tags WITHOUT # (e.g., ['urgent', 'work']). Omit to keep current tags." },
            metadata: {
              type: "object",
              description: "IMPORTANT: Only include metadata fields to ADD or MODIFY. Existing fields (especially [id::] and [created::]) are preserved automatically. Common fields: {due: 'YYYY-MM-DD', priority: 'HIGH/MEDIUM/LOW', scheduled: 'YYYY-MM-DD', completion: 'YYYY-MM-DD'}",
              additionalProperties: true
            }
          },
          additionalProperties: false
        },
        run: tasksAdapter.editTask.bind(tasksAdapter)
      });

      this.tools.set("tasks.toggle", {
        description: "Toggle task completion status programmatically. Changes '- [ ]' to '- [x]' and vice versa. Automatically adds/removes [completion:: YYYY-MM-DD] metadata. Preserves all other task metadata ([id::], [created::], etc.). Use tasks.findById to locate tasks by ID before toggling.",
        inputSchema: {
          type: "object",
          required: ["file", "lineNumber"],
          properties: {
            file: { type: "string", description: "File path containing the task (relative to vault root)" },
            lineNumber: { type: "number", description: "Line number in the file (1-based, first line = 1)" }
          },
          additionalProperties: false
        },
        run: tasksAdapter.toggleTask.bind(tasksAdapter)
      });

      this.tools.set("tasks.findById", {
        description: "Find a task by its ID using Dataview [id:: value] metadata. Searches across entire vault or specific file. Returns task with file path and line number needed for tasks.edit or tasks.toggle. PRIORITY 1: Use this to locate tasks before editing/toggling when you have the task ID. Essential for finding tasks to update.",
        inputSchema: {
          type: "object",
          required: ["taskId"],
          properties: {
            taskId: { type: "string", description: "The task ID to search for (the value from [id:: taskId])" },
            searchPath: { type: "string", description: "Optional specific file path to search in (searches entire vault if omitted)" }
          },
          additionalProperties: false
        },
        run: tasksAdapter.findTaskById.bind(tasksAdapter)
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