const express = require("express");
const path = require("path");
const fs = require("fs");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const port = Number(process.env.PORT) || 3000;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(process.env.PGSSL === "true" ? { ssl: { rejectUnauthorized: false } } : {})
});

app.use(express.json({ limit: "32kb" }));

function requireAuth(req, res, next) {
  const token = req.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Please sign in to continue." });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
}

function createToken(user) {
  return jwt.sign({ id: user.id, name: user.name, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "7d"
  });
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch (error) {
    console.error("Database health check failed:", error.message);
    res.status(503).json({ error: "Database is unavailable." });
  }
});

app.get("/api/menu", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, description, category, price, image_url AS "imageUrl",
              badge, is_vegetarian AS "isVegetarian"
       FROM menu_items WHERE is_available = TRUE ORDER BY id`
    );
    res.json(rows);
  } catch (error) {
    console.error("Menu request failed:", error.message);
    res.status(500).json({ error: "Unable to load the menu right now." });
  }
});

app.post("/api/auth/register", async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (name.length < 2 || name.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: "Enter your name, a valid email and a password of at least 8 characters." });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, hash]
    );
    res.status(201).json({ user: rows[0], token: createToken(rows[0]) });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "An account with this email already exists." });
    console.error("Registration failed:", error.message);
    res.status(500).json({ error: "Unable to create your account right now." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!email || !password) return res.status(400).json({ error: "Enter your email and password." });

  try {
    const { rows } = await pool.query(
      "SELECT id, name, email, password_hash FROM users WHERE email = $1",
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "The email or password is incorrect." });
    }
    const publicUser = { id: user.id, name: user.name, email: user.email };
    res.json({ user: publicUser, token: createToken(publicUser) });
  } catch (error) {
    console.error("Login failed:", error.message);
    res.status(500).json({ error: "Unable to sign in right now." });
  }
});

app.post("/api/orders", requireAuth, async (req, res) => {
  const address = typeof req.body.address === "string" ? req.body.address.trim() : "";
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (address.length < 5 || address.length > 300 || items.length < 1 || items.length > 30) {
    return res.status(400).json({ error: "Add a delivery address and at least one menu item." });
  }
  const quantities = new Map();
  for (const item of items) {
    const id = Number(item.id);
    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) {
      return res.status(400).json({ error: "Your cart contains an invalid item or quantity." });
    }
    quantities.set(id, (quantities.get(id) || 0) + quantity);
  }

  let client;
  let transactionStarted = false;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;
    const ids = [...quantities.keys()];
    const { rows: menuItems } = await client.query(
      "SELECT id, name, price FROM menu_items WHERE id = ANY($1::bigint[]) AND is_available = TRUE FOR SHARE",
      [ids]
    );
    if (menuItems.length !== ids.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "One or more cart items are no longer available. Please refresh the menu." });
    }
    const total = menuItems.reduce((sum, item) => sum + Number(item.price) * quantities.get(Number(item.id)), 0);
    const { rows: orderRows } = await client.query(
      "INSERT INTO orders (user_id, total, delivery_address) VALUES ($1, $2, $3) RETURNING id, status, total, created_at AS \"createdAt\"",
      [req.user.id, total.toFixed(2), address]
    );
    const order = orderRows[0];
    for (const item of menuItems) {
      await client.query(
        "INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price) VALUES ($1, $2, $3, $4, $5)",
        [order.id, item.id, item.name, quantities.get(Number(item.id)), item.price]
      );
    }
    await client.query("COMMIT");
    transactionStarted = false;
    res.status(201).json({ ...order, deliveryAddress: address, items: menuItems.map((item) => ({
      name: item.name, quantity: quantities.get(Number(item.id))
    })) });
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Order rollback failed:", rollbackError.message);
      }
    }
    console.error("Order creation failed:", error.message);
    res.status(500).json({ error: "Unable to place your order right now." });
  } finally {
    if (client) client.release();
  }
});

app.get("/api/orders/:id", requireAuth, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "Invalid order number." });
  try {
    const { rows } = await pool.query(
      `SELECT id, status, total, delivery_address AS "deliveryAddress",
              created_at AS "createdAt"
       FROM orders WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "We couldn't find that order." });
    const { rows: items } = await pool.query(
      "SELECT item_name AS name, quantity FROM order_items WHERE order_id = $1 ORDER BY id",
      [req.params.id]
    );
    res.json({ ...rows[0], items });
  } catch (error) {
    console.error("Order lookup failed:", error.message);
    res.status(500).json({ error: "Unable to load that order right now." });
  }
});

app.use(express.static(path.join(__dirname, "..", "frontend")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "..", "frontend", "index.html")));

async function start() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters.");
  }
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);
  app.listen(port, () => console.log(`BiteBox is running at http://localhost:${port}`));
}

start().catch((error) => {
  console.error("BiteBox could not start:", error.message);
  process.exitCode = 1;
});
