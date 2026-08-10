const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const TOKEN_COOKIE = 'session';
const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  };
}

async function readSession(req, res, next) {
  const token = req.cookies[TOKEN_COOKIE];
  if (!token) return next();
  try {
    req.userId = jwt.verify(token, process.env.JWT_SECRET).sub;
  } catch {
    res.clearCookie(TOKEN_COOKIE, cookieOptions());
  }
  next();
}

function requireLogin(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: 'Please sign in.' });
  next();
}

function publicUser(row) {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio,
    createdAt: row.created_at,
  };
}

function startSession(res, userId) {
  const token = jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie(TOKEN_COOKIE, token, cookieOptions());
}

const router = express.Router();

router.post('/register', async (req, res) => {
  const handle = String(req.body.handle || '').trim().toLowerCase();
  const displayName = String(req.body.displayName || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!HANDLE_PATTERN.test(handle)) {
    return res.status(400).json({ error: 'Handles are 3 to 20 characters: letters, numbers, underscore.' });
  }
  if (!displayName || !email || password.length < 8) {
    return res.status(400).json({ error: 'Name, email, and a password of 8+ characters are required.' });
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await db.query(
      `INSERT INTO users (handle, display_name, email, password_hash)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [handle, displayName, email, hash]
    );
    startSession(res, rows[0].id);
    res.status(201).json({ user: publicUser(rows[0]) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That handle or email is already taken.' });
    }
    throw err;
  }
});

router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Wrong email or password.' });
  }

  startSession(res, user.id);
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  res.clearCookie(TOKEN_COOKIE, cookieOptions());
  res.status(204).end();
});

router.get('/me', requireLogin, async (req, res) => {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [req.userId]);
  if (!rows[0]) return res.status(401).json({ error: 'Please sign in.' });
  res.json({ user: publicUser(rows[0]) });
});

module.exports = { router, readSession, requireLogin, publicUser };
