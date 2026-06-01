import { describe, it, expect } from 'vitest';
// The relay room logic lives in plain JS so the server can run it without a build.
import {
  makeRooms,
  createRoom,
  joinRoom,
  relayState,
  leave,
  handleMessage,
} from '../../server/rooms.mjs';

describe('relay rooms', () => {
  it('createRoom seats the host at 0 and returns a code', () => {
    const rooms = makeRooms();
    const out = createRoom(rooms, 'A', () => 0);
    expect(out[0].to).toBe('A');
    expect(out[0].msg.t).toBe('created');
    expect(out[0].msg.seat).toBe(0);
    expect(typeof out[0].msg.code).toBe('string');
  });

  it('joinRoom seats the joiner at 1 and notifies the host', () => {
    const rooms = makeRooms();
    const code = createRoom(rooms, 'A', () => 0)[0].msg.code as string;
    const out = joinRoom(rooms, 'B', code);
    const joined = out.find((d: any) => d.to === 'B' && d.msg.t === 'joined')!;
    const notify = out.find((d: any) => d.to === 'A' && d.msg.t === 'opponent')!;
    expect(joined.msg.seat).toBe(1);
    expect(notify.msg.joined).toBe(true);
  });

  it('rejects joining an unknown or full room', () => {
    const rooms = makeRooms();
    expect(joinRoom(rooms, 'B', 'ZZZZZZ')[0].msg.t).toBe('error');
    const code = createRoom(rooms, 'A', () => 0)[0].msg.code as string;
    joinRoom(rooms, 'B', code);
    expect(joinRoom(rooms, 'C', code)[0].msg.message).toMatch(/full/i);
  });

  it('relays state to the other seat only', () => {
    const rooms = makeRooms();
    const code = createRoom(rooms, 'A', () => 0)[0].msg.code as string;
    joinRoom(rooms, 'B', code);
    const out = relayState(rooms, 'A', { turn: 5 });
    expect(out).toHaveLength(1);
    expect(out[0].to).toBe('B');
    expect(out[0].msg).toEqual({ t: 'state', state: { turn: 5 } });
  });

  it('sends the latest state to a late joiner', () => {
    const rooms = makeRooms();
    const code = createRoom(rooms, 'A', () => 0)[0].msg.code as string;
    // host publishes before anyone joins (allowed; stored)
    relayState(rooms, 'A', { turn: 1 });
    const out = joinRoom(rooms, 'B', code);
    expect(out.some((d: any) => d.to === 'B' && d.msg.t === 'state')).toBe(true);
  });

  it('leave notifies the opponent and frees an empty room', () => {
    const rooms = makeRooms();
    const code = createRoom(rooms, 'A', () => 0)[0].msg.code as string;
    joinRoom(rooms, 'B', code);
    const out = leave(rooms, 'A');
    expect(out[0].to).toBe('B');
    expect(out[0].msg.joined).toBe(false);
    leave(rooms, 'B');
    expect(rooms.byCode.has(code)).toBe(false);
  });

  it('handleMessage routes create/join/state', () => {
    const rooms = makeRooms();
    expect(handleMessage(rooms, 'A', { t: 'create' }, () => 0)[0].msg.t).toBe('created');
    expect(handleMessage(rooms, 'A', { t: 'bogus' })[0].msg.t).toBe('error');
  });

  it('supports 3–4 seat rooms: seats fill in order and report roster', () => {
    const rooms = makeRooms();
    const created = createRoom(rooms, 'A', () => 0, 3)[0].msg;
    expect(created.capacity).toBe(3);
    const j1 = joinRoom(rooms, 'B', created.code as string);
    expect(j1.find((d: any) => d.to === 'B').msg.seat).toBe(1);
    // host A is notified with the new roster count
    expect(j1.find((d: any) => d.to === 'A').msg.filled).toBe(2);
    const j2 = joinRoom(rooms, 'C', created.code as string);
    expect(j2.find((d: any) => d.to === 'C').msg.seat).toBe(2);
    expect(j2.find((d: any) => d.to === 'C').msg.filled).toBe(3);
    // a 4th joiner is rejected (room now full)
    expect(joinRoom(rooms, 'D', created.code as string)[0].msg.message).toMatch(/full/i);
  });

  it('relays state to every other seat in a 3-player room', () => {
    const rooms = makeRooms();
    const code = createRoom(rooms, 'A', () => 0, 3)[0].msg.code as string;
    joinRoom(rooms, 'B', code);
    joinRoom(rooms, 'C', code);
    const out = relayState(rooms, 'A', { turn: 9 });
    expect(out.map((d: any) => d.to).sort()).toEqual(['B', 'C']);
    expect(out.every((d: any) => d.msg.t === 'state')).toBe(true);
  });
});
