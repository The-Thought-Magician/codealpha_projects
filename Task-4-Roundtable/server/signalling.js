const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const db = require('./db');
const { userIdFromToken, TOKEN_COOKIE } = require('./auth');

// Room slug -> Map of peerId -> socket. The server never sees media or file
// contents; it only relays the offers, answers, and ICE candidates that let
// two browsers connect to each other directly.
const rooms = new Map();

const MAX_PEERS = 6;

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').filter(Boolean).map((part) => {
      const [name, ...rest] = part.trim().split('=');
      return [name, decodeURIComponent(rest.join('='))];
    })
  );
}

function send(socket, payload) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(payload));
}

function peersIn(slug) {
  return rooms.get(slug) || new Map();
}

function announce(slug, payload, exceptPeerId) {
  for (const [peerId, socket] of peersIn(slug)) {
    if (peerId !== exceptPeerId) send(socket, payload);
  }
}

function removePeer(socket) {
  const room = rooms.get(socket.roomSlug);
  if (!room) return;
  room.delete(socket.peerId);
  if (room.size === 0) rooms.delete(socket.roomSlug);
  else announce(socket.roomSlug, { type: 'peer-left', peerId: socket.peerId });
}

async function authorise(req) {
  const cookies = parseCookies(req.headers.cookie);
  const userId = userIdFromToken(cookies[TOKEN_COOKIE]);
  const slug = new URL(req.url, 'http://localhost').searchParams.get('room');
  if (!userId || !slug) return null;

  const room = await db.query('SELECT id FROM rooms WHERE slug = $1', [slug]);
  if (!room.rows[0]) return null;

  const user = await db.query('SELECT name FROM users WHERE id = $1', [userId]);
  if (!user.rows[0]) return null;

  return { userId, slug, roomId: room.rows[0].id, name: user.rows[0].name };
}

function attach(server) {
  const wss = new WebSocketServer({ server, path: '/signal' });

  wss.on('connection', async (socket, req) => {
    const session = await authorise(req);
    if (!session) return socket.close(4001, 'Sign in and pick a room that exists.');

    const room = rooms.get(session.slug) || new Map();
    if (room.size >= MAX_PEERS) return socket.close(4002, `This room is full (${MAX_PEERS} people).`);

    socket.peerId = crypto.randomUUID();
    socket.roomSlug = session.slug;
    socket.displayName = session.name;

    const existing = [...room].map(([peerId, peer]) => ({ peerId, name: peer.displayName }));
    room.set(socket.peerId, socket);
    rooms.set(session.slug, room);

    await db.query('INSERT INTO room_visits (room_id, user_id) VALUES ($1,$2)', [
      session.roomId, session.userId,
    ]);

    // The newcomer is told who is already here and calls each of them, so two
    // peers never send each other an offer at the same time.
    send(socket, { type: 'welcome', peerId: socket.peerId, name: session.name, peers: existing });
    announce(session.slug, { type: 'peer-joined', peerId: socket.peerId, name: session.name }, socket.peerId);

    socket.on('message', (raw) => relay(socket, raw));
    socket.on('close', () => removePeer(socket));
    socket.on('error', () => removePeer(socket));
  });

  return wss;
}

// Relays one message to one named peer in the same room. A peer id from
// another room is ignored, so a client cannot reach outside its own call.
function relay(socket, raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }
  if (message.type !== 'signal' || !message.to) return;

  const target = peersIn(socket.roomSlug).get(message.to);
  if (!target) return;

  send(target, {
    type: 'signal',
    from: socket.peerId,
    name: socket.displayName,
    data: message.data,
  });
}

module.exports = { attach, MAX_PEERS };
