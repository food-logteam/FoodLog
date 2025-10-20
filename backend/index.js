const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

app.use(cors());
app.use(express.json());

// SQLite database
const dbPath = path.join(__dirname, "foodlog.sqlite");
const db = new sqlite3.Database(dbPath);

// Create tables and indexes
db.serialize(() => {
  // users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);

  // foods table (linked to users)
  db.run(`
    CREATE TABLE IF NOT EXISTS consumed_foods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,           
      name TEXT NOT NULL,           
      grams REAL NOT NULL,          
      kcal REAL NOT NULL,           
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_cf_date ON consumed_foods(date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cf_user_date ON consumed_foods(user_id, date)`);
});


// Auth middleware
function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || "";
  const parts = hdr.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") {
    try {
      const payload = jwt.verify(parts[1], JWT_SECRET);
      req.user = { id: payload.sub };
      return next();
    } catch (e) {
      return res.status(401).json({ error: "Invalid token" });
    }
  }
  return res.status(401).json({ error: "Missing Authorization header (Bearer token)" });
}

// Auth routes

// Register new user
app.post("/auth/register", (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: "Missing fields (name, email, password)" });

  const password_hash = bcrypt.hashSync(String(password), 10);
  const sql = `INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`;

  db.run(sql, [name, email, password_hash], function (err) {
    if (err) {
      if (String(err.message).includes("UNIQUE")) {
        return res.status(409).json({ error: "Email already in use" });
      }
      return res.status(500).json({ error: err.message });
    }
    const userId = this.lastID;
    const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ id: userId, name, email, token });
  });
});

// Login user
app.post("/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password)
    return res.status(400).json({ error: "Missing fields (email, password)" });

  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = bcrypt.compareSync(String(password), user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ id: user.id, name: user.name, email: user.email, token });
  });
});

// Public routes
app.get("/health", (_, res) => {
  res.json({ ok: true, message: "FoodLog backend is alive" });
});

app.get("/", (_, res) => res.send("FoodLog API is running"));

// ===============================
// Protected routes (/day)
// ===============================

// GET /day?date=YYYY-MM-DD
app.get("/day", requireAuth, (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "Missing date (format: YYYY-MM-DD)" });

  const listSql = `
    SELECT id, name, grams, ROUND(kcal, 1) AS kcal
    FROM consumed_foods
    WHERE user_id = ? AND date = ?
    ORDER BY id DESC
  `;
  const totalSql = `
    SELECT ROUND(COALESCE(SUM(kcal), 0), 1) AS total_kcal
    FROM consumed_foods
    WHERE user_id = ? AND date = ?
  `;

  db.all(listSql, [req.user.id, date], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    db.get(totalSql, [req.user.id, date], (err2, totalRow) => {
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
app.post("/day", requireAuth, (req, res) => {
  const { date, name, grams, kcal_100g } = req.body || {};
  if (!date || !name || !grams || !kcal_100g)
    return res.status(400).json({ error: "Missing fields (date, name, grams, kcal_100g)" });

  const kcal = (Number(kcal_100g) / 100) * Number(grams);
  const insert = `INSERT INTO consumed_foods (user_id, date, name, grams, kcal) VALUES (?, ?, ?, ?, ?)`;

  db.run(insert, [req.user.id, date, name, grams, kcal], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, kcal: Number(kcal.toFixed(2)) });
  });
});

// PUT /day/:id
app.put("/day/:id", requireAuth, (req, res) => {
  const { grams, kcal_100g } = req.body || {};
  if (!grams || !kcal_100g)
    return res.status(400).json({ error: "Missing fields (grams, kcal_100g)" });

  const kcal = (Number(kcal_100g) / 100) * Number(grams);
  const update = `UPDATE consumed_foods SET grams=?, kcal=? WHERE id=? AND user_id=?`;

  db.run(update, [grams, kcal, req.params.id, req.user.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, updated: this.changes, kcal: Number(kcal.toFixed(2)) });
  });
});

// DELETE /day/:id
app.delete("/day/:id", requireAuth, (req, res) => {
  const del = `DELETE FROM consumed_foods WHERE id=? AND user_id=?`;
  db.run(del, [req.params.id, req.user.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, deleted: this.changes });
  });
});


// Start server

app.listen(PORT, () => {
  console.log(`FoodLog backend running on http://localhost:${PORT}`);
});
