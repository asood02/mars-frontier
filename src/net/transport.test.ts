import { describe, it, expect } from 'vitest';
import { createTransport } from './transport';
import type { SocketLike, LobbyEvent } from './transport';

// A controllable fake socket.
class FakeSocket implements SocketLike {
  readyState = 0; // CONNECTING
  sent: string[] = [];
  private listeners: Record<string, ((ev: any) => void)[]> = {};
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.emit('close', {});
  }
  addEventListener(type: string, cb: (ev: any) => void) {
    (this.listeners[type] ??= []).push(cb);
  }
  emit(type: string, ev: any) {
    (this.listeners[type] ?? []).forEach((cb) => cb(ev));
  }
  open() {
    this.readyState = 1;
    this.emit('open', {});
  }
}

describe('createTransport', () => {
  it('queues messages until the socket opens, then flushes', () => {
    const sock = new FakeSocket();
    const t = createTransport('ws://x', () => sock);
    t.create(); // before open → queued
    expect(sock.sent).toHaveLength(0);
    sock.open();
    expect(sock.sent).toHaveLength(1);
    expect(JSON.parse(sock.sent[0])).toEqual({ t: 'create' });
  });

  it('routes state messages to onState and others to onLobby', () => {
    const sock = new FakeSocket();
    const t = createTransport('ws://x', () => sock);
    sock.open();
    const lobby: LobbyEvent[] = [];
    const states: unknown[] = [];
    t.onLobby((e) => lobby.push(e));
    t.onState((s) => states.push(s));

    sock.emit('message', { data: JSON.stringify({ t: 'created', code: 'ABC123', seat: 0 }) });
    sock.emit('message', { data: JSON.stringify({ t: 'state', state: { turn: 3 } }) });

    expect(lobby).toEqual([{ t: 'created', code: 'ABC123', seat: 0 }]);
    expect(states).toEqual([{ turn: 3 }]);
  });

  it('sends join and state frames', () => {
    const sock = new FakeSocket();
    const t = createTransport('ws://x', () => sock);
    sock.open();
    t.join('WXYZ12');
    t.sendState({ turn: 9 } as never);
    expect(JSON.parse(sock.sent[0])).toEqual({ t: 'join', code: 'WXYZ12' });
    expect(JSON.parse(sock.sent[1])).toEqual({ t: 'state', state: { turn: 9 } });
  });
});
