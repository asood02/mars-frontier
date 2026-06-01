// Mars Frontier relay server — a tiny WebSocket hub that pairs two players into
// a room and relays full game-state snapshots between them. No database, no
// account: clients trust each other (spec §4.4). Run with `npm run server`.
import http from 'http';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { makeRooms, handleMessage, leave } from './rooms.mjs';

export function startServer(port = Number(process.env.PORT ?? 8787)) {
  const rooms = makeRooms();

  // A real HTTP server so cloud hosts (Render/Railway/Fly) can health-check the
  // service; WebSocket upgrades are handled on the same port/server.
  const httpServer = http.createServer((req, res) => {
    if (req.url === '/healthz' || req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('Mars Frontier relay: OK');
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const wss = new WebSocketServer({ server: httpServer });

  const send = (client, msg) => {
    if (client && client.readyState === client.OPEN) client.send(JSON.stringify(msg));
  };

  wss.on('connection', (ws) => {
    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return send(ws, { t: 'error', message: 'Bad JSON.' });
      }
      for (const { to, msg: out } of handleMessage(rooms, ws, msg)) send(to, out);
    });
    const onGone = () => {
      for (const { to, msg: out } of leave(rooms, ws)) send(to, out);
    };
    ws.on('close', onGone);
    ws.on('error', onGone);
  });

  httpServer.listen(port);

  // Mirror WebSocketServer's `.close(cb)` contract (used by tests) but tear down
  // both the WS layer and the underlying HTTP server.
  return {
    wss,
    httpServer,
    close(cb) {
      wss.close(() => httpServer.close(() => cb && cb()));
    },
  };
}

// Auto-start only when run directly (not when imported by a test).
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8787);
  startServer(port);
  // eslint-disable-next-line no-console
  console.log(`Mars Frontier relay listening on ws://localhost:${port} (health: /healthz)`);
}
