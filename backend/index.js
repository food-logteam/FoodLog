const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = 4000;

// Middleware
app.use(cors());             // allow requests from frontend (localhost:5173 etc.)
app.use(express.json());     // parse JSON bodies

// SQLite database
const dbPath = path.join(__dirname, "foodlog.sqlite");
const db = new sqlite3.Database(dbPath);

// Create table and index if they do not exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS consumed_foods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,           -- "YYYY-MM-DD"
      name TEXT NOT NULL,           -- food name
      grams REAL NOT NULL,          -- quantity in grams
      kcal REAL NOT NULL,           -- (kcal_100g/100)*grams
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cf_date ON consumed_foods(date)`);
});

// API routes

// Health check
app.get("/health", (_, res) => {
  res.json({ ok: true, message: "FoodLog backend is alive" });
});

// Root
app.get("/", (_, res) => res.send("FoodLog API is running"));

// GET /day?date=YYYY-MM-DD
// Returns items and total_kcal for the given date
app.get("/day", (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "Missing date (format: YYYY-MM-DD)" });

  const listSql = `
    SELECT id, name, grams, ROUND(kcal, 1) AS kcal
    FROM consumed_foods
    WHERE date = ?
    ORDER BY id DESC
  `;
  const totalSql = `
    SELECT ROUND(COALESCE(SUM(kcal), 0), 1) AS total_kcal
    FROM consumed_foods
    WHERE date = ?
  `;

  db.all(listSql, [date], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    db.get(totalSql, [date], (err2, totalRow) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({
        date,
        items: rows,
        total_kcal: totalRow ? totalRow.total_kcal : 0
      });
    });
  });
});

// POST /day
// Body: { date, name, grams, kcal_100g }
app.post("/day", (req, res) => {
  const { date, name, grams, kcal_100g } = req.body || {};
  if (!date || !name || !grams || !kcal_100g)
    return res.status(400).json({ error: "Missing fields (date, name, grams, kcal_100g)" });

  const kcal = (Number(kcal_100g) / 100) * Number(grams);
  const insert = `INSERT INTO consumed_foods (date, name, grams, kcal) VALUES (?, ?, ?, ?)`;

  db.run(insert, [date, name, grams, kcal], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, kcal: Number(kcal.toFixed(2)) });
  });
});

// PUT /day/:id
// Body: { grams, kcal_100g }
app.put("/day/:id", (req, res) => {
  const { grams, kcal_100g } = req.body || {};
  if (!grams || !kcal_100g)
    return res.status(400).json({ error: "Missing fields (grams, kcal_100g)" });

  const kcal = (Number(kcal_100g) / 100) * Number(grams);
  const update = `UPDATE consumed_foods SET grams=?, kcal=? WHERE id=?`;

  db.run(update, [grams, kcal, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, updated: this.changes, kcal: Number(kcal.toFixed(2)) });
  });
});

// DELETE /day/:id
app.delete("/day/:id", (req, res) => {
  const del = `DELETE FROM consumed_foods WHERE id=?`;
  db.run(del, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, deleted: this.changes });
  });
});

// Start server

app.listen(PORT, () => {
  console.log(`FoodLog backend running on http://localhost:${PORT}`);
});
