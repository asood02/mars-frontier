import { describe, it, expect, afterAll } from 'vitest';
import WebSocket from 'ws';
import { startServer } from '../../server/index.mjs';

const PORT = 8799;
const URL = `ws://localhost:${PORT}`;
let wss: { close(cb?: () => void): void } | null = null;

function client(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

// Resolve with the next message of a given type.
function next(ws: WebSocket, t: string): Promise<any> {
  return new Promise((resolve) => {
    const handler = (data: WebSocket.RawData) => {
      const msg = JSON.parse(data.toString());
      if (msg.t === t) {
        ws.off('message', handler);
        resolve(msg);
      }
    };
    ws.on('message', handler);
  });
}

describe('relay server integration (real sockets)', () => {
  it('pairs two clients and relays a state snapshot end-to-end', async () => {
    wss = startServer(PORT);

    const a = await client();
    const createdP = next(a, 'created');
    a.send(JSON.stringify({ t: 'create' }));
    const created = await createdP;
    expect(created.seat).toBe(0);
    const code = created.code as string;

    const b = await client();
    const opponentP = next(a, 'opponent');
    const joinedP = next(b, 'joined');
    b.send(JSON.stringify({ t: 'join', code }));
    expect((await joinedP).seat).toBe(1);
    expect((await opponentP).joined).toBe(true);

    // Host publishes state → joiner receives the same snapshot.
    const stateP = next(b, 'state');
    a.send(JSON.stringify({ t: 'state', state: { turn: 42, code } }));
    expect((await stateP).state).toEqual({ turn: 42, code });

    a.close();
    b.close();
  });

  afterAll(
    () =>
      new Promise<void>((resolve) => {
        if (wss) wss.close(() => resolve());
        else resolve();
      }),
  );
});
