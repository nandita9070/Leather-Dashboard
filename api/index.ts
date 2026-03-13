import express from "express";
import { createClient } from "@supabase/supabase-js";
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
interface MetaRow {
  next_merchant_id: number;
  next_buyer_id: number;
  next_item_id: number;
}

// ─── Supabase client ──────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Google Sheets client (secondary backup) ──────────────────────────────────
function getSheetsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function writeTab(client: ReturnType<typeof getSheetsClient>, tabName: string, rows: string[][]): Promise<void> {
  const id = process.env.GOOGLE_SPREADSHEET_ID!;
  await client.spreadsheets.values.clear({ spreadsheetId: id, range: `${tabName}!A:Z` });
  if (rows.length > 0) {
    await client.spreadsheets.values.update({
      spreadsheetId: id, range: `${tabName}!A1`,
      valueInputOption: 'RAW', requestBody: { values: rows },
    });
  }
}

// Reads current Supabase state and writes all 4 tabs to Google Sheets
async function syncToSheets(): Promise<void> {
  const [{ data: merchants }, { data: buyers }, { data: entries }, { data: metaArr }] = await Promise.all([
    supabase.from('merchants').select('*').order('id'),
    supabase.from('buyers').select('*').order('id'),
    supabase.from('factory_entries').select('*').order('id'),
    supabase.from('ld_meta').select('*').eq('id', 1),
  ]);
  const meta = metaArr?.[0] as MetaRow | undefined;
  const client = getSheetsClient();
  await Promise.all([
    writeTab(client, 'Merchants', [
      ['id', 'name', 'email'],
      ...(merchants ?? []).map((m: Merchant) => [String(m.id), m.name, m.email]),
    ]),
    writeTab(client, 'Buyers', [
      ['id', 'name', 'region', 'merchant_id'],
      ...(buyers ?? []).map((b: Buyer) => [String(b.id), b.name, b.region, String(b.merchant_id)]),
    ]),
    writeTab(client, 'Tasks', [
      ['id', 'type', 'description', 'due_date', 'merchant_id', 'buyer_id', 'status', 'created_at'],
      ...(entries ?? []).map((e: ActionItem) => [
        String(e.id), e.type, e.description, e.due_date ?? '',
        String(e.merchant_id), e.buyer_id ? String(e.buyer_id) : '', e.status, e.created_at,
      ]),
    ]),
    writeTab(client, 'Meta', [
      ['next_merchant_id', 'next_buyer_id', 'next_item_id'],
      [String(meta?.next_merchant_id ?? ''), String(meta?.next_buyer_id ?? ''), String(meta?.next_item_id ?? '')],
    ]),
  ]);
}

// Runs Sheets sync after a Supabase mutation; returns true if Sheets sync succeeded
async function withSheetsSync<T extends object>(supabaseWork: () => Promise<T>): Promise<T & { sheetsSync: boolean }> {
  const result = await supabaseWork();
  let sheetsSync = true;
  try {
    await syncToSheets();
  } catch (err) {
    console.error('Google Sheets sync failed (Supabase write succeeded):', err);
    sheetsSync = false;
  }
  return { ...result, sheetsSync };
}

// ─── Meta helpers ─────────────────────────────────────────────────────────────
async function nextId(field: 'next_merchant_id' | 'next_buyer_id' | 'next_item_id'): Promise<number> {
  const { data } = await supabase.from('ld_meta').select(field).eq('id', 1).single();
  const current = (data as Record<string, number>)[field];
  await supabase.from('ld_meta').update({ [field]: current + 1 }).eq('id', 1);
  return current;
}

// ─── Express app ──────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// ── Merchants ─────────────────────────────────────────────────────────────────
app.get('/api/merchants', async (_req, res) => {
  try {
    const { data, error } = await supabase.from('merchants').select('*').order('id');
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.post('/api/merchants', async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    if (email) {
      const { data: existing } = await supabase.from('merchants').select('id').eq('email', email).maybeSingle();
      if (existing) return res.status(400).json({ error: 'A merchant with this email already exists.' });
    }
    const id = await nextId('next_merchant_id');
    const { error } = await supabase.from('merchants').insert({ id, name, email: email ?? '' });
    if (error) throw error;
    const out = await withSheetsSync(async () => ({ id }));
    res.json(out);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.put('/api/merchants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, email } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required.' });
    if (email) {
      const { data: existing } = await supabase.from('merchants').select('id').eq('email', email).neq('id', id).maybeSingle();
      if (existing) return res.status(400).json({ error: 'A merchant with this email already exists.' });
    }
    const { error } = await supabase.from('merchants').update({ name, email: email ?? '' }).eq('id', id);
    if (error) throw error;
    const out = await withSheetsSync(async () => ({ success: true }));
    res.json(out);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.delete('/api/merchants/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { error } = await supabase.from('merchants').delete().eq('id', id);
    if (error) throw error;
    const out = await withSheetsSync(async () => ({ success: true }));
    res.json(out);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.get('/api/merchants/:id/details', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [{ data: merchant }, { data: buyers }, { data: items }] = await Promise.all([
      supabase.from('merchants').select('*').eq('id', id).single(),
      supabase.from('buyers').select('*').eq('merchant_id', id),
      supabase.from('factory_entries').select('*').eq('merchant_id', id).eq('status', 'Pending'),
    ]);
    const buyerMap = new Map((buyers ?? []).map((b: Buyer) => [b.id, b.name]));
    const sortedItems = (items ?? [])
      .map((a: ActionItem) => ({ ...a, buyer_name: buyerMap.get(a.buyer_id!) ?? null }))
      .sort((a: ActionItem, b: ActionItem) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    res.json({ merchant, buyers: buyers ?? [], items: sortedItems });
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ── Buyers ────────────────────────────────────────────────────────────────────
app.get('/api/buyers', async (_req, res) => {
  try {
    const { data: buyers, error } = await supabase.from('buyers').select('*').order('id');
    if (error) throw error;
    const { data: merchants } = await supabase.from('merchants').select('id, name');
    const merchantMap = new Map((merchants ?? []).map((m: Merchant) => [m.id, m.name]));
    const result = (buyers ?? []).map((b: Buyer) => ({
      ...b, merchant_name: merchantMap.get(b.merchant_id),
    }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.post('/api/buyers', async (req, res) => {
  try {
    const { name, region, merchant_id } = req.body;
    const id = await nextId('next_buyer_id');
    const { error } = await supabase.from('buyers').insert({ id, name, region: region ?? '', merchant_id: Number(merchant_id) });
    if (error) throw error;
    const out = await withSheetsSync(async () => ({ id }));
    res.json(out);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.put('/api/buyers/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, region, merchant_id } = req.body;
    const { error } = await supabase.from('buyers').update({ name, region: region ?? '', merchant_id: Number(merchant_id) }).eq('id', id);
    if (error) throw error;
    const out = await withSheetsSync(async () => ({ success: true }));
    res.json(out);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.delete('/api/buyers/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { error } = await supabase.from('buyers').delete().eq('id', id);
    if (error) throw error;
    const out = await withSheetsSync(async () => ({ success: true }));
    res.json(out);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

// ── Action Items ──────────────────────────────────────────────────────────────
app.get('/api/action-items', async (_req, res) => {
  try {
    const { data: items, error } = await supabase.from('factory_entries').select('*');
    if (error) throw error;
    const [{ data: merchants }, { data: buyers }] = await Promise.all([
      supabase.from('merchants').select('id, name'),
      supabase.from('buyers').select('id, name'),
    ]);
    const merchantMap = new Map((merchants ?? []).map((m: Merchant) => [m.id, m.name]));
    const buyerMap    = new Map((buyers ?? []).map((b: Buyer) => [b.id, b.name]));
    const result = (items ?? [])
      .map((a: ActionItem) => ({
        ...a,
        merchant_name: merchantMap.get(a.merchant_id),
        buyer_name:    a.buyer_id ? (buyerMap.get(a.buyer_id) ?? null) : null,
      }))
      .sort((a: ActionItem, b: ActionItem) => {
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
    const id = await nextId('next_item_id');
    const { error } = await supabase.from('factory_entries').insert({
      id, type, description,
      due_date: due_date || null,
      merchant_id: Number(merchant_id),
      buyer_id: buyer_id ? Number(buyer_id) : null,
      status: 'Pending',
      created_at: new Date().toISOString(),
    });
    if (error) throw error;
    const out = await withSheetsSync(async () => ({ id }));
    res.json(out);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.put('/api/action-items/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { type, description, due_date, merchant_id, buyer_id } = req.body;
    const { error } = await supabase.from('factory_entries').update({
      type, description,
      due_date: due_date || null,
      merchant_id: Number(merchant_id),
      buyer_id: buyer_id ? Number(buyer_id) : null,
    }).eq('id', id);
    if (error) throw error;
    const out = await withSheetsSync(async () => ({ success: true }));
    res.json(out);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.patch('/api/action-items/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;
    const { error } = await supabase.from('factory_entries').update({ status }).eq('id', id);
    if (error) throw error;
    const out = await withSheetsSync(async () => ({ success: true }));
    res.json(out);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

app.delete('/api/action-items/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { error } = await supabase.from('factory_entries').delete().eq('id', id);
    if (error) throw error;
    const out = await withSheetsSync(async () => ({ success: true }));
    res.json(out);
  } catch (err) { res.status(500).json({ error: String(err) }); }
});

export default app;
