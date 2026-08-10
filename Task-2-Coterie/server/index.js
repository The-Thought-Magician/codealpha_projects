const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const db = require('./db');
const auth = require('./auth');
const posts = require('./routes/posts');
const users = require('./routes/users');
const circles = require('./routes/circles');

const PORT = process.env.PORT || 4001;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(PUBLIC_DIR));

app.use('/api', auth.readSession);
app.use('/api', auth.router);
app.use('/api/posts', posts.router);
app.use('/api/users', users);
app.use('/api/circles', circles);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

db.init()
  .then(() => app.listen(PORT, () => console.log(`Coterie on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('Could not prepare the database:', err.message);
    process.exit(1);
  });
