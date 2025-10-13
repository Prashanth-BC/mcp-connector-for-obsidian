# I am submitting a new Community Plugin

- [x] I attest that I have done my best to deliver a high-quality plugin, am proud of the code I have written, and would recommend it to others. I commit to maintaining the plugin and being responsive to bug reports. If I am no longer able to maintain it, I will make reasonable efforts to find a successor maintainer or withdraw the plugin from the directory.

## Repo URL

<!--- Paste a link to your repo here for easy access -->
Link to my plugin: https://github.com/Prashanth-BC/mcp-connector-for-obsidian

## Release Checklist
- [ ] I have tested the plugin on
  - [ ] Windows
  - [ ] macOS
  - [ ] Linux
  - [ ] Android _(if applicable)_
  - [ ] iOS _(if applicable)_
- [ ] My GitHub release contains all required files (as individual files, not just in the source.zip / source.tar.gz)
  - [ ] `main.js`
  - [ ] `manifest.json`
  - [ ] `styles.css` _(optional)_
- [ ] GitHub release name matches the exact version number specified in my manifest.json (_**Note:** Use the exact version number, don't include a prefix `v`_)
  - Current version in manifest.json: `0.2.0`
  - GitHub release should be named: `0.2.0` (not `v0.2.0`)
- [ ] The `id` in my `manifest.json` matches the `id` in the `community-plugins.json` file.
  - Current plugin ID: `mcp-connector`
- [ ] My README.md describes the plugin's purpose and provides clear usage instructions.
- [ ] I have read the developer policies at https://docs.obsidian.md/Developer+policies, and have assessed my plugin's adherence to these policies.
- [ ] I have read the tips in https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines and have self-reviewed my plugin to avoid these common pitfalls.
- [ ] I have added a license in the LICENSE file.
- [ ] My project respects and is compatible with the original license of any code from other plugins that I'm using.
      I have given proper attribution to these other projects in my `README.md`.

## Plugin Details

**Plugin Name:** MCP Connector for Obsidian
**Plugin ID:** `mcp-connector`
**Version:** 0.2.0
**Author:** Prashanth Bhagyalakshmi Chamegowda
**Description:** Unified connector exposing Obsidian vault tools & plugin APIs (Dataview) over MCP/HTTP.

## Next Steps

1. **Create GitHub Release:**
   - Go to: https://github.com/Prashanth-BC/mcp-connector-for-obsidian/releases/new
   - Tag version: `0.2.0`
   - Release title: `0.2.0`
   - Upload files: `main.js`, `manifest.json`

2. **Test the plugin** on different platforms and check all boxes above

3. **Submit to Community Plugins:**
   - Fork the obsidian-releases repository
   - Add your plugin entry to `community-plugins.json`
   - Create a pull request with this checklist