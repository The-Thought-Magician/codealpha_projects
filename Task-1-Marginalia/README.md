# Marginalia

An online bookshop, built for the CodeAlpha Full Stack Development internship (Task 1).

## Features

- Catalogue with genre filters and a search across titles and authors
- Book pages with stock, blurb, and a quantity picker
- Basket kept in the browser, so you can shop before signing in
- Registration and sign-in with a bcrypt-hashed password and an httpOnly session cookie
- Checkout writes an order and decrements stock in one transaction, under a row
  lock, so the last copy cannot be sold twice
- Order history

Prices are always read from the database at checkout, never from the request
body, so a tampered basket cannot change what you are charged.

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

Open http://localhost:4000.

## Layout

```
server/index.js     express app and error handling
server/db.js        connection pool, applies db/schema.sql on boot
server/auth.js      register, sign in, sign out, session middleware
server/routes/      books and orders
public/             pages, css/, js/
db/schema.sql       tables and the seed catalogue
```

Book covers are drawn in CSS from each title, so there are no image files to
keep in step with the catalogue.
