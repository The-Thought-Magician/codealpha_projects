const express = require('express');
const db = require('../db');

const router = express.Router();

function toBook(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    author: row.author,
    genre: row.genre,
    price: Number(row.price),
    year: row.year,
    pages: row.pages,
    blurb: row.blurb,
    stock: row.stock,
  };
}

router.get('/', async (req, res) => {
  const genre = String(req.query.genre || '').trim();
  const search = String(req.query.q || '').trim();

  const clauses = [];
  const params = [];

  if (genre && genre !== 'All') {
    params.push(genre);
    clauses.push(`genre = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(title ILIKE $${params.length} OR author ILIKE $${params.length})`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await db.query(`SELECT * FROM books ${where} ORDER BY title`, params);
  res.json(rows.map(toBook));
});

router.get('/genres', async (req, res) => {
  const { rows } = await db.query('SELECT DISTINCT genre FROM books ORDER BY genre');
  res.json(['All', ...rows.map((r) => r.genre)]);
});

router.get('/:slug', async (req, res) => {
  const { rows } = await db.query('SELECT * FROM books WHERE slug = $1', [req.params.slug]);
  if (!rows[0]) return res.status(404).json({ error: 'That book is not in the catalogue.' });
  res.json(toBook(rows[0]));
});

module.exports = router;
