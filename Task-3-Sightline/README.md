# Sightline

A collaborative project board, built for the CodeAlpha Full Stack Development
internship (Task 3). It covers the optional real-time extra: everyone looking
at a board sees changes as they happen, over WebSockets.

## Features

- Registration and sign-in with a bcrypt-hashed password and an httpOnly session cookie
- Projects with members; add anyone by their registered email
- A four column board: to do, in progress, in review, done
- Task cards with a title, details, assignee, and a discussion thread
- Drag and drop between columns, moved optimistically and rolled back if the
  server refuses
- Live updates: a card another member moves, edits, deletes, or comments on
  appears on your board without a refresh

## Real-time design

The WebSocket server shares the session cookie and the JWT check with the HTTP
side, so an unauthenticated socket is closed on upgrade with code 4001. Board
membership is checked against the database before a socket joins a room.

Events go to every socket on the board, including the one belonging to whoever
caused the change, because someone with the board open in two tabs needs both
to update. Each event carries the full new state, so applying it twice is
harmless, and the client only raises a notification when the board actually
changed. The client reconnects with a widening delay, so a server restart does
not need a page refresh.

Project membership is verified per request in `routes/membership.js`, so a
crafted project id in the URL returns 404 rather than someone else's board.

## Tech stack

- Frontend: HTML, CSS, vanilla JavaScript, native drag and drop (no build step)
- Backend: Node.js, Express, ws
- Database: PostgreSQL
- Docker Compose for local setup

## Running it

Requires Docker Desktop.

```bash
cp .env.example .env      # set POSTGRES_PASSWORD, DATABASE_URL, and JWT_SECRET
docker compose up --build
```

Open http://localhost:4002. To see the live updates, register two accounts,
add the second one to a project from the People dialog, and open the same board
in two browser windows.

## Layout

```
server/index.js       express app, http server, error handling
server/db.js          connection pool, applies db/schema.sql on boot
server/auth.js        register, sign in, sign out, shared token check
server/realtime.js    WebSocket rooms and broadcasts
server/routes/        projects, tasks, membership guard
public/               pages, css/, js/
db/schema.sql         tables and constraints
```
