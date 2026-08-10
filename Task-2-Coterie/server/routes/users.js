const express = require('express');
const db = require('../db');
const { requireLogin } = require('../auth');
const { POST_SELECT, toPost } = require('./posts');

const router = express.Router();

const PROFILE_SELECT = `
  SELECT u.id, u.handle, u.display_name, u.bio, u.created_at,
         (SELECT count(*) FROM follows f WHERE f.followee_id = u.id) AS follower_count,
         (SELECT count(*) FROM follows f WHERE f.follower_id = u.id) AS following_count,
         (SELECT count(*) FROM posts   p WHERE p.author_id  = u.id) AS post_count,
         EXISTS (SELECT 1 FROM follows f
                 WHERE f.follower_id = $1 AND f.followee_id = u.id) AS following
  FROM users u
`;

function toProfile(row, viewerId) {
  return {
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio,
    joined: row.created_at,
    followerCount: Number(row.follower_count),
    followingCount: Number(row.following_count),
    postCount: Number(row.post_count),
    following: row.following,
    isMe: row.id === viewerId,
  };
}

// Suggestions are people you do not already follow, busiest first.
router.get('/', requireLogin, async (req, res) => {
  const search = String(req.query.q || '').trim();
  const params = [req.userId];
  let where = 'WHERE u.id <> $1';

  if (search) {
    params.push(`%${search}%`);
    where += ` AND (u.handle ILIKE $${params.length} OR u.display_name ILIKE $${params.length})`;
  }

  const { rows } = await db.query(
    `${PROFILE_SELECT} ${where} ORDER BY post_count DESC, u.handle LIMIT 24`,
    params
  );
  res.json(rows.map((r) => toProfile(r, req.userId)));
});

router.get('/:handle', requireLogin, async (req, res) => {
  const { rows } = await db.query(`${PROFILE_SELECT} WHERE u.handle = $2`, [
    req.userId, req.params.handle,
  ]);
  if (!rows[0]) return res.status(404).json({ error: 'No such person here.' });
  res.json(toProfile(rows[0], req.userId));
});

router.get('/:handle/posts', requireLogin, async (req, res) => {
  const { rows } = await db.query(
    `${POST_SELECT} WHERE u.handle = $2 ORDER BY p.created_at DESC LIMIT 100`,
    [req.userId, req.params.handle]
  );
  res.json(rows.map((r) => toPost(r, req.userId)));
});

router.put('/me', requireLogin, async (req, res) => {
  const displayName = String(req.body.displayName || '').trim();
  const bio = String(req.body.bio || '').trim();

  if (!displayName) return res.status(400).json({ error: 'A display name is required.' });
  if (bio.length > 300) return res.status(400).json({ error: 'Keep the bio under 300 characters.' });

  await db.query('UPDATE users SET display_name = $1, bio = $2 WHERE id = $3', [
    displayName, bio, req.userId,
  ]);
  const { rows } = await db.query(`${PROFILE_SELECT} WHERE u.id = $1`, [req.userId]);
  res.json(toProfile(rows[0], req.userId));
});

router.post('/:handle/follow', requireLogin, async (req, res) => {
  const target = await db.query('SELECT id FROM users WHERE handle = $1', [req.params.handle]);
  if (!target.rows[0]) return res.status(404).json({ error: 'No such person here.' });

  const targetId = target.rows[0].id;
  if (targetId === req.userId) {
    return res.status(400).json({ error: 'You cannot follow yourself.' });
  }

  const removed = await db.query(
    'DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2',
    [req.userId, targetId]
  );
  if (!removed.rowCount) {
    await db.query('INSERT INTO follows (follower_id, followee_id) VALUES ($1,$2)', [
      req.userId, targetId,
    ]);
  }

  const { rows } = await db.query(
    'SELECT count(*) FROM follows WHERE followee_id = $1',
    [targetId]
  );
  res.json({ following: !removed.rowCount, followerCount: Number(rows[0].count) });
});

module.exports = router;
