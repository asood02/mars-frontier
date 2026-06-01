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

// Host creates a room → becomes seat 0.
export function createRoom(rooms, client, rand) {
  if (rooms.byClient.has(client)) return [{ to: client, msg: { t: 'error', message: 'Already in a room.' } }];
  const code = randomCode(rooms, rand);
  rooms.byCode.set(code, { code, seats: [client, null], state: null });
  rooms.byClient.set(client, { code, seat: 0 });
  return [{ to: client, msg: { t: 'created', code, seat: 0 } }];
}

// Joiner joins an existing room → becomes seat 1.
export function joinRoom(rooms, client, code) {
  const room = rooms.byCode.get((code ?? '').toUpperCase());
  if (!room) return [{ to: client, msg: { t: 'error', message: 'Room not found.' } }];
  if (room.seats[1]) return [{ to: client, msg: { t: 'error', message: 'Room is full.' } }];
  if (rooms.byClient.has(client)) return [{ to: client, msg: { t: 'error', message: 'Already in a room.' } }];
  room.seats[1] = client;
  rooms.byClient.set(client, { code: room.code, seat: 1 });
  const out = [
    { to: client, msg: { t: 'joined', code: room.code, seat: 1 } },
    { to: room.seats[0], msg: { t: 'opponent', joined: true } },
  ];
  // If the host already published a state, send it to the joiner.
  if (room.state) out.push({ to: client, msg: { t: 'state', state: room.state } });
  return out;
}

// Relay a full state snapshot to the other seat in the room.
export function relayState(rooms, client, state) {
  const entry = rooms.byClient.get(client);
  if (!entry) return [];
  const room = rooms.byCode.get(entry.code);
  if (!room) return [];
  room.state = state;
  const other = room.seats[entry.seat === 0 ? 1 : 0];
  return other ? [{ to: other, msg: { t: 'state', state } }] : [];
}

// Handle a disconnect: notify the opponent, free the room if now empty.
export function leave(rooms, client) {
  const entry = rooms.byClient.get(client);
  if (!entry) return [];
  rooms.byClient.delete(client);
  const room = rooms.byCode.get(entry.code);
  if (!room) return [];
  room.seats[entry.seat] = null;
  const other = room.seats[entry.seat === 0 ? 1 : 0];
  if (!room.seats[0] && !room.seats[1]) rooms.byCode.delete(entry.code);
  return other ? [{ to: other, msg: { t: 'opponent', joined: false } }] : [];
}

// Top-level message dispatch used by the server wiring.
export function handleMessage(rooms, client, msg, rand) {
  switch (msg?.t) {
    case 'create':
      return createRoom(rooms, client, rand);
    case 'join':
      return joinRoom(rooms, client, msg.code);
    case 'state':
      return relayState(rooms, client, msg.state);
    default:
      return [{ to: client, msg: { t: 'error', message: `Unknown message: ${msg?.t}` } }];
  }
}
