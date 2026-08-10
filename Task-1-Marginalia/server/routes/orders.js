const express = require('express');
const db = require('../db');
const { requireLogin } = require('../auth');

const router = express.Router();

const SHIPPING_FEE = 60;
const FREE_SHIPPING_OVER = 999;

function toOrder(row) {
  return {
    id: row.id,
    items: row.items,
    subtotal: Number(row.subtotal),
    shipping: Number(row.shipping),
    total: Number(row.total),
    address: row.address,
    status: row.status,
    createdAt: row.created_at,
  };
}

function readAddress(body) {
  const a = body.address || {};
  const address = {
    name: String(a.name || '').trim(),
    line1: String(a.line1 || '').trim(),
    city: String(a.city || '').trim(),
    postcode: String(a.postcode || '').trim(),
  };
  const missing = !address.name || !address.line1 || !address.city;
  return { address, missing };
}

function readLines(body) {
  if (!Array.isArray(body.items) || body.items.length === 0) return null;
  const lines = [];
  for (const item of body.items) {
    const id = Number(item.id);
    const quantity = Math.floor(Number(item.quantity));
    if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 1) return null;
    lines.push({ id, quantity });
  }
  return lines;
}

router.get('/', requireLogin, async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
    [req.userId]
  );
  res.json(rows.map(toOrder));
});

// Prices always come from the database, never from the request body, and stock
// is checked under a row lock so two buyers cannot take the last copy.
router.post('/', requireLogin, async (req, res) => {
  const lines = readLines(req.body);
  if (!lines) return res.status(400).json({ error: 'Your cart is empty or malformed.' });

  const { address, missing } = readAddress(req.body);
  if (missing) return res.status(400).json({ error: 'Name, address, and city are required.' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const items = [];
    let subtotal = 0;

    for (const line of lines) {
      const { rows } = await client.query('SELECT * FROM books WHERE id = $1 FOR UPDATE', [line.id]);
      const book = rows[0];
      if (!book) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'One of the books is no longer available.' });
      }
      if (book.stock < line.quantity) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Only ${book.stock} copies of "${book.title}" are left.`,
        });
      }

      await client.query('UPDATE books SET stock = stock - $1 WHERE id = $2', [line.quantity, book.id]);

      const price = Number(book.price);
      subtotal += price * line.quantity;
      items.push({
        id: book.id,
        slug: book.slug,
        title: book.title,
        author: book.author,
        price,
        quantity: line.quantity,
      });
    }

    const shipping = subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE;
    const { rows } = await client.query(
      `INSERT INTO orders (user_id, items, subtotal, shipping, total, address)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.userId, JSON.stringify(items), subtotal, shipping, subtotal + shipping,
       JSON.stringify(address)]
    );

    await client.query('COMMIT');
    res.status(201).json(toOrder(rows[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

module.exports = router;
