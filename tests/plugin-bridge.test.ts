/**
 * Basic unit tests (these are lightweight — they mock minimal parts of Obsidian APIs).
 * In CI these should be extended to use proper mocks or an integration harness.
 */

import { PluginBridge } from '../src/plugin-bridge';

test('listTools returns array', () => {
  // Minimal mock
  const app: any = { vault: { getMarkdownFiles: () => [] }, plugins: { plugins: {} } };
  const plugin: any = { app };
  const bridge = new PluginBridge(app as any, plugin as any);
  const tools = bridge.listTools();
  expect(Array.isArray(tools)).toBe(true);
});