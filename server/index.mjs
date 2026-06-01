// Mars Frontier relay server — a tiny WebSocket hub that pairs two players into
// a room and relays full game-state snapshots between them. No database, no
// account: clients trust each other (spec §4.4). Run with `npm run server`.
import { WebSocketServer } from 'ws';
import { makeRooms, handleMessage, leave } from './rooms.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const rooms = makeRooms();
const wss = new WebSocketServer({ port: PORT });

function send(client, msg) {
  if (client && client.readyState === client.OPEN) client.send(JSON.stringify(msg));
}

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

  ws.on('close', () => {
    for (const { to, msg: out } of leave(rooms, ws)) send(to, out);
  });

  ws.on('error', () => {
    for (const { to, msg: out } of leave(rooms, ws)) send(to, out);
  });
});

// eslint-disable-next-line no-console
console.log(`Mars Frontier relay listening on ws://localhost:${PORT}`);
