// Pure room-management logic for the Mars Frontier relay server.
// Framework-free and socket-free so it can be unit-tested. A "client" is any
// opaque token (a WebSocket in production, a string in tests). Functions return
// a list of { to, msg } directives the caller delivers; they never do I/O.

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeRooms() {
  return { byCode: new Map(), byClient: new Map() };
}

function randomCode(rooms, rand = Math.random) {
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)];
  } while (rooms.byCode.has(code));
  return code;
}

const MIN_CAP = 2;
const MAX_CAP = 4;

function filledCount(room) {
  return room.seats.filter((s) => s != null).length;
}

// Every occupied seat in the room except `client`.
function others(room, client) {
  return room.seats.filter((s) => s != null && s !== client);
}

// Host creates a room → becomes seat 0. `capacity` (2–4) sets the table size.
export function createRoom(rooms, client, rand, capacity = MIN_CAP) {
  if (rooms.byClient.has(client)) return [{ to: client, msg: { t: 'error', message: 'Already in a room.' } }];
  const cap = Math.min(MAX_CAP, Math.max(MIN_CAP, capacity | 0));
  const code = randomCode(rooms, rand);
  const seats = new Array(cap).fill(null);
  seats[0] = client;
  rooms.byCode.set(code, { code, capacity: cap, seats, state: null });
  rooms.byClient.set(client, { code, seat: 0 });
  return [{ to: client, msg: { t: 'created', code, seat: 0, capacity: cap, filled: 1 } }];
}

// Joiner takes the first open seat. Notifies everyone already in the room.
export function joinRoom(rooms, client, code) {
  const room = rooms.byCode.get((code ?? '').toUpperCase());
  if (!room) return [{ to: client, msg: { t: 'error', message: 'Room not found.' } }];
  if (rooms.byClient.has(client)) return [{ to: client, msg: { t: 'error', message: 'Already in a room.' } }];
  const seat = room.seats.findIndex((s) => s == null);
  if (seat < 0) return [{ to: client, msg: { t: 'error', message: 'Room is full.' } }];
  room.seats[seat] = client;
  rooms.byClient.set(client, { code: room.code, seat });
  const filled = filledCount(room);
  const out = [
    { to: client, msg: { t: 'joined', code: room.code, seat, capacity: room.capacity, filled } },
  ];
  // Tell everyone already seated that the roster changed.
  for (const c of others(room, client)) {
    out.push({ to: c, msg: { t: 'opponent', joined: true, capacity: room.capacity, filled } });
  }
  // If the host already published a state, send it to the joiner.
  if (room.state) out.push({ to: client, msg: { t: 'state', state: room.state } });
  return out;
}

// Relay a full state snapshot to every other seat in the room.
export function relayState(rooms, client, state) {
  const entry = rooms.byClient.get(client);
  if (!entry) return [];
  const room = rooms.byCode.get(entry.code);
  if (!room) return [];
  room.state = state;
  return others(room, client).map((to) => ({ to, msg: { t: 'state', state } }));
}

// Handle a disconnect: notify everyone left, free the room if now empty.
export function leave(rooms, client) {
  const entry = rooms.byClient.get(client);
  if (!entry) return [];
  rooms.byClient.delete(client);
  const room = rooms.byCode.get(entry.code);
  if (!room) return [];
  room.seats[entry.seat] = null;
  const remaining = others(room, client);
  if (filledCount(room) === 0) rooms.byCode.delete(entry.code);
  const filled = filledCount(room);
  return remaining.map((to) => ({
    to,
    msg: { t: 'opponent', joined: false, capacity: room.capacity, filled },
  }));
}

// Top-level message dispatch used by the server wiring.
export function handleMessage(rooms, client, msg, rand) {
  switch (msg?.t) {
    case 'create':
      return createRoom(rooms, client, rand, msg.capacity);
    case 'join':
      return joinRoom(rooms, client, msg.code);
    case 'state':
      return relayState(rooms, client, msg.state);
    default:
      return [{ to: client, msg: { t: 'error', message: `Unknown message: ${msg?.t}` } }];
  }
}
