# Coterie

A small social app, built for the CodeAlpha Full Stack Development internship (Task 2).

Most social apps put everyone in one timeline. Coterie is built around circles:
small rooms for one subject each, which a post can be filed under.

## Features

- Registration and sign-in with a bcrypt-hashed password and an httpOnly session cookie
- Profiles with a display name, bio, and post, follower, and following counts
- Posts, optionally filed to a circle, with comments and likes
- Follow and unfollow, with a home feed of the people you follow and an
  Everyone view for finding new ones
- Circles you can join or leave, each with its own feed
- People search

## Tech stack

- Frontend: HTML, CSS, vanilla JavaScript (no build step)
- Backend: Node.js, Express
- Database: PostgreSQL
- Docker Compose for local setup

## Running it

Requires Docker Desktop.

```bash
cp .env.example .env      # set POSTGRES_PASSWORD, DATABASE_URL, and JWT_SECRET
docker compose up --build
```

Open http://localhost:4001 and create an account. The five starter circles are
seeded by `db/schema.sql`.

## Layout

```
server/index.js     express app and error handling
server/db.js        connection pool, applies db/schema.sql on boot
server/auth.js      register, sign in, sign out, session middleware
server/routes/      posts, users, circles
public/             pages, css/, js/
db/schema.sql       tables and the seed circles
```

Likes and follows are join tables with composite primary keys, so a double
click cannot create a duplicate row, and `follows` has a check constraint that
stops anyone following themselves.

Avatars are initials coloured from the handle, so there are no uploads to
store or serve.
