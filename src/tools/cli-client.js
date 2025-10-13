#!/usr/bin/env node
/*
Simple CLI client to call the Obsidian MCP Bridge.
Place this outside Obsidian plugin (for dev). Usage examples:
  node cli-client.js list
  node cli-client.js tools
  node cli-client.js rpc dataview.query '{"query":"TABLE file.name"}'
  OBSIDIAN_MCP_PORT=8080 node cli-client.js list  # Use custom port
*/

const http = require('http');

function callRpc(method, params, port) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  const opts = { hostname: '127.0.0.1', port, path: '/mcp', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };

  return new Promise((resolve, reject) => {
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function getTools(port) {
  const opts = { hostname: '127.0.0.1', port, path: '/tools', method: 'GET', headers: {} };
  return new Promise((resolve, reject) => {
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const port = process.env.OBSIDIAN_MCP_PORT || '4123';
  const cmd = process.argv[2];
  if (cmd === 'list') {
    const res = await callRpc('vault.listNotes', {}, port);
    console.log(JSON.stringify(res, null, 2));
  } else if (cmd === 'tools') {
    const res = await getTools(port);
    console.log(JSON.stringify(res, null, 2));
  } else if (cmd === 'rpc') {
    const method = process.argv[3];
    const params = process.argv[4] ? JSON.parse(process.argv[4]) : {};
    const res = await callRpc(method, params, port);
    console.log(JSON.stringify(res, null, 2));
  } else {
    console.log('Usage: cli-client.js [list|tools|rpc <method> <params-json>]');
  }
}

main().catch(e => { console.error(e); process.exit(1); });