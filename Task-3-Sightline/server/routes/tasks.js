const express = require('express');
const db = require('../db');
const { requireLogin } = require('../auth');
const { requireMember } = require('./membership');
const realtime = require('../realtime');

const STATUSES = ['todo', 'doing', 'review', 'done'];

const TASK_SELECT = `
  SELECT t.id, t.project_id, t.title, t.body, t.status, t.position, t.created_at,
         t.assignee_id, u.name AS assignee_name,
         (SELECT count(*) FROM task_comments c WHERE c.task_id = t.id) AS comment_count
  FROM tasks t
  LEFT JOIN users u ON u.id = t.assignee_id
`;

function toTask(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    body: row.body,
    status: row.status,
    position: row.position,
    createdAt: row.created_at,
    assignee: row.assignee_id ? { id: row.assignee_id, name: row.assignee_name } : null,
    commentCount: Number(row.comment_count),
  };
}

async function fetchTask(id) {
  const { rows } = await db.query(`${TASK_SELECT} WHERE t.id = $1`, [id]);
  return rows[0] ? toTask(rows[0]) : null;
}

// Resolves a task id to its project and checks membership on that project.
async function loadTask(req, res, next) {
  const taskId = Number(req.params.taskId);
  const { rows } = await db.query('SELECT project_id FROM tasks WHERE id = $1', [taskId]);
  if (!rows[0]) return res.status(404).json({ error: 'No such task.' });

  const member = await db.query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [rows[0].project_id, req.userId]
  );
  if (!member.rowCount) return res.status(404).json({ error: 'No such task.' });

  req.taskId = taskId;
  req.projectId = rows[0].project_id;
  next();
}

async function assigneeIdFor(projectId, value) {
  if (value === null || value === undefined || value === '') return null;
  const { rows } = await db.query(
    'SELECT user_id FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, Number(value)]
  );
  if (!rows[0]) throw Object.assign(new Error('That person is not on this project.'), { status: 400 });
  return rows[0].user_id;
}

const boardRouter = express.Router({ mergeParams: true });
boardRouter.use(requireLogin, requireMember);

boardRouter.get('/', async (req, res) => {
  const { rows } = await db.query(
    `${TASK_SELECT} WHERE t.project_id = $1 ORDER BY t.position, t.id`,
    [req.projectId]
  );
  res.json(rows.map(toTask));
});

boardRouter.post('/', async (req, res) => {
  const title = String(req.body.title || '').trim();
  const body = String(req.body.body || '').trim();
  const status = STATUSES.includes(req.body.status) ? req.body.status : 'todo';
  if (!title) return res.status(400).json({ error: 'Give the task a title.' });

  const assigneeId = await assigneeIdFor(req.projectId, req.body.assigneeId);
  const next = await db.query(
    'SELECT coalesce(max(position), 0) + 1 AS pos FROM tasks WHERE project_id = $1 AND status = $2',
    [req.projectId, status]
  );

  const created = await db.query(
    `INSERT INTO tasks (project_id, title, body, status, assignee_id, created_by, position)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [req.projectId, title, body, status, assigneeId, req.userId, next.rows[0].pos]
  );

  const task = await fetchTask(created.rows[0].id);
  realtime.broadcast(req.projectId, { type: 'task.saved', task });
  res.status(201).json(task);
});

const taskRouter = express.Router();
taskRouter.use(requireLogin);

taskRouter.patch('/:taskId', loadTask, async (req, res) => {
  const updates = [];
  const params = [];

  if (req.body.title !== undefined) {
    const title = String(req.body.title).trim();
    if (!title) return res.status(400).json({ error: 'A task needs a title.' });
    params.push(title);
    updates.push(`title = $${params.length}`);
  }
  if (req.body.body !== undefined) {
    params.push(String(req.body.body).trim());
    updates.push(`body = $${params.length}`);
  }
  if (req.body.status !== undefined) {
    if (!STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: 'Unknown column.' });
    }
    params.push(req.body.status);
    updates.push(`status = $${params.length}`);
  }
  if (req.body.position !== undefined) {
    params.push(Math.max(0, Math.floor(Number(req.body.position)) || 0));
    updates.push(`position = $${params.length}`);
  }
  if (req.body.assigneeId !== undefined) {
    params.push(await assigneeIdFor(req.projectId, req.body.assigneeId));
    updates.push(`assignee_id = $${params.length}`);
  }

  if (!updates.length) return res.status(400).json({ error: 'Nothing to change.' });

  params.push(req.taskId);
  await db.query(`UPDATE tasks SET ${updates.join(', ')} WHERE id = $${params.length}`, params);

  const task = await fetchTask(req.taskId);
  realtime.broadcast(req.projectId, { type: 'task.saved', task });
  res.json(task);
});

taskRouter.delete('/:taskId', loadTask, async (req, res) => {
  await db.query('DELETE FROM tasks WHERE id = $1', [req.taskId]);
  realtime.broadcast(req.projectId, { type: 'task.removed', taskId: req.taskId });
  res.status(204).end();
});

taskRouter.get('/:taskId/comments', loadTask, async (req, res) => {
  const { rows } = await db.query(
    `SELECT c.id, c.body, c.created_at, c.author_id, u.name AS author_name
     FROM task_comments c JOIN users u ON u.id = c.author_id
     WHERE c.task_id = $1 ORDER BY c.created_at`,
    [req.taskId]
  );
  res.json(rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    author: { id: row.author_id, name: row.author_name },
    mine: row.author_id === req.userId,
  })));
});

taskRouter.post('/:taskId/comments', loadTask, async (req, res) => {
  const body = String(req.body.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Write something first.' });

  const { rows } = await db.query(
    `INSERT INTO task_comments (task_id, author_id, body) VALUES ($1,$2,$3)
     RETURNING id, body, created_at`,
    [req.taskId, req.userId, body]
  );
  const me = await db.query('SELECT name FROM users WHERE id = $1', [req.userId]);
  const comment = {
    id: rows[0].id,
    body: rows[0].body,
    createdAt: rows[0].created_at,
    author: { id: req.userId, name: me.rows[0].name },
    mine: true,
  };

  realtime.broadcast(req.projectId, {
    type: 'comment.added',
    taskId: req.taskId,
    comment: { ...comment, mine: false },
  });
  res.status(201).json(comment);
});

module.exports = { boardRouter, taskRouter };
