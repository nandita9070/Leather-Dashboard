import express from "express";
import { google } from "googleapis";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Merchant { id: number; name: string; email: string }
interface Buyer    { id: number; name: string; region: string; merchant_id: number }
interface ActionItem {
  id: number;
  type: string;
  description: string;
  due_date: string | null;
  merchant_id: number;
  buyer_id: number | null;
  status: 'Pending' | 'Completed';
  created_at: string;
}
interface Meta { merchant: number; buyer: number; item: number }
interface DB   { merchants: Merchant[]; buyers: Buyer[]; items: ActionItem[]; meta: Meta }

// ─── Seed data (from leather-dashboard-backup.json) ──────────────────────────
const SEED: DB = {
  merchants: [
    { id: 1, name: 'Nandita',  email: 'nandita@leatherops.com'       },
    { id: 4, name: 'sarah',    email: 'sarah@bnenterprises.co.in'    },
    { id: 5, name: 'kusum',    email: 'kusum@bnenterprises.co.in'    },
    { id: 6, name: 'aman',     email: 'aman@bnenterprises.co.in'     },
  ],
  buyers: [
    { id: 4, name: 'PWT',          region: 'Europe',    merchant_id: 4 },
    { id: 5, name: 'Seed',         region: 'Australia', merchant_id: 5 },
    { id: 6, name: 'Bernardo',     region: 'USA',       merchant_id: 5 },
    { id: 7, name: 'day',          region: 'Europe',    merchant_id: 4 },
    { id: 8, name: 'Brunns Bazaar',region: 'Europe',    merchant_id: 6 },
    { id: 9, name: 'Heartmade',    region: 'Europe',    merchant_id: 6 },
  ],
  items: [
    { id:  1, type:'General Task', description:'give flight jacket price to buying house',                                                                                        due_date:'2026-03-10', merchant_id:1, buyer_id:null, status:'Completed', created_at:'2026-03-10T07:51:10.817Z' },
    { id:  2, type:'General Task', description:'discuss cut PO with Kusum',                                                                                                       due_date:null,         merchant_id:1, buyer_id:null, status:'Pending',   created_at:'2026-03-10T07:52:37.448Z' },
    { id:  3, type:'General Task', description:'discuss TOP samples with Kusum and put TOP of current production in sampling',                                                    due_date:'2026-03-10', merchant_id:1, buyer_id:null, status:'Completed', created_at:'2026-03-10T07:53:53.084Z' },
    { id:  4, type:'General Task', description:'get brothers brand hangtag and order all labels and hangtags for this order',                                                     due_date:null,         merchant_id:4, buyer_id:4,    status:'Pending',   created_at:'2026-03-10T08:06:34.662Z' },
    { id:  5, type:'General Task', description:'set the new fabricator',                                                                                                          due_date:null,         merchant_id:1, buyer_id:null, status:'Pending',   created_at:'2026-03-10T09:35:40.083Z' },
    { id:  6, type:'General Task', description:'Send distressed swatch to bernardo',                                                                                              due_date:null,         merchant_id:5, buyer_id:6,    status:'Pending',   created_at:'2026-03-10T09:59:09.769Z' },
    { id:  7, type:'General Task', description:'thunnel and ariel -- nappa in colours similar to walnut',                                                                         due_date:null,         merchant_id:4, buyer_id:7,    status:'Pending',   created_at:'2026-03-10T11:21:15.617Z' },
    { id:  8, type:'General Task', description:'3 options for barrack and drape -- nappalon only in black and crackle in grey and brown',                                         due_date:null,         merchant_id:4, buyer_id:7,    status:'Pending',   created_at:'2026-03-10T11:22:18.912Z' },
    { id:  9, type:'General Task', description:'take PP sample payment from Day',                                                                                                 due_date:null,         merchant_id:1, buyer_id:null, status:'Pending',   created_at:'2026-03-10T11:32:38.011Z' },
    { id: 10, type:'General Task', description:'get extension on BB new orders',                                                                                                  due_date:null,         merchant_id:6, buyer_id:8,    status:'Pending',   created_at:'2026-03-10T12:26:21.532Z' },
    { id: 11, type:'General Task', description:'Send swatches of softi',                                                                                                          due_date:null,         merchant_id:6, buyer_id:9,    status:'Pending',   created_at:'2026-03-10T12:30:25.887Z' },
    { id: 12, type:'General Task', description:'trade connect e platform , email from ramesh',                                                                                    due_date:null,         merchant_id:1, buyer_id:null, status:'Pending',   created_at:'2026-03-10T12:47:04.822Z' },
    { id: 13, type:'General Task', description:'PV do booking for september',                                                                                                     due_date:null,         merchant_id:1, buyer_id:null, status:'Pending',   created_at:'2026-03-10T12:47:21.531Z' },
    { id: 14, type:'General Task', description:'discuss new sales samples program',                                                                                               due_date:null,         merchant_id:4, buyer_id:4,    status:'Pending',   created_at:'2026-03-10T12:49:12.250Z' },
    { id: 15, type:'General Task', description:'bungy approval from bernado + stopper',                                                                                           due_date:null,         merchant_id:5, buyer_id:6,    status:'Pending',   created_at:'2026-03-10T13:12:20.070Z' },
    { id: 16, type:'General Task', description:'bungy\nbutton gunmetal\nplastic button options \nMocks black and brown -- distressed\nB009 -- fit sample\nB725 -- fit sample 1st fit', due_date:'2026-03-11', merchant_id:5, buyer_id:6, status:'Pending', created_at:'2026-03-10T13:14:34.841Z' },
  ],
  meta: { merchant: 7, buyer: 10, item: 17 },
};

// ─── Google Sheets client ─────────────────────────────────────────────────────
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
const SHEET = { M: 'Merchants', B: 'Buyers', T: 'Tasks', META: 'Meta' } as const;

function getClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function readSheet(client: ReturnType<typeof getClient>, name: string): Promise<string[][]> {
  try {
    const res = await client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${name}!A:Z`,
    });
    return (res.data.values as string[][]) ?? [];
  } catch {
    return [];
  }
}

async function writeSheet(client: ReturnType<typeof getClient>, name: string, rows: string[][]): Promise<void> {
  await client.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: `${name}!A:Z` });
  if (rows.length > 0) {
    await client.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${name}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });
  }
}

// ─── Parsers ──────────────────────────────────────────────────────────────────
function parseMerchants(rows: string[][]): Merchant[] {
  return rows.slice(1).filter(r => r[0]).map(r => ({
    id: Number(r[0]), name: r[1] ?? '', email: r[2] ?? '',
  }));
}
function parseBuyers(rows: string[][]): Buyer[] {
  return rows.slice(1).filter(r => r[0]).map(r => ({
    id: Number(r[0]), name: r[1] ?? '', region: r[2] ?? '', merchant_id: Number(r[3]),
  }));
}
function parseItems(rows: string[][]): ActionItem[] {
  return rows.slice(1).filter(r => r[0]).map(r => ({
    id: Number(r[0]), type: r[1] ?? '', description: r[2] ?? '',
    due_date: r[3] || null, merchant_id: Number(r[4]),
    buyer_id: r[5] ? Number(r[5]) : null,
    status: (r[6] ?? 'Pending') as 'Pending' | 'Completed',
    created_at: r[7] ?? '',
  }));
}
function parseMeta(rows: string[][]): Meta {
  if (rows.length <= 1) return SEED.meta;
  const r = rows[1];
  return {
    merchant: Number(r[0]) || SEED.meta.merchant,
    buyer:    Number(r[1]) || SEED.meta.buyer,
    item:     Number(r[2]) || SEED.meta.item,
  };
}

// ─── Serialisers ──────────────────────────────────────────────────────────────
const merchantRows = (d: Merchant[]): string[][] => [
  ['id','name','email'], ...d.map(m => [String(m.id), m.name, m.email]),
];
const buyerRows = (d: Buyer[]): string[][] => [
  ['id','name','region','merchant_id'], ...d.map(b => [String(b.id), b.name, b.region, String(b.merchant_id)]),
];
const itemRows = (d: ActionItem[]): string[][] => [
  ['id','type','description','due_date','merchant_id','buyer_id','status','created_at'],
  ...d.map(i => [String(i.id), i.type, i.description, i.due_date ?? '', String(i.merchant_id),
                  i.buyer_id ? String(i.buyer_id) : '', i.status, i.created_at]),
];
const metaRows = (m: Meta): string[][] => [
  ['next_merchant_id','next_buyer_id','next_item_id'],
  [String(m.merchant), String(m.buyer), String(m.item)],
];

// ─── Initialisation (idempotent) ──────────────────────────────────────────────
let ready = false;

async function ensureReady(client: ReturnType<typeof getClient>): Promise<void> {
  if (ready) return;

  // 1. Fetch existing sheet tabs
  const spreadsheet = await client.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existing = new Set<string>(
    (spreadsheet.data.sheets ?? []).map((s: { properties?: { title?: string } }) => s.properties?.title ?? '')
  );

  // 2. Create any missing tabs
  const needed = [SHEET.M, SHEET.B, SHEET.T, SHEET.META];
  const toCreate = needed.filter(n => !existing.has(n));
  if (toCreate.length > 0) {
    await client.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: toCreate.map(title => ({ addSheet: { properties: { title } } })),
      },
    });
  }

  // 3. Seed if Merchants tab has no data rows
  const mRows = await readSheet(client, SHEET.M);
  if (mRows.length <= 1) {
    await Promise.all([
      writeSheet(client, SHEET.M,    merchantRows(SEED.merchants)),
      writeSheet(client, SHEET.B,    buyerRows(SEED.buyers)),
      writeSheet(client, SHEET.T,    itemRows(SEED.items)),
      writeSheet(client, SHEET.META, metaRows(SEED.meta)),
    ]);
  }

  ready = true;
}

// ─── Load full DB ─────────────────────────────────────────────────────────────
async function loadDB(client: ReturnType<typeof getClient>): Promise<DB> {
  const [mR, bR, iR, metaR] = await Promise.all([
    readSheet(client, SHEET.M),
    readSheet(client, SHEET.B),
    readSheet(client, SHEET.T),
    readSheet(client, SHEET.META),
  ]);
  return {
    merchants: parseMerchants(mR),
    buyers:    parseBuyers(bR),
    items:     parseItems(iR),
    meta:      parseMeta(metaR),
  };
}

// ─── Express app ──────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Init middleware
app.use(async (_req, res, next) => {
  try {
    await ensureReady(getClient());
    next();
  } catch (err) {
    console.error('Sheets init error:', err);
    res.status(500).json({ error: 'Failed to initialise Google Sheets.' });
  }
});

// ── Merchants ─────────────────────────────────────────────────────────────────
app.get('/api/merchants', async (_req, res) => {
  try {
    const client = getClient();
    const rows = await readSheet(client, SHEET.M);
    res.json(parseMerchants(rows));
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.post('/api/merchants', async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    const client = getClient();
    const db = await loadDB(client);
    if (email && db.merchants.find(m => m.email === email))
      return res.status(400).json({ error: 'A merchant with this email already exists.' });
    const id = db.meta.merchant;
    db.merchants.push({ id, name, email });
    db.meta.merchant = id + 1;
    await Promise.all([
      writeSheet(client, SHEET.M,    merchantRows(db.merchants)),
      writeSheet(client, SHEET.META, metaRows(db.meta)),
    ]);
    res.json({ id });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.put('/api/merchants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, email } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    const client = getClient();
    const db = await loadDB(client);
    const m = db.merchants.find(x => x.id === id);
    if (!m) return res.status(404).json({ error: 'Merchant not found.' });
    if (email && db.merchants.find(x => x.email === email && x.id !== id))
      return res.status(400).json({ error: 'A merchant with this email already exists.' });
    m.name = name; m.email = email;
    await writeSheet(client, SHEET.M, merchantRows(db.merchants));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.delete('/api/merchants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const client = getClient();
    const db = await loadDB(client);
    db.merchants = db.merchants.filter(m => m.id !== id);
    db.buyers    = db.buyers.filter(b => b.merchant_id !== id);
    db.items     = db.items.filter(a => a.merchant_id !== id);
    await Promise.all([
      writeSheet(client, SHEET.M, merchantRows(db.merchants)),
      writeSheet(client, SHEET.B, buyerRows(db.buyers)),
      writeSheet(client, SHEET.T, itemRows(db.items)),
    ]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.get('/api/merchants/:id/details', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const client = getClient();
    const db = await loadDB(client);
    const merchant = db.merchants.find(m => m.id === id);
    const buyers   = db.buyers.filter(b => b.merchant_id === id);
    const items    = db.items
      .filter(a => a.merchant_id === id && a.status === 'Pending')
      .map(a => ({ ...a, buyer_name: db.buyers.find(b => b.id === a.buyer_id)?.name ?? null }))
      .sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    res.json({ merchant, buyers, items });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ── Buyers ────────────────────────────────────────────────────────────────────
app.get('/api/buyers', async (_req, res) => {
  try {
    const client = getClient();
    const db = await loadDB(client);
    const result = db.buyers.map(b => ({
      ...b,
      merchant_name: db.merchants.find(m => m.id === b.merchant_id)?.name,
    }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.post('/api/buyers', async (req, res) => {
  try {
    const { name, region, merchant_id } = req.body;
    const client = getClient();
    const db = await loadDB(client);
    const id = db.meta.buyer;
    db.buyers.push({ id, name, region, merchant_id: Number(merchant_id) });
    db.meta.buyer = id + 1;
    await Promise.all([
      writeSheet(client, SHEET.B,    buyerRows(db.buyers)),
      writeSheet(client, SHEET.META, metaRows(db.meta)),
    ]);
    res.json({ id });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.put('/api/buyers/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, region, merchant_id } = req.body;
    const client = getClient();
    const db = await loadDB(client);
    const b = db.buyers.find(x => x.id === id);
    if (!b) return res.status(404).json({ error: 'Buyer not found.' });
    b.name = name; b.region = region; b.merchant_id = Number(merchant_id);
    await writeSheet(client, SHEET.B, buyerRows(db.buyers));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.delete('/api/buyers/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const client = getClient();
    const db = await loadDB(client);
    db.buyers = db.buyers.filter(b => b.id !== id);
    await writeSheet(client, SHEET.B, buyerRows(db.buyers));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ── Action Items ──────────────────────────────────────────────────────────────
app.get('/api/action-items', async (_req, res) => {
  try {
    const client = getClient();
    const db = await loadDB(client);
    const result = db.items
      .map(a => ({
        ...a,
        merchant_name: db.merchants.find(m => m.id === a.merchant_id)?.name,
        buyer_name:    db.buyers.find(b => b.id === a.buyer_id)?.name ?? null,
      }))
      .sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    res.json(result);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.post('/api/action-items', async (req, res) => {
  try {
    const { type, description, due_date, merchant_id, buyer_id } = req.body;
    const client = getClient();
    const db = await loadDB(client);
    const id = db.meta.item;
    const item: ActionItem = {
      id, type, description,
      due_date: due_date || null,
      merchant_id: Number(merchant_id),
      buyer_id: buyer_id ? Number(buyer_id) : null,
      status: 'Pending',
      created_at: new Date().toISOString(),
    };
    db.items.push(item);
    db.meta.item = id + 1;
    await Promise.all([
      writeSheet(client, SHEET.T,    itemRows(db.items)),
      writeSheet(client, SHEET.META, metaRows(db.meta)),
    ]);
    res.json({ id });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.put('/api/action-items/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { type, description, due_date, merchant_id, buyer_id } = req.body;
    const client = getClient();
    const db = await loadDB(client);
    const item = db.items.find(a => a.id === id);
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    item.type = type;
    item.description = description;
    item.due_date = due_date || null;
    item.merchant_id = Number(merchant_id);
    item.buyer_id = buyer_id ? Number(buyer_id) : null;
    await writeSheet(client, SHEET.T, itemRows(db.items));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.patch('/api/action-items/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const client = getClient();
    const db = await loadDB(client);
    const item = db.items.find(a => a.id === id);
    if (item) item.status = status;
    await writeSheet(client, SHEET.T, itemRows(db.items));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.delete('/api/action-items/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const client = getClient();
    const db = await loadDB(client);
    db.items = db.items.filter(a => a.id !== id);
    await writeSheet(client, SHEET.T, itemRows(db.items));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

export default app;
