# Tool Reference

This document provides comprehensive documentation for all available MCP tools.

## Discovery

**To list all available tools:**
```bash
# Use plugins.inspect with no parameters
curl -X POST http://127.0.0.1:4125/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"plugins.inspect"}'
```

**Tool naming convention:**
- `vault.*` - Direct file operations
- `dataview.*` - Dataview queries and metadata
- `tasks.*` - Task management operations
- `plugins.*` - Plugin utilities

## Tool Priority Guidelines

### For Non-Task Content

1. **Dataview MCP Tools** (`dataview.*`) - For structured queries, metadata access, filtering by properties, aggregation
2. **Vault MCP Tools** (`vault.*`) - For direct file access, searching by filename/path, full note content, file metadata
3. **Fallback** - Standard file Read/Glob/Grep tools if MCP unavailable

### For Task Management

1. **Task MCP Tools** (`tasks.*`) - For creating, editing, toggling tasks; searching by text/priority/dates/tags/status; statistics; finding by ID
2. **Dataview MCP Tools** - For complex TASK queries, page metadata with task properties, custom filtering/aggregation
3. **Vault MCP Tools** - Only when task context requires full note content or file metadata
4. **Fallback** - Standard file Read/Edit/Write tools with proper Dataview format

## Vault Operations

### vault.listNotes
List all markdown files in the vault.

**Use for:** Direct file access
**Prefer over:** `dataview.query` when you just need file paths
**Parameters:** None
**Returns:** Array of file paths

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "vault.listNotes"
}
```

### vault.getNote
Get full content of a specific note.

**Use for:** Content access
**Prefer over:** `dataview.page` when you need full markdown content
**Parameters:**
- `path` (string, required) - File path relative to vault root

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "vault.getNote",
  "params": {
    "path": "Projects/README.md"
  }
}
```

### vault.search
Search notes by path or basename (filename only).

**Use for:** Finding files by name/path
**Not for:** Task searching (use `tasks.search` instead)
**Parameters:**
- `query` (string, required) - Search query

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "vault.search",
  "params": {
    "query": "meeting"
  }
}
```

### vault.getFileMetadata
Get metadata (path, basename, size) for a file.

**Use for:** Basic file info
**Prefer over:** `dataview.page` when you don't need Dataview metadata
**Parameters:**
- `path` (string, required) - File path relative to vault root

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "vault.getFileMetadata",
  "params": {
    "path": "Daily/2025-01-15.md"
  }
}
```

## Dataview Integration

### dataview.query
Execute Dataview queries (TABLE, LIST, TASK) with metadata/filtering.

**Use for:** Structured queries with WHERE/FROM/SORT clauses
**Supports:** Complex queries, aggregation, filtering
**Parameters:**
- `query` (string, required) - Dataview query
- `format` (string, optional) - "markdown" or "structured" (default: "markdown")

**Examples:**
```json
// List all files
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "dataview.query",
  "params": {
    "query": "TABLE file.name FROM \"Projects\""
  }
}

// Query tasks
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "dataview.query",
  "params": {
    "query": "TASK WHERE !completed AND contains(tags, \"#work\")"
  }
}

// Structured output
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "dataview.query",
  "params": {
    "query": "TABLE priority, due FROM \"Tasks\"",
    "format": "structured"
  }
}
```

### dataview.page
Get Dataview page object including frontmatter and inline metadata.

**Use for:** Accessing note metadata
**Returns:** Page object with all Dataview fields
**Parameters:**
- `path` (string, required) - File path relative to vault root

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "dataview.page",
  "params": {
    "path": "Projects/Website.md"
  }
}
```

## Task Management

All task functions return **structured data with metadata**:

```json
{
  "markdown": "...",
  "tasks": [
    {
      "description": "Complete project",
      "completed": false,
      "status": " ",
      "indent": "",
      "tags": ["work"],
      "inlineMetadata": {
        "due": "2024-12-31",
        "priority": "HIGH",
        "id": "abc123"
      },
      "line": "- [ ] Complete project #work [due:: 2024-12-31]",
      "metadata": {
        "file": "path/to/file.md",
        "lineNumber": 42
      }
    }
  ]
}
```

### Query Functions

#### tasks.query
Execute Dataview TASK queries with metadata.

**Priority:** 1 (use first for all task queries)
**Parameters:**
- `query` (string, required) - Dataview TASK query
- `format` (string, optional) - "markdown" or "structured"

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks.query",
  "params": {
    "query": "TASK WHERE !completed AND contains(tags, \"#urgent\")",
    "format": "structured"
  }
}
```

#### tasks.list
List tasks filtered by status and path.

**Parameters:**
- `status` (string, optional) - "todo", "done", or "all" (default: "all")
- `path` (string, optional) - Filter by file path

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks.list",
  "params": {
    "status": "todo",
    "path": "Projects/"
  }
}
```

#### tasks.search
Search tasks by text content (case-insensitive substring match).

**Parameters:**
- `query` (string, required) - Search text

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks.search",
  "params": {
    "query": "review PR"
  }
}
```

#### tasks.getByPriority
Get tasks by priority level.

**Parameters:**
- `priority` (string, required) - "HIGH", "MEDIUM", or "LOW" (uppercase)

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks.getByPriority",
  "params": {
    "priority": "HIGH"
  }
}
```

#### tasks.getByTag
Get tasks containing a specific tag.

**Parameters:**
- `tag` (string, required) - Tag name without # symbol

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks.getByTag",
  "params": {
    "tag": "work"
  }
}
```

#### tasks.getWithDueDates
Get tasks with due dates.

**Parameters:**
- `before` (string, optional) - ISO date (YYYY-MM-DD)
- `after` (string, optional) - ISO date (YYYY-MM-DD)

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks.getWithDueDates",
  "params": {
    "before": "2025-02-01"
  }
}
```

#### tasks.getOverdue
Get overdue incomplete tasks (due date before today).

**Parameters:** None

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks.getOverdue"
}
```

#### tasks.getRecurring
Get tasks with recurrence metadata.

**Parameters:** None

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks.getRecurring"
}
```

#### tasks.getStats
Get task statistics and query templates.

**Parameters:**
- `path` (string, optional) - Filter by file path

**Returns:**
```json
{
  "total": 42,
  "completed": 15,
  "incomplete": 27,
  "withPriority": 10,
  "overdue": 3,
  "dueToday": 2,
  "queries": {
    "allTasks": "TASK",
    "incomplete": "TASK WHERE !completed",
    "highPriority": "TASK WHERE priority = \"HIGH\"",
    ...
  }
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks.getStats",
  "params": {
    "path": "Projects/Website.md"
  }
}
```

### Task Modification

**CRITICAL:** When editing tasks, ALWAYS preserve existing metadata ([id::], [created::])!

#### tasks.create
Create and SAVE a task immediately to default/specified file.

**Auto-generates:** `[id::]` and `[created::]` metadata
**Parameters:**
- `description` (string, required) - Task description
- `file` (string, optional) - Target file path (default: "Tasks.md")
- `priority` (string, optional) - "HIGH", "MEDIUM", or "LOW"
- `due` (string, optional) - Due date (YYYY-MM-DD)
- `tags` (array, optional) - Tags (without # symbol)
- `indent` (string, optional) - Indentation for subtasks (e.g., "\t")
- `metadata` (object, optional) - Additional Dataview metadata

**Returns:**
```json
{
  "file": "Tasks.md",
  "lineNumber": 42,
  "taskId": "abc123",
  "line": "- [ ] Task description [id:: abc123] [created:: 2025-01-15]"
}
```

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks.create",
  "params": {
    "description": "Review PR #123",
    "file": "Work/Tasks.md",
    "priority": "HIGH",
    "due": "2025-01-20",
    "tags": ["work", "review"],
    "metadata": {
      "project": "Website",
      "estimate": "2h"
    }
  }
}
```

#### tasks.createTemporaryTask
Generate formatted task line WITHOUT saving (for subtasks or manual insertion).

**Does NOT save** - returns formatted line only
**Parameters:** Same as `tasks.create`
**Returns:** Formatted task line string

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks.createTemporaryTask",
  "params": {
    "description": "Subtask 1",
    "indent": "\t",
    "tags": ["subtask"]
  }
}
```

#### tasks.edit
Edit existing task (PRESERVES [id::] and [created::]; only modifies specified fields).

**Preserves:** All existing metadata unless explicitly changed
**Parameters:**
- `file` (string, required) - File path
- `lineNumber` (number, required) - Line number of task
- `description` (string, optional) - New description
- `priority` (string, optional) - New priority
- `due` (string, optional) - New due date
- `tags` (array, optional) - New tags
- `metadata` (object, optional) - Metadata to add/update

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks.edit",
  "params": {
    "file": "Tasks.md",
    "lineNumber": 42,
    "priority": "MEDIUM",
    "due": "2025-01-25"
  }
}
```

#### tasks.toggle
Toggle task completion status (auto-manages [completion::] metadata).

**Parameters:**
- `file` (string, required) - File path
- `lineNumber` (number, required) - Line number of task

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks.toggle",
  "params": {
    "file": "Tasks.md",
    "lineNumber": 42
  }
}
```

#### tasks.findById
Find task by its [id::] value across the vault.

**Returns:** Task with file path and line number
**Parameters:**
- `id` (string, required) - Task ID to search for

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tasks.findById",
  "params": {
    "id": "abc123"
  }
}
```

## Plugin Utilities

### plugins.list
List all installed plugin IDs.

**Parameters:** None
**Returns:** Array of plugin ID strings

**Example:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "plugins.list"
}
```

### plugins.inspect
Inspect a plugin's API and capabilities.

**Parameters:**
- `pluginId` (string, optional) - Plugin ID to inspect (omit to list all tools)

**Example:**
```json
// List all tools
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "plugins.inspect"
}

// Inspect specific plugin
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "plugins.inspect",
  "params": {
    "pluginId": "dataview"
  }
}
```

## Dataview Metadata Format

The plugin uses Dataview's inline metadata format `[key:: value]` for tasks.

### Task Metadata Fields

**Core Task Fields:**
- `[due:: YYYY-MM-DD]` - Due date (for events, this is the event date)
- `[scheduled:: YYYY-MM-DD]` - Scheduled/reminder date
- `[start:: YYYY-MM-DD]` - Start date
- `[completion:: YYYY-MM-DD]` - Completion date (auto-managed by tasks.toggle)
- `[created:: YYYY-MM-DD]` - Creation date (auto-generated)
- `[cancelled:: YYYY-MM-DD]` - Cancellation date

**Priority and Organization:**
- `[priority:: HIGH]` - High priority (use uppercase: HIGH/MEDIUM/LOW)
- `[priority:: MEDIUM]` - Medium priority
- `[priority:: LOW]` - Low priority
- `[id:: abc123]` - Unique task ID (auto-generated)

**Recurrence:**
- `[recurrence:: every week]` - Weekly recurrence
- `[recurrence:: every month]` - Monthly recurrence
- `[recurrence:: every year]` - Yearly recurrence
- `[repeat:: daily]` - Alternative recurrence format

### Task Examples

**Basic Task:**
```markdown
- [ ] Review PR #work [due:: 2024-12-31] [priority:: HIGH] [id:: xyz789]
```

**Event/Appointment:**
```markdown
- [ ] Team meeting [due:: 2025-01-16] [recurrence:: every week] [id:: abc123]
- [ ] Doctor appointment [due:: 2025-01-20] [scheduled:: 2025-01-19] [id:: def456]
```

**Task with Subtasks:**
```markdown
- [ ] Parent task [due:: 2025-01-25] [priority:: HIGH] [id:: parent123]
	- [ ] Subtask 1 [id:: child456]
	- [ ] Subtask 2 [id:: child789]
```

**Completed Task:**
```markdown
- [x] Completed task [completion:: 2025-01-14] [created:: 2025-01-10] [id:: done123]
```

**Task Status Symbols:**
- `- [ ]` - Incomplete/todo
- `- [x]` - Completed
- `- [/]` - In progress
- `- [-]` - Cancelled

### Metadata Preservation Rules

**CRITICAL:** When editing tasks programmatically:
1. **ALWAYS preserve** `[id::]` if present
2. **ALWAYS preserve** `[created::]` date if present
3. Only modify or add fields that need to change
4. Never delete existing metadata unless explicitly requested

The `tasks.edit` tool automatically preserves existing metadata - you only need to specify fields to add or modify.

## Obsidian Conventions

When working with Obsidian content:

- Use Obsidian-style backlinks: `[[filename]]`
- Use internal TOC links: `[[#Section Name]]`
- Follow Obsidian file naming (lowercase, hyphens/spaces)
- Tasks use Dataview inline metadata format: `[key:: value]`
