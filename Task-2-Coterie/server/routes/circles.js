const express = require('express');
const db = require('../db');
const { requireLogin } = require('../auth');
const { POST_SELECT, toPost } = require('./posts');

const router = express.Router();

const CIRCLE_SELECT = `
  SELECT c.id, c.slug, c.name, c.description,
         (SELECT count(*) FROM memberships m WHERE m.circle_id = c.id) AS member_count,
         (SELECT count(*) FROM posts p WHERE p.circle_id = c.id) AS post_count,
         EXISTS (SELECT 1 FROM memberships m
                 WHERE m.circle_id = c.id AND m.user_id = $1) AS joined
  FROM circles c
`;

function toCircle(row) {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    memberCount: Number(row.member_count),
    postCount: Number(row.post_count),
    joined: row.joined,
  };
}

router.get('/', requireLogin, async (req, res) => {
  const { rows } = await db.query(`${CIRCLE_SELECT} ORDER BY c.name`, [req.userId]);
  res.json(rows.map(toCircle));
});

router.get('/:slug', requireLogin, async (req, res) => {
  const { rows } = await db.query(`${CIRCLE_SELECT} WHERE c.slug = $2`, [
    req.userId, req.params.slug,
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'No such circle.' });
  res.json(toCircle(rows[0]));
});

router.get('/:slug/posts', requireLogin, async (req, res) => {
  const { rows } = await db.query(
    `${POST_SELECT} WHERE c.slug = $2 ORDER BY p.created_at DESC LIMIT 100`,
    [req.userId, req.params.slug]
  );
  res.json(rows.map((r) => toPost(r, req.userId)));
});

router.post('/:slug/join', requireLogin, async (req, res) => {
  const found = await db.query('SELECT id FROM circles WHERE slug = $1', [req.params.slug]);
  if (!found.rows[0]) return res.status(404).json({ error: 'No such circle.' });

  const circleId = found.rows[0].id;
  const removed = await db.query(
    'DELETE FROM memberships WHERE circle_id = $1 AND user_id = $2',
    [circleId, req.userId]
  );
  if (!removed.rowCount) {
    await db.query('INSERT INTO memberships (circle_id, user_id) VALUES ($1,$2)', [
      circleId, req.userId,
    ]);
  }

  const { rows } = await db.query(
    'SELECT count(*) FROM memberships WHERE circle_id = $1',
    [circleId]
  );
  res.json({ joined: !removed.rowCount, memberCount: Number(rows[0].count) });
});

module.exports = router;
