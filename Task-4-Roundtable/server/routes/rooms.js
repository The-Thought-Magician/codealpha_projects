const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireLogin } = require('../auth');

const router = express.Router();

function slugify(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `${base || 'room'}-${crypto.randomBytes(16).toString('hex')}`;
}

function toRoom(row) {
  return {
    slug: row.slug,
    name: row.name,
    mine: row.mine,
    createdAt: row.created_at,
    lastVisit: row.last_visit,
  };
}

router.use(requireLogin);

// Rooms you made, plus any you have joined before.
router.get('/', async (req, res) => {
  const { rows } = await db.query(
    `SELECT r.slug, r.name, r.created_at,
            (r.owner_id = $1) AS mine,
            (SELECT max(joined_at) FROM room_visits v
             WHERE v.room_id = r.id AND v.user_id = $1) AS last_visit
     FROM rooms r
     WHERE r.owner_id = $1
        OR EXISTS (SELECT 1 FROM room_visits v WHERE v.room_id = r.id AND v.user_id = $1)
     ORDER BY coalesce((SELECT max(joined_at) FROM room_visits v
                        WHERE v.room_id = r.id AND v.user_id = $1), r.created_at) DESC`,
    [req.userId]
  );
  res.json(rows.map(toRoom));
});

router.post('/', async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Give the room a name.' });

  const { rows } = await db.query(
    'INSERT INTO rooms (slug, name, owner_id) VALUES ($1,$2,$3) RETURNING *',
    [slugify(name), name, req.userId]
  );
  res.status(201).json(toRoom({ ...rows[0], mine: true, last_visit: null }));
});

router.get('/:slug', async (req, res) => {
  const { rows } = await db.query(
    'SELECT *, (owner_id = $1) AS mine, NULL AS last_visit FROM rooms WHERE slug = $2',
    [req.userId, req.params.slug]
  );
  if (!rows[0]) return res.status(404).json({ error: 'No room with that link.' });
  res.json(toRoom(rows[0]));
});

module.exports = router;
