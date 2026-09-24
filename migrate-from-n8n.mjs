#!/usr/bin/env node
/**
 * Keo du lieu tu n8n data tables sang Supabase.
 *
 *   npm i @supabase/supabase-js
 *   export N8N_URL=https://your-n8n-host
 *   export N8N_API_KEY=...            # Settings > n8n API
 *   export SUPABASE_URL=...
 *   export SUPABASE_SERVICE_KEY=...   # service role, chi chay o may Bim
 *   node migrate-from-n8n.mjs --dry
 *
 * Chay --dry truoc de xem se ghi gi. Bo --dry moi ghi that.
 * Script chay lai duoc nhieu lan: brand khop theo name_key, khong tao trung.
 */

import { createClient } from '@supabase/supabase-js';

const DRY = process.argv.includes('--dry');
const { N8N_URL, N8N_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;

for (const [k, v] of Object.entries({ N8N_URL, N8N_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY })) {
  if (!v) { console.error(`Thieu bien moi truong ${k}`); process.exit(1); }
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// Id lay tu instance hien tai. Doi neu Bim tao lai bang o cho khac.
const TABLES = {
  brand_stage:    'Coy8VtZ1qpsDgei1',
  brand_note:     'GmMMOO0fdDJYYYkJ',
  brand_category: 'x4C15Jcx9Uce4Ct3',
  brand_folder:   'eUF5ApOU5BscL8pT',
  app_settings:   'Tx5Iq85LngKrBbz4'
};

// Cung mot cach chuan hoa nhu ben n8n dung, de brand cu khop dung brand moi.
function nameKey(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd').replace(/\u0110/g, 'd')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

const STAGE_MAP = {
  'first meeting': 'first_meeting',
  'internal review': 'internal_review',
  'bp pitch': 'bp_pitch',
  'negotiating': 'negotiating',
  'live': 'live'
};

async function fetchRows(id) {
  const rows = [];
  let skip = 0;
  for (;;) {
    const url = `${N8N_URL}/api/v1/data-tables/${id}/rows?limit=100&skip=${skip}`;
    const res = await fetch(url, { headers: { 'X-N8N-API-KEY': N8N_API_KEY } });
    if (!res.ok) throw new Error(`${id} -> HTTP ${res.status} ${await res.text()}`);
    const body = await res.json();
    const batch = body.data ?? body ?? [];
    rows.push(...batch);
    if (batch.length < 100) break;
    skip += 100;
  }
  return rows;
}

async function main() {
  console.log(DRY ? '=== DRY RUN, khong ghi gi ===\n' : '=== GHI THAT ===\n');

  const src = {};
  for (const [name, id] of Object.entries(TABLES)) {
    src[name] = await fetchRows(id);
    console.log(`${name.padEnd(16)} ${src[name].length} dong`);
  }

  const { data: cats, error: catErr } = await db.from('category').select('id,name');
  if (catErr) throw catErr;
  const catByName = new Map(cats.map(c => [nameKey(c.name), c.id]));

  // Gom tat ca brand xuat hien o bat ky bang nao thanh mot danh sach duy nhat.
  const brands = new Map();
  const touch = (row) => {
    const key = row.brand_key || nameKey(row.brand);
    if (!key) return null;
    if (!brands.has(key)) {
      brands.set(key, { name_key: key, name: row.brand || key, tier: 1 });
    }
    return brands.get(key);
  };

  for (const r of src.brand_category) {
    const b = touch(r);
    if (!b) continue;
    const id = catByName.get(nameKey(r.category));
    if (id) b.category_id = id;
    else if (r.category) console.warn(`  ! category la "${r.category}" khong co trong bang category`);
  }
  for (const r of src.brand_stage) {
    const b = touch(r);
    if (!b) continue;
    const s = STAGE_MAP[nameKey(r.stage)];
    if (s) { b.stage = s; b.stage_changed_at = r.updated_at || null; }
    else if (r.stage) console.warn(`  ! stage la "${r.stage}" khong map duoc`);
  }
  for (const r of src.brand_folder) {
    const b = touch(r);
    if (!b) continue;
    b.drive_folder_id = r.folder_id || null;
    b.drive_folder_link = r.folder_link || null;
  }
  for (const r of src.brand_note) touch(r);

  const list = [...brands.values()];
  const noCat = list.filter(b => !b.category_id);
  console.log(`\nbrand gop lai: ${list.length}`);
  if (noCat.length) {
    console.log(`chua co category: ${noCat.length} -> chi admin thay cho toi khi gan`);
    console.log('  ' + noCat.slice(0, 12).map(b => b.name).join(', ')
      + (noCat.length > 12 ? ` ... va ${noCat.length - 12} brand nua` : ''));
  }

  if (DRY) {
    console.log(`\nnote se chen: ${src.brand_note.filter(r => r.note?.trim()).length}`);
    console.log(`app_settings se chen: ${src.app_settings.length}`);
    console.log('\nChay lai khong co --dry de ghi that.');
    return;
  }

  const { data: saved, error: bErr } = await db
    .from('brand')
    .upsert(list, { onConflict: 'name_key' })
    .select('id,name_key');
  if (bErr) throw bErr;
  console.log(`\nbrand da ghi: ${saved.length}`);

  const idByKey = new Map(saved.map(b => [b.name_key, b.id]));

  // Ben n8n moi brand chi co dung mot note. Ben nay note la nhieu dong noi tiep,
  // nen note cu vao lam dong dau tien.
  const notes = src.brand_note
    .filter(r => String(r.note ?? '').trim())
    .map(r => ({
      brand_id: idByKey.get(r.brand_key || nameKey(r.brand)),
      body: r.note.trim(),
      created_at: r.updated_at || new Date().toISOString()
    }))
    .filter(n => n.brand_id);

  if (notes.length) {
    const { error } = await db.from('brand_note').insert(notes);
    if (error) throw error;
    console.log(`note da ghi: ${notes.length}`);
  }

  console.log('\nXong.');
  console.log('Con lai phai lam tay:');
  console.log('  - Sheet tracking (Ten brand / PIC / Job Title / ...) -> bang contact');
  console.log('  - Tao tai khoan cho tung PIC, gan category trong admin panel');
  console.log('  - Dat han muc credit thang dau cho tung category');
}

main().catch(e => { console.error('\nHong:', e.message); process.exit(1); });
