#!/usr/bin/env tsx
import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { WebSocketServer, WebSocket } from 'ws';
import * as store from './lib/store.js';
import * as localManager from './lib/local-manager.js';
import type { BridgeMessage, UIMessage } from './lib/types.js';

async function main() {
  if (process.env.IS_LOCAL === 'true') {
    localManager.resetAllPids();
  }

  const dev = process.env.NODE_ENV !== 'production';
  const port = Number(process.env.PORT ?? 3000);

  const app = next({ dev });
  const handle = app.getRequestHandler();

  await app.prepare();

  const httpServer = createServer((req, res) => {
    const url = req.url ?? '/';
    if (url === '/' || url === '') {
      res.writeHead(302, { Location: '/bridge' });
      res.end();
      return;
    }
    handle(req, res, parse(url, true));
  });

  const wss = new WebSocketServer({ noServer: true });

  // ── Bridge connections (/ws/bridge) ──────────────────────────────────────────
  const bridgeWss = new WebSocketServer({ noServer: true });

  bridgeWss.on('connection', (ws) => {
    let registeredPath: string | null = null;

    ws.on('message', (raw) => {
      let msg: BridgeMessage;
      try { msg = JSON.parse(raw.toString()) as BridgeMessage; }
      catch { return; }

      switch (msg.type) {
        case 'register':
          registeredPath = msg.projectPath;
          store.registerBridge(msg.projectPath, msg.sessionId, ws);
          if (process.env.IS_LOCAL === 'true' && msg.pid) {
            localManager.updatePid(msg.projectPath, msg.pid);
          }
          break;

        case 'output':
          if (registeredPath) store.handleOutput(registeredPath, msg.text, msg.sessionId);
          break;

        case 'tool_request':
          if (registeredPath) {
            if (msg.autoApproved) {
              store.handleAutoApprovedToolRequest(registeredPath, msg.requestId, msg.toolName, msg.input);
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'tool_decision', requestId: msg.requestId, allow: true }));
              }
            } else {
              store.handleToolRequest(registeredPath, msg.requestId, msg.toolName, msg.input)
                .then((allow) => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'tool_decision', requestId: msg.requestId, allow }));
                  }
                });
            }
          }
          break;

        case 'turn_complete':
          if (registeredPath) store.handleTurnComplete(registeredPath);
          break;

        case 'error':
          console.error(`[bridge:${registeredPath}] ${msg.message}`);
          break;
      }
    });

    ws.on('close', () => {
      if (registeredPath) store.unregisterBridge(registeredPath);
    });
  });

  // ── UI connections (/ws/ui) ───────────────────────────────────────────────────
  wss.on('connection', (ws) => {
    let subscribedPath: string | null = null;

    ws.send(JSON.stringify({ type: 'project_list', projects: store.getProjectList() }));

    ws.on('message', (raw) => {
      let msg: UIMessage;
      try { msg = JSON.parse(raw.toString()) as UIMessage; }
      catch { return; }

      switch (msg.type) {
        case 'subscribe':
          if (subscribedPath) store.unsubscribeUI(ws);
          subscribedPath = msg.projectPath;
          store.subscribeUI(msg.projectPath, ws);
          break;

        case 'send_prompt':
          store.sendPromptToBridge(msg.projectPath, msg.text);
          break;

        case 'tool_decision':
          store.resolveToolRequest(msg.projectPath, msg.requestId, msg.allow, msg.answer);
          break;

        case 'set_auto_approve':
          store.setAutoApprove(msg.projectPath, msg.enabled);
          break;

        case 'load_more': {
          const { entries, hasMore } = store.loadHistory(msg.projectPath, msg.before);
          ws.send(JSON.stringify({ type: 'history_chunk', entries, hasMore }));
          break;
        }
      }
    });

    ws.on('close', () => {
      if (subscribedPath) store.unsubscribeUI(ws);
    });
  });

  // ── HTTP upgrade routing ──────────────────────────────────────────────────────
  httpServer.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url ?? '/');
    if (pathname === '/ws/bridge') {
      bridgeWss.handleUpgrade(req, socket, head, (ws) => bridgeWss.emit('connection', ws, req));
    } else if (pathname === '/ws/ui') {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    } else {
      socket.destroy();
    }
  });

  httpServer.listen(port, () => {
    console.log(`> cloud-relay ready on http://localhost:${port}`);
    console.log(`  Bridge WS : ws://localhost:${port}/ws/bridge`);
    console.log(`  UI WS     : ws://localhost:${port}/ws/ui`);
  });
}

main().catch(console.error);
