import { App, TFile } from "obsidian";

export class TasksAdapter {
  app: App;
  tasksApi: any;

  constructor(app: App, tasksApi: any) {
    this.app = app;
    this.tasksApi = tasksApi;
  }

  async query(params: any) {
    const filter = params.filter || params;
    if (typeof this.tasksApi.query === 'function') {
      return await this.tasksApi.query(filter);
    }
    // fallback: naive parser
    return await this.list({ filter });
  }

  async list(params: any) {
    const filter = params.filter || '';
    const files = this.app.vault.getMarkdownFiles();
    const tasksFound: any[] = [];
    for (const f of files) {
      if (!(f instanceof TFile)) continue;
      const content = await this.app.vault.read(f);
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/^- \[[ xX]?\] /)) {
          if (!filter || line.includes(filter)) tasksFound.push({ file: f.path, line: i + 1, text: line.trim() });
        }
      }
    }
    return tasksFound;
  }
}