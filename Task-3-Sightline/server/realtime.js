const { WebSocketServer } = require('ws');
const db = require('./db');
const { userIdFromToken, TOKEN_COOKIE } = require('./auth');

// projectId -> Set of sockets currently watching that board.
const rooms = new Map();

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [name, ...rest] = part.trim().split('=');
      return [name, decodeURIComponent(rest.join('='))];
    })
  );
}

async function isMember(projectId, userId) {
  const { rowCount } = await db.query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  );
  return rowCount > 0;
}

function join(projectId, socket) {
  if (!rooms.has(projectId)) rooms.set(projectId, new Set());
  rooms.get(projectId).add(socket);
}

function leave(socket) {
  for (const [projectId, sockets] of rooms) {
    sockets.delete(socket);
    if (!sockets.size) rooms.delete(projectId);
  }
}

// Sends an event to every socket on a board, including the one belonging to
// whoever caused it: a person with the board open in two tabs needs both to
// update. Events carry the full new state, so applying one twice is harmless.
function broadcast(projectId, event) {
  const sockets = rooms.get(Number(projectId));
  if (!sockets) return;

  const payload = JSON.stringify(event);
  for (const socket of sockets) {
    if (socket.readyState === socket.OPEN) socket.send(payload);
  }
}

function attach(server) {
  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on('connection', async (socket, req) => {
    const cookies = parseCookies(req.headers.cookie);
    const userId = userIdFromToken(cookies[TOKEN_COOKIE]);
    const projectId = Number(new URL(req.url, 'http://localhost').searchParams.get('project'));

    if (!userId || !projectId || !(await isMember(projectId, userId))) {
      socket.close(4001, 'Not allowed on this board.');
      return;
    }

    socket.userId = userId;
    join(projectId, socket);
    socket.send(JSON.stringify({ type: 'ready', projectId }));

    socket.on('close', () => leave(socket));
    socket.on('error', () => leave(socket));
  });

  return wss;
}

module.exports = { attach, broadcast };
