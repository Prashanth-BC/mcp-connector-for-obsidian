import { App } from "obsidian";

// Adapter for Dataview plugin API
export class DataviewAdapter {
  app: App;
  dvApi: any;

  constructor(app: App, dvApi: any) {
    this.app = app;
    this.dvApi = dvApi;
  }

  async query(params: any) {
    const q = params.query || params;
    if (!q) throw new Error('missing query');
    
    // Use Dataview's native queryMarkdown for optimal markdown output
    if (typeof this.dvApi.queryMarkdown === 'function') {
      const result = await this.dvApi.queryMarkdown(q);
      return result.successful ? result.value : result.error;
    }
    
    // Fallback to tryQueryMarkdown if available
    if (typeof this.dvApi.tryQueryMarkdown === 'function') {
      return await this.dvApi.tryQueryMarkdown(q);
    }
    
    throw new Error('Dataview queryMarkdown API not available');
  }

  // convenience: get processed page for a path
  async page(params: any) {
    const path = params.path || params;
    if (!path) throw new Error('missing path');
    if (typeof this.dvApi.page === 'function') return await this.dvApi.page(path);
    throw new Error('dataview api does not expose page()');
  }
}