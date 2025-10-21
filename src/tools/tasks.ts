import { App, TFile } from "obsidian";

export class TasksAdapter {
  app: App;
  dvApi: any;
  tasksApi: any;

  constructor(app: App, dvApi: any, tasksApi?: any) {
    this.app = app;
    this.dvApi = dvApi;
    this.tasksApi = tasksApi;
  }

  // Generate a unique task ID (using Tasks plugin's method)
  // From: https://github.com/obsidian-tasks-group/obsidian-tasks/blob/main/src/Task/TaskDependency.ts
  private async generateUniqueId(): Promise<string> {
    // Get all existing task IDs from vault
    const existingIds = await this.getAllTaskIds();

    let id = '';
    let keepGenerating = true;

    while (keepGenerating) {
      // Generate 6-character ID using same method as Tasks plugin
      id = Math.random().toString(36).substring(2, 6 + 2);

      if (!existingIds.includes(id)) {
        keepGenerating = false;
      }
    }

    return id;
  }

  // Get all existing task IDs from the vault (Dataview format)
  private async getAllTaskIds(): Promise<string[]> {
    const ids: string[] = [];
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      if (!(file instanceof TFile)) continue;
      const content = await this.app.vault.read(file);
      const lines = content.split('\n');

      for (const line of lines) {
        // Match Dataview inline metadata format: [id:: value]
        const match = line.match(/\[id::\s*(\w+)\]/i);
        if (match && match[1]) {
          ids.push(match[1]);
        }
      }
    }

    return ids;
  }

  // Query tasks using Dataview TASK queries
  async query(params: any) {
    const query = params.query || params;
    const includeMetadata = params.includeMetadata !== false; // Default to true
    if (!query) throw new Error('missing query parameter');

    // Use Dataview's task query format
    // Example: "TASK WHERE !completed"
    const taskQuery = query.startsWith('TASK') ? query : `TASK WHERE ${query}`;

    if (typeof this.dvApi.queryMarkdown === 'function') {
      const result = await this.dvApi.queryMarkdown(taskQuery);

      if (!result.successful) {
        return result.error;
      }

      // If metadata is requested, parse the results and add file/line info
      if (includeMetadata && typeof this.dvApi.pages === 'function') {
        const structuredTasks = await this.extractStructuredTasks(query);
        return {
          markdown: result.value,
          tasks: structuredTasks
        };
      }

      return result.value;
    }

    throw new Error('Dataview API not available');
  }

  // Extract structured task information with metadata
  private async extractStructuredTasks(whereClause: string): Promise<any[]> {
    const tasks: any[] = [];
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      if (!(file instanceof TFile)) continue;
      const content = await this.app.vault.read(file);
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const taskMatch = line.match(/^(\s*)- \[([ xX])\]\s*(.*)$/);

        if (taskMatch) {
          const [, indent, status, taskContent] = taskMatch;
          const completed = status.toLowerCase() === 'x';

          // Extract inline metadata from Dataview format (like due dates, etc.)
          const inlineMetadata: any = {};
          const metadataRegex = /\[(\w+)::\s*([^\]]+)\]/g;
          let match;
          let cleanContent = taskContent;

          while ((match = metadataRegex.exec(taskContent)) !== null) {
            inlineMetadata[match[1]] = match[2].trim();
            cleanContent = cleanContent.replace(match[0], '').trim();
          }

          // Extract tags
          const tags = (taskContent.match(/#\w+/g) || []).map(tag => tag.substring(1));
          cleanContent = cleanContent.replace(/#\w+/g, '').trim();

          tasks.push({
            description: cleanContent,
            completed,
            status: status,
            indent: indent,
            tags,
            inlineMetadata,
            line: line,
            metadata: {
              file: file.path,
              lineNumber: i + 1
            }
          });
        }
      }
    }

    return tasks;
  }

  // List all tasks with optional filtering
  async list(params: any) {
    const status = params?.status?.toLowerCase(); // 'todo', 'done', or 'all'
    const path = params?.path; // Filter by file path
    const includeMetadata = params?.includeMetadata !== false; // Default to true

    let query = 'TASK';
    const conditions: string[] = [];

    if (status === 'todo') {
      conditions.push('!completed');
    } else if (status === 'done') {
      conditions.push('completed');
    }

    if (path) {
      conditions.push(`file.path = "${path}"`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    return await this.query({ query, includeMetadata });
  }

  // Get tasks by priority (using Tasks plugin emoji format)
  async getTasksByPriority(params: any) {
    const priority = params?.priority?.toLowerCase(); // 'high', 'medium', 'low'
    const includeMetadata = params?.includeMetadata !== false; // Default to true

    const priorityEmoji: Record<string, string> = {
      high: '⏫',
      medium: '🔼',
      low: '🔽'
    };

    if (!priority || !priorityEmoji[priority]) {
      throw new Error('Invalid priority. Use: high, medium, or low');
    }

    const query = `TASK WHERE contains(text, "${priorityEmoji[priority]}")`;
    return await this.query({ query, includeMetadata });
  }

  // Get tasks with due dates
  async getTasksWithDueDates(params: any) {
    const before = params?.before; // YYYY-MM-DD
    const after = params?.after;   // YYYY-MM-DD
    const includeMetadata = params?.includeMetadata !== false; // Default to true

    let query = 'TASK WHERE contains(text, "[due::")';

    if (before || after) {
      // Use Dataview metadata format for date filtering
      if (before) {
        query += ` AND contains(text, "[due::") AND text < "[due:: ${before}"`;
      }
      if (after) {
        query += ` AND contains(text, "[due::") AND text > "[due:: ${after}"`;
      }
    }

    return await this.query({ query, includeMetadata });
  }

  // Get overdue tasks (tasks with due date before today)
  async getOverdueTasks(params: any) {
    const includeMetadata = params?.includeMetadata !== false; // Default to true
    const today = new Date().toISOString().split('T')[0];
    // Use Dataview metadata format for due dates
    const query = `TASK WHERE !completed AND contains(text, "[due::") AND text < "[due:: ${today}"`;

    return await this.query({ query, includeMetadata });
  }

  // Get tasks by tag
  async getTasksByTag(params: any) {
    const tag = params?.tag;
    const includeMetadata = params?.includeMetadata !== false; // Default to true
    if (!tag) throw new Error('missing tag parameter');

    const query = `TASK WHERE contains(text, "#${tag}")`;
    return await this.query({ query, includeMetadata });
  }

  // Get recurring tasks
  async getRecurringTasks(params: any) {
    const includeMetadata = params?.includeMetadata !== false; // Default to true
    // Use Dataview repeat:: metadata format instead of emoji
    const query = 'TASK WHERE contains(text, "[repeat::")';
    return await this.query({ query, includeMetadata });
  }

  // Get task statistics
  async getTaskStats(params: any) {
    const path = params?.path;

    try {
      // Get all tasks
      const allTasksQuery = path ? `TASK WHERE file.path = "${path}"` : 'TASK';
      const completedTasksQuery = path
        ? `TASK WHERE completed AND file.path = "${path}"`
        : 'TASK WHERE completed';
      const todoTasksQuery = path
        ? `TASK WHERE !completed AND file.path = "${path}"`
        : 'TASK WHERE !completed';

      // Note: This returns markdown output, not counts
      // You might want to parse the results or use dvApi.pages() directly
      return {
        message: 'Use Dataview queries for statistics',
        queries: {
          all: allTasksQuery,
          completed: completedTasksQuery,
          todo: todoTasksQuery
        }
      };
    } catch (error) {
      return { error: String(error) };
    }
  }

  // Search tasks by text content
  async searchTasks(params: any) {
    const searchText = params?.text;
    const includeMetadata = params?.includeMetadata !== false; // Default to true
    if (!searchText) throw new Error('missing text parameter');

    const query = `TASK WHERE contains(text, "${searchText}")`;
    return await this.query({ query, includeMetadata });
  }

  // Create a new task programmatically (no UI) using Dataview format
  async createTask(params: any) {
    const {
      file,
      description,
      tags,
      metadata
    } = params;

    if (!description) throw new Error('missing description parameter');

    // Use default file if not provided
    const targetFile = file || 'tasks_for_review.md';

    // Build task line using Dataview inline metadata format
    let taskLine = `- [ ] ${description}`;

    // Add tags if provided
    if (tags && Array.isArray(tags)) {
      taskLine += ` ${tags.map(t => `#${t}`).join(' ')}`;
    }

    // Prepare metadata object with defaults
    const finalMetadata = { ...metadata };

    // Auto-generate ID if not provided
    if (!finalMetadata.id) {
      finalMetadata.id = await this.generateUniqueId();
    }

    // Add creation time if not provided (using Tasks plugin format)
    if (!finalMetadata.created) {
      const now = new Date();
      finalMetadata.created = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    }

    // Add inline metadata in Dataview format [key:: value]
    if (finalMetadata && typeof finalMetadata === 'object') {
      for (const [key, value] of Object.entries(finalMetadata)) {
        if (value !== undefined && value !== null && value !== '') {
          taskLine += ` [${key}:: ${value}]`;
        }
      }
    }

    // Get or create the target file
    let abstractFile = this.app.vault.getAbstractFileByPath(targetFile);

    if (!abstractFile) {
      // Create the file if it doesn't exist
      await this.app.vault.create(targetFile, '');
      abstractFile = this.app.vault.getAbstractFileByPath(targetFile);
    }

    if (!abstractFile || !(abstractFile instanceof TFile)) {
      throw new Error(`Failed to create or access file: ${targetFile}`);
    }

    const content = await this.app.vault.read(abstractFile);
    const lines = content ? content.split('\n') : [];
    const lineNumber = lines.length + 1; // New task will be on this line (1-based)
    const newContent = content ? content + '\n' + taskLine : taskLine;
    await this.app.vault.modify(abstractFile, newContent);

    return {
      success: true,
      taskLine,
      taskId: finalMetadata.id,
      metadata: {
        file: targetFile,
        lineNumber
      },
      message: `Task created and added to ${targetFile}:${lineNumber}`
    };
  }

  // Generate a task line without saving (for client-side processing)
  async createTemporaryTask(params: any) {
    const {
      description,
      tags,
      metadata
    } = params;

    if (!description) throw new Error('missing description parameter');

    // Build task line using Dataview inline metadata format
    let taskLine = `- [ ] ${description}`;

    // Add tags if provided
    if (tags && Array.isArray(tags)) {
      taskLine += ` ${tags.map(t => `#${t}`).join(' ')}`;
    }

    // Prepare metadata object with defaults
    const finalMetadata = { ...metadata };

    // Auto-generate ID if not provided
    if (!finalMetadata.id) {
      finalMetadata.id = await this.generateUniqueId();
    }

    // Add creation time if not provided
    if (!finalMetadata.created) {
      const now = new Date();
      finalMetadata.created = now.toISOString().split('T')[0];
    }

    // Add inline metadata in Dataview format [key:: value]
    if (finalMetadata && typeof finalMetadata === 'object') {
      for (const [key, value] of Object.entries(finalMetadata)) {
        if (value !== undefined && value !== null && value !== '') {
          taskLine += ` [${key}:: ${value}]`;
        }
      }
    }

    return {
      success: true,
      taskLine,
      taskId: finalMetadata.id,
      inlineMetadata: finalMetadata,
      message: 'Task line generated (not saved)'
    };
  }

  // Edit a task programmatically (no UI) using Dataview format
  async editTask(params: any) {
    const { file, lineNumber, description, tags, metadata } = params;

    if (!file) throw new Error('missing file parameter');
    if (lineNumber === undefined) throw new Error('missing lineNumber parameter');

    const abstractFile = this.app.vault.getAbstractFileByPath(file);
    if (!abstractFile || !(abstractFile instanceof TFile)) {
      throw new Error(`File not found: ${file}`);
    }

    const content = await this.app.vault.read(abstractFile);
    const lines = content.split('\n');

    if (lineNumber < 1 || lineNumber > lines.length) {
      throw new Error(`Invalid line number: ${lineNumber}`);
    }

    const originalLine = lines[lineNumber - 1];

    // Parse existing task line
    const taskMatch = originalLine.match(/^(\s*)- \[([ xX])\]\s*(.*)$/);
    if (!taskMatch) {
      throw new Error('Line is not a valid task');
    }

    const [, indent, status, existingContent] = taskMatch;

    // Build new task line
    let newDescription = description || existingContent.replace(/\[[\w-]+::[^\]]*\]/g, '').replace(/#\w+/g, '').trim();
    let taskLine = `${indent}- [${status}] ${newDescription}`;

    // Add tags
    if (tags && Array.isArray(tags)) {
      taskLine += ` ${tags.map(t => `#${t}`).join(' ')}`;
    }

    // Add inline metadata in Dataview format [key:: value]
    if (metadata && typeof metadata === 'object') {
      for (const [key, value] of Object.entries(metadata)) {
        if (value !== undefined && value !== null && value !== '') {
          taskLine += ` [${key}:: ${value}]`;
        }
      }
    }

    lines[lineNumber - 1] = taskLine;
    await this.app.vault.modify(abstractFile, lines.join('\n'));

    return {
      success: true,
      originalTaskLine: originalLine,
      editedTaskLine: taskLine,
      metadata: {
        file,
        lineNumber
      },
      message: 'Task updated in file'
    };
  }

  // Toggle task completion programmatically (no UI)
  async toggleTask(params: any) {
    const { file, lineNumber } = params;

    if (!file) throw new Error('missing file parameter');
    if (lineNumber === undefined) throw new Error('missing lineNumber parameter');

    const abstractFile = this.app.vault.getAbstractFileByPath(file);
    if (!abstractFile || !(abstractFile instanceof TFile)) {
      throw new Error(`File not found: ${file}`);
    }

    const content = await this.app.vault.read(abstractFile);
    const lines = content.split('\n');

    if (lineNumber < 1 || lineNumber > lines.length) {
      throw new Error(`Invalid line number: ${lineNumber}`);
    }

    const originalLine = lines[lineNumber - 1];

    // Parse task line
    const taskMatch = originalLine.match(/^(\s*)- \[([ xX])\]\s*(.*)$/);
    if (!taskMatch) {
      throw new Error('Line is not a valid task');
    }

    const [, indent, status, taskContent] = taskMatch;

    // Toggle status
    const newStatus = status === ' ' ? 'x' : ' ';
    const updatedLine = `${indent}- [${newStatus}] ${taskContent}`;

    lines[lineNumber - 1] = updatedLine;
    await this.app.vault.modify(abstractFile, lines.join('\n'));

    return {
      success: true,
      originalTaskLine: originalLine,
      updatedLine,
      completed: newStatus === 'x',
      metadata: {
        file,
        lineNumber
      },
      message: `Task marked as ${newStatus === 'x' ? 'completed' : 'incomplete'}`
    };
  }

  // Find task by ID across vault (using Dataview format [id:: value])
  async findTaskById(params: any) {
    const { taskId, searchPath } = params;

    if (!taskId) throw new Error('missing taskId parameter');

    const files = searchPath
      ? [this.app.vault.getAbstractFileByPath(searchPath)]
      : this.app.vault.getMarkdownFiles();

    for (const file of files) {
      if (!file || !(file instanceof TFile)) continue;

      const content = await this.app.vault.read(file);
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Match Dataview inline metadata format: [id:: taskId]
        if (line.match(new RegExp(`\\[id::\\s*${taskId}\\]`, 'i'))) {
          return {
            found: true,
            taskId,
            taskLine: line,
            metadata: {
              file: file.path,
              lineNumber: i + 1
            }
          };
        }
      }
    }

    return {
      found: false,
      taskId,
      message: 'Task not found'
    };
  }
}