const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

app.use(cors());             // allow requests from frontend (localhost:5173 etc.)
app.use(express.json());     // parse JSON bodies

// SQLite database
const dbPath = path.join(__dirname, "foodlog.sqlite");
const db = new sqlite3.Database(dbPath);

// Create tables and indexes if not exist
db.serialize(() => {
  // users table with min_kcal and max_kcal
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      min_kcal INTEGER,                  -- optional daily minimum target
      max_kcal INTEGER,                  -- optional daily maximum target
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);

  // foods table linked to users
  db.run(`
    CREATE TABLE IF NOT EXISTS consumed_foods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,           -- "YYYY-MM-DD"
      name TEXT NOT NULL,           -- food name
      grams REAL NOT NULL,          -- quantity in grams
      kcal REAL NOT NULL,           -- (kcal_100g/100)*grams
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_cf_date ON consumed_foods(date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cf_user_date ON consumed_foods(user_id, date)`);
});

// Lightweight migration to add min_kcal/max_kcal if DB existed before
db.all(`PRAGMA table_info(users)`, [], (err, rows) => {
  if (err) return;
  const names = rows.map(r => r.name);
  if (!names.includes("min_kcal")) db.run(`ALTER TABLE users ADD COLUMN min_kcal INTEGER`);
  if (!names.includes("max_kcal")) db.run(`ALTER TABLE users ADD COLUMN max_kcal INTEGER`);
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

// POST /auth/register  Body: { name, email, password, min_kcal?, max_kcal? }
app.post("/auth/register", (req, res) => {
  const { name, email, password, min_kcal = null, max_kcal = null } = req.body || {};
  if (!name || !email || !password)
    return res.status(400).json({ error: "Missing fields (name, email, password)" });

  const password_hash = bcrypt.hashSync(String(password), 10);
  const sql = `
    INSERT INTO users (name, email, password_hash, min_kcal, max_kcal)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.run(sql, [name, email, password_hash, min_kcal, max_kcal], function (err) {
    if (err) {
      if (String(err.message).includes("UNIQUE")) {
        return res.status(409).json({ error: "Email already in use" });
      }
      return res.status(500).json({ error: err.message });
    }
    const userId = this.lastID;
    const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ id: userId, name, email, min_kcal, max_kcal, token });
  });
});

// POST /auth/login  Body: { email, password }
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
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      min_kcal: user.min_kcal ?? null,
      max_kcal: user.max_kcal ?? null,
      token
    });
  });
});

// Profile routes (protected)

// GET /me  -> returns current user profile (id, name, email, min_kcal, max_kcal)
app.get("/me", requireAuth, (req, res) => {
  db.get(
    `SELECT id, name, email, min_kcal, max_kcal FROM users WHERE id = ?`,
    [req.user.id],
    (err, u) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!u) return res.status(404).json({ error: "User not found" });
      res.json(u);
    }
  );
});

// PUT /me  Body: { name?, min_kcal?, max_kcal? } -> updates profile
app.put("/me", requireAuth, (req, res) => {
  const { name, min_kcal, max_kcal } = req.body || {};
  const fields = [];
  const values = [];

  if (typeof name === "string" && name.trim()) { fields.push("name = ?"); values.push(name.trim()); }
  if (min_kcal !== undefined) { fields.push("min_kcal = ?"); values.push(min_kcal === null ? null : Number(min_kcal)); }
  if (max_kcal !== undefined) { fields.push("max_kcal = ?"); values.push(max_kcal === null ? null : Number(max_kcal)); }

  if (!fields.length) return res.status(400).json({ error: "No fields to update" });

  const sql = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;
  values.push(req.user.id);

  db.run(sql, values, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get(
      `SELECT id, name, email, min_kcal, max_kcal FROM users WHERE id = ?`,
      [req.user.id],
      (err2, u) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json(u);
      }
    );
  });
});

// Public routes
app.get("/health", (_, res) => {
  res.json({ ok: true, message: "FoodLog backend is alive" });
});

app.get("/", (_, res) => res.send("FoodLog API is running"));

// Day routes (protected, per user)

// GET /day?date=YYYY-MM-DD
// Returns items, total_kcal and user_targets {min_kcal, max_kcal} plus status
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
  const userSql = `
    SELECT min_kcal, max_kcal
    FROM users
    WHERE id = ?
  `;

  db.all(listSql, [req.user.id, date], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    db.get(totalSql, [req.user.id, date], (err2, totalRow) => {
      if (err2) return res.status(500).json({ error: err2.message });
      const total_kcal = totalRow ? totalRow.total_kcal : 0;

      db.get(userSql, [req.user.id], (err3, u) => {
        if (err3) return res.status(500).json({ error: err3.message });
        const targets = { min_kcal: u?.min_kcal ?? null, max_kcal: u?.max_kcal ?? null };

        let status = null; // "below" | "within" | "above" | null
        if (targets.min_kcal != null && total_kcal < targets.min_kcal) status = "below";
        else if (targets.max_kcal != null && total_kcal > targets.max_kcal) status = "above";
        else if (targets.min_kcal != null || targets.max_kcal != null) status = "within";

        res.json({
          date,
          items: rows,
          total_kcal,
          user_targets: targets,
          status
        });
      });
    });
  });
});

// POST /day  Body: { date, name, grams, kcal_100g }
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

// PUT /day/:id  Body: { grams, kcal_100g }
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
