-- Runs on first container start and again on every boot; all statements are
-- idempotent, so an existing database is left alone.

CREATE TABLE IF NOT EXISTS books (
  id       SERIAL  PRIMARY KEY,
  slug     TEXT    NOT NULL UNIQUE,
  title    TEXT    NOT NULL,
  author   TEXT    NOT NULL,
  genre    TEXT    NOT NULL,
  price    NUMERIC NOT NULL,
  year     INTEGER NOT NULL,
  pages    INTEGER NOT NULL,
  blurb    TEXT    NOT NULL,
  stock    INTEGER NOT NULL DEFAULT 12
);

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT   NOT NULL,
  email         TEXT   NOT NULL UNIQUE,
  password_hash TEXT   NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id         SERIAL      PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id),
  items      JSONB       NOT NULL,
  subtotal   NUMERIC     NOT NULL,
  shipping   NUMERIC     NOT NULL,
  total      NUMERIC     NOT NULL,
  address    JSONB       NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'Placed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders (user_id);

INSERT INTO books (slug, title, author, genre, price, year, pages, blurb, stock) VALUES
('the-quiet-shelf', 'The Quiet Shelf', 'Iris Mahadevan', 'Literary', 449, 2019, 288,
 'A retired librarian catalogues the books nobody borrowed, and finds a record of the town she thought she knew.', 14),
('salt-and-signal', 'Salt and Signal', 'Devan Rao', 'Science Fiction', 399, 2021, 352,
 'A radio operator on a flooded coast starts receiving weather reports from a year that has not happened yet.', 9),
('the-marginal-notes', 'The Marginal Notes', 'Farah Qureshi', 'Literary', 375, 2017, 244,
 'Two strangers fall in love through the annotations they leave in second-hand paperbacks.', 20),
('gridlock', 'Gridlock', 'Peter Ahn', 'Thriller', 349, 2022, 400,
 'A traffic engineer notices that the city''s signal timings spell out a countdown.', 11),
('a-short-history-of-rain', 'A Short History of Rain', 'Nandita Bose', 'Non-fiction', 525, 2020, 312,
 'How monsoon records kept by clerks, farmers, and poets became the backbone of modern climate science.', 7),
('the-cartographers-error', 'The Cartographer''s Error', 'Luis Okonjo', 'Historical', 475, 2018, 368,
 'A mapmaker draws an island that does not exist, and spends forty years watching ships look for it.', 6),
('paper-lantern', 'Paper Lantern', 'Mei Sato', 'Literary', 299, 2023, 196,
 'Twelve linked stories about a night market that assembles itself differently every evening.', 18),
('the-tenth-floor', 'The Tenth Floor', 'Adaeze Nwankwo', 'Mystery', 399, 2021, 336,
 'The building has nine floors. The lift has a button for a tenth. Somebody keeps pressing it.', 13),
('slow-fire', 'Slow Fire', 'Ravi Kulkarni', 'Non-fiction', 550, 2016, 420,
 'A kitchen-level history of the spice trade, told through six recipes and the wars they started.', 8),
('everything-in-transit', 'Everything in Transit', 'Sonia Vargas', 'Literary', 425, 2024, 268,
 'A night-shift airport cleaner keeps the things people leave behind, and slowly builds a life out of them.', 15),
('the-glass-orchard', 'The Glass Orchard', 'Tomas Lindqvist', 'Science Fiction', 465, 2022, 384,
 'The last botanist on a terraforming crew argues with the ship about what counts as a living thing.', 10),
('undertow', 'Undertow', 'Grace Abiola', 'Thriller', 359, 2020, 328,
 'A swimming coach recognises a body pulled from the harbour, and says nothing for three hundred pages.', 12)
ON CONFLICT (slug) DO NOTHING;
