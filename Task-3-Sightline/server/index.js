const http = require('http');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const db = require('./db');
const auth = require('./auth');
const realtime = require('./realtime');
const projects = require('./routes/projects');
const { boardRouter, taskRouter } = require('./routes/tasks');

const PORT = process.env.PORT || 4002;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(PUBLIC_DIR));

app.use('/api', auth.readSession);
app.use('/api', auth.router);
app.use('/api/projects/:id/tasks', boardRouter);
app.use('/api/projects', projects);
app.use('/api/tasks', taskRouter);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const server = http.createServer(app);
realtime.attach(server);

db.init()
  .then(() => server.listen(PORT, () => console.log(`Sightline on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('Could not prepare the database:', err.message);
    process.exit(1);
  });
