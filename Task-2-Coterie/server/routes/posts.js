const express = require('express');
const db = require('../db');
const { requireLogin } = require('../auth');

const router = express.Router();
const MAX_BODY = 800;

function parsePositiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Every post listing needs the same author, circle, and counter columns.
const POST_SELECT = `
  SELECT p.id, p.body, p.created_at,
         u.handle, u.display_name,
         c.slug AS circle_slug, c.name AS circle_name,
         (SELECT count(*) FROM likes    l WHERE l.post_id = p.id) AS like_count,
         (SELECT count(*) FROM comments m WHERE m.post_id = p.id) AS comment_count,
         EXISTS (SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) AS liked,
         p.author_id
  FROM posts p
  JOIN users u ON u.id = p.author_id
  LEFT JOIN circles c ON c.id = p.circle_id
`;

function toPost(row, viewerId) {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    author: { handle: row.handle, displayName: row.display_name },
    circle: row.circle_slug ? { slug: row.circle_slug, name: row.circle_name } : null,
    likeCount: Number(row.like_count),
    commentCount: Number(row.comment_count),
    liked: row.liked,
    mine: row.author_id === viewerId,
  };
}

// The home feed is your own posts plus everyone you follow. "explore" widens
// it to every post on the server.
router.get('/', requireLogin, async (req, res) => {
  const explore = req.query.scope === 'explore';
  const where = explore
    ? ''
    : `WHERE p.author_id = $1
        OR p.author_id IN (SELECT followee_id FROM follows WHERE follower_id = $1)`;

  const { rows } = await db.query(
    `${POST_SELECT} ${where} ORDER BY p.created_at DESC LIMIT 100`,
    [req.userId]
  );
  res.json(rows.map((r) => toPost(r, req.userId)));
});

router.post('/', requireLogin, async (req, res) => {
  const body = String(req.body.body || '').trim();
  const circleSlug = String(req.body.circle || '').trim();

  if (!body) return res.status(400).json({ error: 'Write something first.' });
  if (body.length > MAX_BODY) {
    return res.status(400).json({ error: `Posts are limited to ${MAX_BODY} characters.` });
  }

  let circleId = null;
  if (circleSlug) {
    const { rows } = await db.query('SELECT id FROM circles WHERE slug = $1', [circleSlug]);
    if (!rows[0]) return res.status(400).json({ error: 'That circle does not exist.' });
    circleId = rows[0].id;
  }

  const created = await db.query(
    'INSERT INTO posts (author_id, circle_id, body) VALUES ($1,$2,$3) RETURNING id',
    [req.userId, circleId, body]
  );
  const { rows } = await db.query(`${POST_SELECT} WHERE p.id = $2`, [req.userId, created.rows[0].id]);
  res.status(201).json(toPost(rows[0], req.userId));
});

router.delete('/:id', requireLogin, async (req, res) => {
  const postId = parsePositiveId(req.params.id);
  if (!postId) return res.status(400).json({ error: 'Bad post id.' });

  const { rowCount } = await db.query(
    'DELETE FROM posts WHERE id = $1 AND author_id = $2',
    [postId, req.userId]
  );
  if (!rowCount) return res.status(404).json({ error: 'That post is not yours to delete.' });
  res.status(204).end();
});

router.post('/:id/like', requireLogin, async (req, res) => {
  const postId = parsePositiveId(req.params.id);
  if (!postId) return res.status(400).json({ error: 'Bad post id.' });

  const removed = await db.query(
    'DELETE FROM likes WHERE post_id = $1 AND user_id = $2',
    [postId, req.userId]
  );
  if (!removed.rowCount) {
    try {
      await db.query('INSERT INTO likes (post_id, user_id) VALUES ($1,$2)', [postId, req.userId]);
    } catch (err) {
      if (err.code === '23503') return res.status(404).json({ error: 'That post is gone.' });
      throw err;
    }
  }

  const { rows } = await db.query('SELECT count(*) FROM likes WHERE post_id = $1', [postId]);
  res.json({ liked: !removed.rowCount, likeCount: Number(rows[0].count) });
});

router.get('/:id/comments', requireLogin, async (req, res) => {
  const postId = parsePositiveId(req.params.id);
  if (!postId) return res.status(400).json({ error: 'Bad post id.' });

  const { rows } = await db.query(
    `SELECT m.id, m.body, m.created_at, m.author_id, u.handle, u.display_name
     FROM comments m JOIN users u ON u.id = m.author_id
     WHERE m.post_id = $1 ORDER BY m.created_at`,
    [postId]
  );
  res.json(rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    author: { handle: row.handle, displayName: row.display_name },
    mine: row.author_id === req.userId,
  })));
});

router.post('/:id/comments', requireLogin, async (req, res) => {
  const postId = parsePositiveId(req.params.id);
  if (!postId) return res.status(400).json({ error: 'Bad post id.' });

  const body = String(req.body.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Write something first.' });

  try {
    const { rows } = await db.query(
      `INSERT INTO comments (post_id, author_id, body) VALUES ($1,$2,$3)
       RETURNING id, body, created_at`,
      [postId, req.userId, body]
    );
    res.status(201).json({
      id: rows[0].id,
      body: rows[0].body,
      createdAt: rows[0].created_at,
      mine: true,
    });
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ error: 'That post is gone.' });
    throw err;
  }
});

router.delete('/comments/:id', requireLogin, async (req, res) => {
  const commentId = parsePositiveId(req.params.id);
  if (!commentId) return res.status(400).json({ error: 'Bad comment id.' });

  const { rowCount } = await db.query(
    'DELETE FROM comments WHERE id = $1 AND author_id = $2',
    [commentId, req.userId]
  );
  if (!rowCount) return res.status(404).json({ error: 'That comment is not yours to delete.' });
  res.status(204).end();
});

module.exports = { router, POST_SELECT, toPost };
