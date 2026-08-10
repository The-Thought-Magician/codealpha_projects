# CodeAlpha Projects

Full Stack Development internship tasks for CodeAlpha. All four are built on
the same stack: a vanilla HTML, CSS, and JavaScript frontend with no build
step, an Express API, and PostgreSQL.

| Task | Project | What it is | Port |
| --- | --- | --- | --- |
| 1. E-commerce store | [Marginalia](Task-1-Marginalia) | A bookshop with a basket, checkout, and order history | 4000 |
| 2. Social media platform | [Coterie](Task-2-Coterie) | Posts, comments, likes, follows, and topic circles | 4001 |
| 3. Project management tool | [Sightline](Task-3-Sightline) | A drag and drop board with live updates over WebSockets | 4002 |
| 4. Real-time communication | [Roundtable](Task-4-Roundtable) | WebRTC video, screen sharing, file transfer, and a shared whiteboard | 4003 |

## Running any of them

Each task is self-contained and needs Docker Desktop:

```bash
cd Task-1-Marginalia          # or any of the others
cp .env.example .env          # fill in the blanks
docker compose up --build
```

The ports differ, so more than one can run at the same time. Setup notes and
design decisions are in each project's own README.

## Shared conventions

- Sessions are a signed JWT in an httpOnly, sameSite cookie; passwords are
  stored as bcrypt hashes
- Secrets come from `.env` and are never committed
- Each app applies its own `db/schema.sql` on boot, and every statement in it
  is idempotent
- Prices, permissions, and ownership are checked on the server, never trusted
  from the browser
