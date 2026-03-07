import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

// In-memory store — no native dependencies, works in any serverless environment
interface Merchant { id: number; name: string; email: string }
interface Buyer { id: number; name: string; region: string; merchant_id: number }
interface ActionItem {
  id: number;
  type: 'Sample Dispatch' | 'General Task' | 'Discussion Point';
  description: string;
  due_date: string | null;
  merchant_id: number;
  buyer_id: number | null;
  status: 'Pending' | 'Completed';
  created_at: string;
}

let merchants: Merchant[] = [
  { id: 1, name: 'Nandita', email: 'nandita@leatherops.com' },
  { id: 2, name: 'John Doe', email: 'john@leatherops.com' },
  { id: 3, name: 'Sarah Smith', email: 'sarah@leatherops.com' },
];

let buyers: Buyer[] = [
  { id: 1, name: 'Nordic Styles', region: 'Europe', merchant_id: 2 },
  { id: 2, name: 'Oz Leather Co', region: 'Australia', merchant_id: 2 },
  { id: 3, name: 'Liberty Apparel', region: 'America', merchant_id: 3 },
];

let actionItems: ActionItem[] = [];

let nextMerchantId = 4;
let nextBuyerId = 4;
let nextItemId = 1;

const app = express();
export { app };

async function startServer() {
  const PORT = 3000;
  app.use(express.json());

  // API Routes
  app.get("/api/merchants", (req, res) => {
    res.json(merchants);
  });

  app.post("/api/merchants", (req, res) => {
    const { name, email } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    if (merchants.find(m => m.email === email)) {
      return res.status(400).json({ error: 'A merchant with this email already exists.' });
    }
    const merchant = { id: nextMerchantId++, name, email };
    merchants.push(merchant);
    res.json({ id: merchant.id });
  });

  app.get("/api/buyers", (req, res) => {
    const result = buyers.map(b => ({
      ...b,
      merchant_name: merchants.find(m => m.id === b.merchant_id)?.name,
    }));
    res.json(result);
  });

  app.post("/api/buyers", (req, res) => {
    const { name, region, merchant_id } = req.body;
    const buyer = { id: nextBuyerId++, name, region, merchant_id: Number(merchant_id) };
    buyers.push(buyer);
    res.json({ id: buyer.id });
  });

  app.get("/api/action-items", (req, res) => {
    const result = actionItems
      .map(a => ({
        ...a,
        merchant_name: merchants.find(m => m.id === a.merchant_id)?.name,
        buyer_name: buyers.find(b => b.id === a.buyer_id)?.name ?? null,
      }))
      .sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    res.json(result);
  });

  app.post("/api/action-items", (req, res) => {
    const { type, description, due_date, merchant_id, buyer_id } = req.body;
    const item: ActionItem = {
      id: nextItemId++,
      type,
      description,
      due_date: due_date || null,
      merchant_id: Number(merchant_id),
      buyer_id: buyer_id ? Number(buyer_id) : null,
      status: 'Pending',
      created_at: new Date().toISOString(),
    };
    actionItems.push(item);
    res.json({ id: item.id });
  });

  app.patch("/api/action-items/:id", (req, res) => {
    const { status } = req.body;
    const item = actionItems.find(a => a.id === Number(req.params.id));
    if (item) item.status = status;
    res.json({ success: true });
  });

  app.put("/api/action-items/:id", (req, res) => {
    const { type, description, due_date, merchant_id, buyer_id } = req.body;
    const item = actionItems.find(a => a.id === Number(req.params.id));
    if (item) {
      item.type = type;
      item.description = description;
      item.due_date = due_date || null;
      item.merchant_id = Number(merchant_id);
      item.buyer_id = buyer_id ? Number(buyer_id) : null;
    }
    res.json({ success: true });
  });

  app.delete("/api/action-items/:id", (req, res) => {
    actionItems = actionItems.filter(a => a.id !== Number(req.params.id));
    res.json({ success: true });
  });

  app.get("/api/merchants/:id/details", (req, res) => {
    const id = Number(req.params.id);
    const merchant = merchants.find(m => m.id === id);
    const merchantBuyers = buyers.filter(b => b.merchant_id === id);
    const items = actionItems
      .filter(a => a.merchant_id === id && a.status === 'Pending')
      .map(a => ({ ...a, buyer_name: buyers.find(b => b.id === a.buyer_id)?.name ?? null }))
      .sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    res.json({ merchant, buyers: merchantBuyers, items });
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
