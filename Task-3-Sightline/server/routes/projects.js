const express = require('express');
const db = require('../db');
const { requireLogin } = require('../auth');
const { requireMember } = require('./membership');

const router = express.Router();

function toProject(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    role: row.role,
    memberCount: Number(row.member_count),
    openCount: Number(row.open_count),
    createdAt: row.created_at,
  };
}

router.use(requireLogin);

router.get('/', async (req, res) => {
  const { rows } = await db.query(
    `SELECT p.*, pm.role,
            (SELECT count(*) FROM project_members m WHERE m.project_id = p.id) AS member_count,
            (SELECT count(*) FROM tasks t WHERE t.project_id = p.id AND t.status <> 'done') AS open_count
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
     ORDER BY p.created_at DESC`,
    [req.userId]
  );
  res.json(rows.map(toProject));
});

router.post('/', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  if (!name) return res.status(400).json({ error: 'Give the project a name.' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO projects (name, description, owner_id) VALUES ($1,$2,$3) RETURNING *',
      [name, description, req.userId]
    );
    await client.query(
      "INSERT INTO project_members (project_id, user_id, role) VALUES ($1,$2,'owner')",
      [rows[0].id, req.userId]
    );
    await client.query('COMMIT');
    res.status(201).json(toProject({ ...rows[0], role: 'owner', member_count: 1, open_count: 0 }));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

router.get('/:id', requireMember, async (req, res) => {
  const { rows } = await db.query(
    `SELECT p.*, pm.role,
            (SELECT count(*) FROM project_members m WHERE m.project_id = p.id) AS member_count,
            (SELECT count(*) FROM tasks t WHERE t.project_id = p.id AND t.status <> 'done') AS open_count
     FROM projects p
     JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
     WHERE p.id = $2`,
    [req.userId, req.projectId]
  );
  res.json(toProject(rows[0]));
});

router.get('/:id/members', requireMember, async (req, res) => {
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.email, pm.role
     FROM project_members pm JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1 ORDER BY pm.role, u.name`,
    [req.projectId]
  );
  res.json(rows);
});

// Anyone already on the project can invite, which keeps a two-person team from
// being blocked when the owner is away.
router.post('/:id/members', requireMember, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  if (!rows[0]) return res.status(404).json({ error: 'Nobody is registered with that email.' });

  await db.query(
    `INSERT INTO project_members (project_id, user_id) VALUES ($1,$2)
     ON CONFLICT DO NOTHING`,
    [req.projectId, rows[0].id]
  );
  res.status(201).json({ id: rows[0].id, name: rows[0].name, email: rows[0].email, role: 'member' });
});

module.exports = router;
