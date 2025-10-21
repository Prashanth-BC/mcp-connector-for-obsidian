#!/usr/bin/env node
/**
 * WebSocket Bridge Server for Obsidian MCP Connector (Mobile)
 *
 * This server acts as a bridge between MCP clients and the Obsidian mobile plugin.
 * Architecture: [MCP Client] <--> [This Bridge] <--> [Obsidian Plugin via WebSocket]
 *
 * Supported MCP Transports:
 *   - SSE (Server-Sent Events): GET /mcp with Accept: text/event-stream
 *   - HTTP POST: POST /mcp with JSON-RPC messages
 *
 * Usage:
 *   node ws-bridge.js [options]
 *
 * Options:
 *   --ws-port <port>    WebSocket server port (default: 4124)
 *   --http-port <port>  HTTP/MCP server port (default: 4125)
 *   --host <host>       Bind host (default: 127.0.0.1)
 *
 * Environment Variables:
 *   WS_PORT            WebSocket server port
 *   HTTP_PORT          HTTP/MCP server port
 *   HOST               Bind host
 *
 * Example MCP Client Configuration:
 *   {
 *     "mcpServers": {
 *       "obsidian": {
 *         "transport": {
 *           "type": "sse",
 *           "url": "http://127.0.0.1:4125/mcp"
 *         }
 *       }
 *     }
 *   }
 */

const http = require('http');
const { WebSocketServer } = require('ws');

// Parse command-line arguments
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const index = args.indexOf(name);
  if (index > -1 && args[index + 1]) {
    return args[index + 1];
  }
  return defaultValue;
};

const WS_PORT = parseInt(getArg('--ws-port', process.env.WS_PORT || '4124'));
const HTTP_PORT = parseInt(getArg('--http-port', process.env.HTTP_PORT || '4125'));
const HOST = getArg('--host', process.env.HOST || '127.0.0.1');

// State
let obsidianConnection = null;
const pendingRequests = new Map(); // id -> { resolve, reject, timeout }
const sseClients = new Set(); // Set of SSE response objects

// WebSocket Server (for Obsidian plugin connection)
const wss = new WebSocketServer({
  host: HOST,
  port: WS_PORT
});

wss.on('connection', (ws) => {
  console.log('[WS Bridge] ✅ Obsidian plugin connected - Bridge is now READY');
  console.log('[WS Bridge] MCP clients can now connect to http://%s:%d/mcp', HOST, HTTP_PORT);
  obsidianConnection = ws;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('[WS Bridge] Received from Obsidian:', message);

      // Handle response to a pending request
      if (message.id !== undefined && pendingRequests.has(message.id)) {
        const { resolve, timeout } = pendingRequests.get(message.id);
        clearTimeout(timeout);
        pendingRequests.delete(message.id);
        resolve(message);
      }

      // Broadcast server-initiated messages to SSE clients
      // (requests or notifications from the server that aren't responses)
      if (!pendingRequests.has(message.id)) {
        broadcastToSSEClients(message);
      }
    } catch (error) {
      console.error('[WS Bridge] Error parsing message from Obsidian:', error);
    }
  });

  ws.on('close', () => {
    console.log('[WS Bridge] Obsidian plugin disconnected');
    obsidianConnection = null;

    // Reject all pending requests
    for (const [id, { reject, timeout }] of pendingRequests) {
      clearTimeout(timeout);
      reject(new Error('Obsidian connection closed'));
    }
    pendingRequests.clear();
  });

  ws.on('error', (error) => {
    console.error('[WS Bridge] WebSocket error:', error);
  });
});

// HTTP Server (for MCP client connections)
const httpServer = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Last-Event-ID');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      connected: obsidianConnection !== null,
      sseClients: sseClients.size
    }));
    return;
  }

  // Readiness check - only ready when Obsidian is connected
  if (req.url === '/ready' && req.method === 'GET') {
    if (obsidianConnection !== null) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ready: true,
        message: 'Bridge is ready to accept MCP requests'
      }));
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ready: false,
        message: 'Waiting for Obsidian plugin to connect'
      }));
    }
    return;
  }

  // SSE endpoint (GET /mcp)
  if (req.url === '/mcp' && req.method === 'GET') {
    const acceptHeader = req.headers['accept'] || '';

    if (!acceptHeader.includes('text/event-stream')) {
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method Not Allowed: GET requires Accept: text/event-stream');
      return;
    }

    console.log('[WS Bridge] SSE client connected');

    // Set up SSE connection
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable nginx buffering
    });

    // Send initial connection comment
    res.write(': SSE connection established\n\n');

    // Add to SSE clients
    sseClients.add(res);

    // Handle client disconnect
    req.on('close', () => {
      console.log('[WS Bridge] SSE client disconnected');
      sseClients.delete(res);
    });

    return;
  }

  // MCP endpoint
  if (req.url === '/mcp' && req.method === 'POST') {
    if (!obsidianConnection) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32000,
          message: 'Obsidian plugin not connected'
        }
      }));
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const request = JSON.parse(body);
        console.log('[WS Bridge] HTTP request from MCP client:', request);

        // Check if this is a notification (no id field)
        const isNotification = request.id === undefined || request.id === null;

        if (isNotification) {
          // Per MCP spec: notifications should return 202 Accepted
          console.log('[WS Bridge] Received notification, forwarding without waiting for response');

          // Forward to Obsidian but don't wait for response
          if (obsidianConnection) {
            try {
              obsidianConnection.send(JSON.stringify(request));
              console.log('[WS Bridge] Forwarded notification to Obsidian:', request);
            } catch (error) {
              console.error('[WS Bridge] Error forwarding notification:', error);
            }
          }

          res.writeHead(202); // 202 Accepted
          res.end();
          return;
        }

        // For requests (with id), forward to Obsidian and wait for response
        const response = await sendToObsidian(request, 30000); // 30s timeout

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        console.error('[WS Bridge] Error handling MCP request:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32603,
            message: error.message
          }
        }));
      }
    });
    return;
  }

  // Info page
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head><title>Obsidian MCP WebSocket Bridge</title></head>
        <body>
          <h1>Obsidian MCP WebSocket Bridge</h1>
          <p><strong>WebSocket Server:</strong> ws://${HOST}:${WS_PORT}/mcp</p>
          <p><strong>HTTP/MCP Endpoint:</strong> http://${HOST}:${HTTP_PORT}/mcp</p>
          <p><strong>Obsidian Status:</strong> ${obsidianConnection ? '✅ Connected' : '❌ Disconnected'}</p>
          <p><strong>SSE Clients:</strong> ${sseClients.size} connected</p>

          <h2>Supported Transports</h2>
          <ul>
            <li><strong>SSE (Server-Sent Events):</strong> GET /mcp with Accept: text/event-stream</li>
            <li><strong>HTTP POST:</strong> POST /mcp with JSON-RPC messages</li>
          </ul>

          <h2>Usage</h2>
          <ol>
            <li>Configure Obsidian plugin to connect to: <code>ws://${HOST}:${WS_PORT}/mcp</code></li>
            <li>Configure MCP client to use SSE transport: <code>http://${HOST}:${HTTP_PORT}/mcp</code></li>
          </ol>

          <h2>Example Configuration</h2>
          <pre>{
  "mcpServers": {
    "obsidian": {
      "transport": {
        "type": "sse",
        "url": "http://${HOST}:${HTTP_PORT}/mcp"
      }
    }
  }
}</pre>
        </body>
      </html>
    `);
    return;
  }

  // 404
  res.writeHead(404);
  res.end('Not Found');
});

/**
 * Send a request to Obsidian plugin and wait for response
 */
function sendToObsidian(request, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    if (!obsidianConnection) {
      reject(new Error('Obsidian not connected'));
      return;
    }

    const id = request.id;
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('Request timeout'));
    }, timeoutMs);

    pendingRequests.set(id, { resolve, reject, timeout });

    try {
      obsidianConnection.send(JSON.stringify(request));
      console.log('[WS Bridge] Sent to Obsidian:', request);
    } catch (error) {
      clearTimeout(timeout);
      pendingRequests.delete(id);
      reject(error);
    }
  });
}

/**
 * Broadcast a message to all connected SSE clients
 */
function broadcastToSSEClients(message) {
  if (sseClients.size === 0) return;

  const data = JSON.stringify(message);
  const sseMessage = `data: ${data}\n\n`;

  console.log('[WS Bridge] Broadcasting to SSE clients:', message);

  for (const client of sseClients) {
    try {
      client.write(sseMessage);
    } catch (error) {
      console.error('[WS Bridge] Error sending to SSE client:', error);
      sseClients.delete(client);
    }
  }
}

// Start servers
wss.on('listening', () => {
  console.log(`[WS Bridge] WebSocket server listening on ws://${HOST}:${WS_PORT}/mcp`);
  console.log('[WS Bridge] Waiting for Obsidian plugin to connect...');
});

httpServer.listen(HTTP_PORT, HOST, () => {
  console.log(`[WS Bridge] HTTP/MCP server listening on http://${HOST}:${HTTP_PORT}/mcp`);
  console.log('[WS Bridge] ⚠️  NOT READY: Waiting for Obsidian plugin to connect...');
  console.log('[WS Bridge] Check readiness at: http://${HOST}:${HTTP_PORT}/ready');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[WS Bridge] Shutting down...');
  wss.close();
  httpServer.close();
  process.exit(0);
});
