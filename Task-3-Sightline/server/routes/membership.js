const db = require('../db');

// Guards every project-scoped route. Membership is checked against the
// database on each request rather than trusted from the client.
async function requireMember(req, res, next) {
  const projectId = Number(req.params.id || req.params.projectId);
  if (!Number.isInteger(projectId)) {
    return res.status(400).json({ error: 'Bad project id.' });
  }

  const { rows } = await db.query(
    'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, req.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'No such project.' });

  req.projectId = projectId;
  req.projectRole = rows[0].role;
  next();
}

module.exports = { requireMember };
