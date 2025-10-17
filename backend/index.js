// backend/index.js
const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
app.use(cors());            // permite cereri din frontend (localhost:5173)
app.use(express.json());

// ====== DB: SQLite în fișier local (în folderul backend) ======
const db = new sqlite3.Database(path.join(__dirname, "foodlog.sqlite"));
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS consumed_foods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,     -- "YYYY-MM-DD"
      name TEXT NOT NULL,     -- numele alimentului
      grams REAL NOT NULL,    -- cantitatea introdusă
      kcal REAL NOT NULL,     -- (kcal_100g/100)*grams
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);
});

// ====== Rute simple pentru test ======
app.get("/", (_, res) => res.send("FoodLog API is running"));
app.get("/health", (_, res) => res.json({ ok: true }));

// GET /day?date=YYYY-MM-DD  -> listează alimentele unei zile
app.get("/day", (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "Missing date" });

  db.all(
    `SELECT id, name, grams, kcal
     FROM consumed_foods
     WHERE date = ?
     ORDER BY id DESC`,
    [date],
    (err, rows) => (err ? res.status(500).json({ error: err.message }) : res.json(rows))
  );
});

// POST /day { date, name, grams, kcal_100g } -> adaugă aliment
app.post("/day", (req, res) => {
  const { date, name, grams, kcal_100g } = req.body || {};
  if (!date || !name || !grams || !kcal_100g)
    return res.status(400).json({ error: "Missing fields" });

  const kcal = (Number(kcal_100g) / 100) * Number(grams);
  db.run(
    `INSERT INTO consumed_foods (date, name, grams, kcal) VALUES (?,?,?,?)`,
    [date, name, grams, kcal],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, kcal: Number(kcal.toFixed(2)) });
    }
  );
});

// (opțional) DELETE /day/:id  -> șterge un rând
app.delete("/day/:id", (req, res) => {
  db.run(`DELETE FROM consumed_foods WHERE id=?`, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, deleted: this.changes });
  });
});

// (opțional) PUT /day/:id { grams, kcal_100g } -> modifică gramele (recalculează kcal)
app.put("/day/:id", (req, res) => {
  const { grams, kcal_100g } = req.body || {};
  if (!grams || !kcal_100g) return res.status(400).json({ error: "Missing fields" });
  const kcal = (Number(kcal_100g) / 100) * Number(grams);
  db.run(
    `UPDATE consumed_foods SET grams=?, kcal=? WHERE id=?`,
    [grams, kcal, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, updated: this.changes, kcal: Number(kcal.toFixed(2)) });
    }
  );
});

app.listen(4000, () => console.log("✅ Backend on http://localhost:4000"));
