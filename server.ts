import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";

const dbPath = process.env.NODE_ENV === "production" ? "/tmp/leather_ops.db" : "leather_ops.db";
const db = new Database(dbPath);

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS merchants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS buyers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    region TEXT,
    merchant_id INTEGER,
    FOREIGN KEY (merchant_id) REFERENCES merchants (id)
  );

  CREATE TABLE IF NOT EXISTS action_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT CHECK(type IN ('Sample Dispatch', 'General Task', 'Discussion Point')),
    description TEXT NOT NULL,
    due_date TEXT,
    merchant_id INTEGER,
    buyer_id INTEGER,
    status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Completed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants (id),
    FOREIGN KEY (buyer_id) REFERENCES buyers (id)
  );
`);

// Seed Data if empty
const merchantCount = db.prepare("SELECT COUNT(*) as count FROM merchants").get() as { count: number };
if (merchantCount.count === 0) {
  const insertMerchant = db.prepare("INSERT INTO merchants (name, email) VALUES (?, ?)");
  insertMerchant.run("John Doe", "john@leatherops.com");
  insertMerchant.run("Sarah Smith", "sarah@leatherops.com");

  const insertBuyer = db.prepare("INSERT INTO buyers (name, region, merchant_id) VALUES (?, ?, ?)");
  insertBuyer.run("Nordic Styles", "Europe", 1);
  insertBuyer.run("Oz Leather Co", "Australia", 1);
  insertBuyer.run("Liberty Apparel", "America", 2);
}

const app = express();
export { app };

async function startServer() {
  const PORT = 3000;
  app.use(express.json());

  // API Routes
  app.get("/api/merchants", (req, res) => {
    const merchants = db.prepare("SELECT * FROM merchants").all();
    res.json(merchants);
  });

  app.post("/api/merchants", (req, res) => {
    const { name, email } = req.body;
    try {
      const info = db.prepare("INSERT INTO merchants (name, email) VALUES (?, ?)").run(name, email);
      res.json({ id: info.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/buyers", (req, res) => {
    const buyers = db.prepare(`
      SELECT b.*, m.name as merchant_name 
      FROM buyers b 
      JOIN merchants m ON b.merchant_id = m.id
    `).all();
    res.json(buyers);
  });

  app.post("/api/buyers", (req, res) => {
    const { name, region, merchant_id } = req.body;
    try {
      const info = db.prepare("INSERT INTO buyers (name, region, merchant_id) VALUES (?, ?, ?)").run(name, region, merchant_id);
      res.json({ id: info.lastInsertRowid });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/action-items", (req, res) => {
    const items = db.prepare(`
      SELECT a.*, m.name as merchant_name, b.name as buyer_name 
      FROM action_items a
      JOIN merchants m ON a.merchant_id = m.id
      LEFT JOIN buyers b ON a.buyer_id = b.id
      ORDER BY a.due_date ASC NULLS LAST
    `).all();
    res.json(items);
  });

  app.post("/api/action-items", (req, res) => {
    const { type, description, due_date, merchant_id, buyer_id } = req.body;
    const info = db.prepare(`
      INSERT INTO action_items (type, description, due_date, merchant_id, buyer_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(type, description, due_date, merchant_id, buyer_id);
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/action-items/:id", (req, res) => {
    const { status } = req.body;
    db.prepare("UPDATE action_items SET status = ? WHERE id = ?").run(status, req.params.id);
    res.json({ success: true });
  });

  app.put("/api/action-items/:id", (req, res) => {
    const { type, description, due_date, merchant_id, buyer_id } = req.body;
    db.prepare(`
      UPDATE action_items 
      SET type = ?, description = ?, due_date = ?, merchant_id = ?, buyer_id = ?
      WHERE id = ?
    `).run(type, description, due_date, merchant_id, buyer_id, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/action-items/:id", (req, res) => {
    db.prepare("DELETE FROM action_items WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/merchants/:id/details", (req, res) => {
    const merchant = db.prepare("SELECT * FROM merchants WHERE id = ?").get(req.params.id);
    const buyers = db.prepare("SELECT * FROM buyers WHERE merchant_id = ?").all(req.params.id);
    const items = db.prepare(`
      SELECT a.*, b.name as buyer_name 
      FROM action_items a
      JOIN buyers b ON a.buyer_id = b.id
      WHERE a.merchant_id = ? AND a.status = 'Pending'
      ORDER BY a.due_date ASC NULLS LAST
    `).all(req.params.id);
    res.json({ merchant, buyers, items });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }
}

startServer();
