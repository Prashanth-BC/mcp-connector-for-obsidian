import { App } from 'obsidian';

/**
 * Templater adapter that attempts multiple safely-ordered strategies
 * to render templates across different Templater versions.
 */
export class TemplaterAdapter {
  app: App;
  tpApi: any;

  constructor(app: App, tpApi: any) {
    this.app = app;
    this.tpApi = tpApi;
  }

  async render(params: any) {
    const template = params.template;
    const context = params.context || {};
    const path = params.path; // optional path to render in file context
    if (!template) throw new Error('missing template');

    // Strategy 1: common `renderTemplate` API
    if (this.tpApi && typeof this.tpApi.renderTemplate === 'function') {
      return await this.tpApi.renderTemplate(template, context, path);
    }

    // Strategy 2: older Templater exposes `tp` object with user functions or `replaceInFile`
    if (this.tpApi && typeof this.tpApi.run === 'function') {
      // run could accept a template and context depending on versions
      return await this.tpApi.run(template, context, path);
    }

    // Strategy 3: compile-like API
    if (this.tpApi && typeof this.tpApi.compile === 'function') {
      const compiled = await this.tpApi.compile(template);
      if (typeof compiled === 'function') return await compiled(context);
      return compiled;
    }

    // Strategy 4: fallback - simple variable interpolation for common {{var}} or <% %> patterns
    return this.simpleInterpolation(template, context);
  }

  simpleInterpolation(template: string, context: Record<string, any>) {
    // Replace {{key}} occurrences
    let out = String(template);
    Object.keys(context).forEach(k => {
      const re = new RegExp('{{\s*' + k + '\s*}}', 'g');
      out = out.replace(re, String(context[k]));
    });
    // Replace <% key %> as a second pass (naive)
    Object.keys(context).forEach(k => {
      const re = new RegExp('<%\s*' + k + '\s*%>', 'g');
      out = out.replace(re, String(context[k]));
    });
    return out;
  }
}