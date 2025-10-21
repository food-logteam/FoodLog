// index.js – FoodLog backend (SQLite, Auth, Edamam search)
// Node 20 LTS compatible. Uses built-in fetch.
// Notes:
// - Keep secrets in .env: EDAMAM_APP_ID, EDAMAM_APP_KEY, JWT_SECRET
// - We only expose name (label) and kcal_100g from Edamam as requested.
// - DB schema follows the simple daily-tracking model: date | name | grams | kcal.

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const EDAMAM_APP_ID = process.env.EDAMAM_APP_ID || "";
const EDAMAM_APP_KEY = process.env.EDAMAM_APP_KEY || "";

app.use(cors());
app.use(express.json());

// SQLite database
const dbPath = path.join(__dirname, "foodlog.sqlite");
const db = new sqlite3.Database(dbPath);

// Create tables and indexes if not exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      min_kcal INTEGER,
      max_kcal INTEGER,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);

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

// Lightweight migration to add min_kcal/max_kcal if DB existed before
db.all(`PRAGMA table_info(users)`, [], (err, rows) => {
  if (err) return;
  const names = rows.map(r => r.name);
  if (!names.includes("min_kcal")) db.run(`ALTER TABLE users ADD COLUMN min_kcal INTEGER`);
  if (!names.includes("max_kcal")) db.run(`ALTER TABLE users ADD COLUMN max_kcal INTEGER`);
});

// Helpers
function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "7d" });
}

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

// Simple in-memory cache for Edamam lookups to reduce calls during development
// Key: q string; Value: { t: epoch_ms, data }
const edamamCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function edamamSearchFoods(q, { limit = 20, onlyGeneric = true } = {}) {
  const key = `${q}|${limit}|${onlyGeneric}`.toLowerCase();
  const now = Date.now();
  const cached = edamamCache.get(key);
  if (cached && now - cached.t < CACHE_TTL_MS) return cached.data;

  if (!EDAMAM_APP_ID || !EDAMAM_APP_KEY) {
    throw new Error("Missing EDAMAM_APP_ID or EDAMAM_APP_KEY in environment");
  }

  const url = new URL("https://api.edamam.com/api/food-database/v2/parser");
  url.searchParams.set("app_id", EDAMAM_APP_ID);
  url.searchParams.set("app_key", EDAMAM_APP_KEY);
  url.searchParams.set("ingr", q);
  url.searchParams.set("nutrition-type", "logging");

  const r = await fetch(url.toString());
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Edamam error: ${r.status} ${r.statusText} ${text}`);
  }
  const json = await r.json();

  const hints = Array.isArray(json.hints) ? json.hints : [];

  // Map to minimal model and filter duplicates by normalized label
  const seen = new Set();
  const out = [];
  for (const h of hints) {
    const food = h && h.food ? h.food : null;
    if (!food) continue;
    if (onlyGeneric && food.category !== "Generic foods") continue;

    const label = (food.label || "").trim();
    const kcal = food.nutrients && typeof food.nutrients.ENERC_KCAL === "number"
      ? Number(food.nutrients.ENERC_KCAL)
      : null;

    if (!label || kcal == null) continue;
    const norm = label.toLowerCase();
    if (seen.has(norm)) continue;
    seen.add(norm);

    out.push({ name: label, kcal_100g: Number(kcal.toFixed(1)) });
    if (out.length >= limit) break;
  }

  const result = { query: q, count: out.length, items: out };
  edamamCache.set(key, { t: now, data: result });
  return result;
}

// Auth routes
app.post("/auth/register", (req, res) => {
  const { name, email, password, min_kcal = null, max_kcal = null } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Missing fields (name, email, password)" });
  }

  const password_hash = bcrypt.hashSync(String(password), 10);
  const sql = `INSERT INTO users (name, email, password_hash, min_kcal, max_kcal) VALUES (?, ?, ?, ?, ?)`;

  db.run(sql, [name, email, password_hash, min_kcal, max_kcal], function (err) {
    if (err) {
      if (String(err.message).includes("UNIQUE")) {
        return res.status(409).json({ error: "Email already in use" });
      }
      return res.status(500).json({ error: err.message });
    }
    const userId = this.lastID;
    const token = signToken(userId);
    res.status(201).json({ id: userId, name, email, min_kcal, max_kcal, token });
  });
});

app.post("/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Missing fields (email, password)" });
  }

  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = bcrypt.compareSync(String(password), user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken(user.id);
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

// Profile routes
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

// Day routes (per user)
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

        let status = null;
        if (targets.min_kcal != null && total_kcal < targets.min_kcal) status = "below";
        else if (targets.max_kcal != null && total_kcal > targets.max_kcal) status = "above";
        else if (targets.min_kcal != null || targets.max_kcal != null) status = "within";

        res.json({ date, items: rows, total_kcal, user_targets: targets, status });
      });
    });
  });
});

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

app.delete("/day/:id", requireAuth, (req, res) => {
  const del = `DELETE FROM consumed_foods WHERE id=? AND user_id=?`;
  db.run(del, [req.params.id, req.user.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, deleted: this.changes });
  });
});

// Edamam search routes (minimal, exposing only name and kcal_100g)
// GET /foods/search?query=apple&limit=20&onlyGeneric=true
app.get("/foods/search", requireAuth, async (req, res) => {
  try {
    const query = (req.query.query || req.query.q || "").toString().trim();
    if (!query) return res.status(400).json({ error: "Missing query parameter" });
    const limit = req.query.limit ? Math.max(1, Math.min(50, Number(req.query.limit))) : 20;
    const onlyGeneric = req.query.onlyGeneric !== "false"; // default true

    const result = await edamamSearchFoods(query, { limit, onlyGeneric });
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
});

// Utility: compute kcal from grams and kcal_100g (no DB change)
// POST /utils/calc-kcal  Body: { grams, kcal_100g }
app.post("/utils/calc-kcal", (req, res) => {
  const { grams, kcal_100g } = req.body || {};
  if (grams == null || kcal_100g == null)
    return res.status(400).json({ error: "Missing fields (grams, kcal_100g)" });
  const kcal = (Number(kcal_100g) / 100) * Number(grams);
  res.json({ kcal: Number(kcal.toFixed(2)) });
});

// Start server
app.listen(PORT, () => {
  console.log(`FoodLog backend running on http://localhost:${PORT}`);
});
