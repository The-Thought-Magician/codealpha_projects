-- Applied on every boot; all statements are idempotent.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT   NOT NULL,
  email         TEXT   NOT NULL UNIQUE,
  password_hash TEXT   NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id          SERIAL      PRIMARY KEY,
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  owner_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Membership is the access check for everything below: no row here means no
-- read and no write on the project.
CREATE TABLE IF NOT EXISTS project_members (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT    NOT NULL DEFAULT 'member',
  PRIMARY KEY (project_id, user_id),
  CHECK (role IN ('owner', 'member'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id          SERIAL      PRIMARY KEY,
  project_id  INTEGER     NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL DEFAULT '',
  status      TEXT        NOT NULL DEFAULT 'todo',
  assignee_id INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  created_by  INTEGER     NOT NULL REFERENCES users(id),
  position    INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('todo', 'doing', 'review', 'done'))
);

CREATE TABLE IF NOT EXISTS task_comments (
  id         SERIAL      PRIMARY KEY,
  task_id    INTEGER     NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id  INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks (project_id, status, position);
CREATE INDEX IF NOT EXISTS task_comments_task_idx ON task_comments (task_id);
