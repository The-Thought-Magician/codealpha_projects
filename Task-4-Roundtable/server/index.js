const http = require('http');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const db = require('./db');
const auth = require('./auth');
const signalling = require('./signalling');
const rooms = require('./routes/rooms');

const PORT = process.env.PORT || 4003;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Sent to the browser so the ICE servers can be changed without a rebuild.
// A TURN server is needed for peers behind strict NATs; STUN alone covers
// most home and office networks.
const ICE_SERVERS = (process.env.STUN_URLS || 'stun:stun.l.google.com:19302')
  .split(',')
  .map((url) => ({ urls: url.trim() }))
  .filter((entry) => entry.urls);

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(PUBLIC_DIR));

app.use('/api', auth.readSession);
app.use('/api', auth.router);
app.use('/api/rooms', rooms);
app.get('/api/ice', (req, res) => res.json({ iceServers: ICE_SERVERS, maxPeers: signalling.MAX_PEERS }));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const server = http.createServer(app);
signalling.attach(server);

db.init()
  .then(() => server.listen(PORT, () => console.log(`Roundtable on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('Could not prepare the database:', err.message);
    process.exit(1);
  });
