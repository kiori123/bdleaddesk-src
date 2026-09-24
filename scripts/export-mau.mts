/**
 * Xuat mot file mau CUA CHINH /api/export, de xem truoc khi deploy.
 *
 * Chay:
 *   npx tsx scripts/export-mau.mts
 *   npx tsx scripts/export-mau.mts duong-dan-khac.xlsx
 *
 * Vi sao co script nay: bo cuc sheet "Credit & Contacts" da hong hai lan lien
 * tiep tren ban that, va ca hai lan deu lot qua vi khong ai mo duoc file truoc
 * khi deploy. Gio mo duoc.
 *
 * Script goi DUNG ham ma route goi (dungWorkbookXuat o lib/exportWorkbook.ts),
 * khong phai mot ban sao - neu no la ban sao thi file mau khong con la bang
 * chung ve file that.
 *
 * KHAC BIET DUY NHAT so voi file PIC tai ve: client o day la service-role nen
 * doc het moi category (bo qua RLS), trong khi PIC chi thay category cua minh.
 * Nghia la file mau la ban DAY DU NHAT - dung de kiem bo cuc va cong thuc, con
 * chuyen ai thay gi thi do RLS quyet dinh o route.
 *
 * Chi DOC database. Khong ghi gi ca.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { dungWorkbookXuat, LoiXuat } from '../lib/exportWorkbook';

function docEnvLocal() {
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) {
    throw new Error('Khong thay .env.local o thu muc dang chay. Chay script tu goc repo.');
  }
  for (const dong of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    if (!dong.includes('=') || dong.trim().startsWith('#')) continue;
    const i = dong.indexOf('=');
    const k = dong.slice(0, i).trim();
    const v = dong.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
}

docEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Thieu NEXT_PUBLIC_SUPABASE_URL hoac SUPABASE_SERVICE_ROLE_KEY trong .env.local');

const db = createClient(url, key, { auth: { persistSession: false } });

const ra = process.argv[2]
  ?? path.join(process.cwd(), `export-mau-${new Date().toISOString().slice(0, 10)}.xlsx`);

try {
  // Khong bo loc nao: giong het khi PIC bam Export ma khong chon gi tren panel.
  const wb = await dungWorkbookXuat(db as any, {
    category: null, owner: null, status: null, from: null, to: null,
  });

  await wb.xlsx.writeFile(ra);

  console.log(`\nDa xuat: ${ra}`);
  console.log(`Kich thuoc: ${(fs.statSync(ra).size / 1024).toFixed(1)} KB\n`);
  for (const ws of wb.worksheets) {
    const anh = (ws as any).getImages?.().length ?? 0;
    console.log(
      `  ${ws.name.padEnd(20)} ${String(ws.rowCount).padStart(5)} dong`
      + `  ${String(ws.columnCount).padStart(3)} cot`
      + (anh ? `  ${anh} ANH (khong nen co - xem lib/categoryPalette.ts)` : ''),
    );
  }
  console.log('');
} catch (e) {
  if (e instanceof LoiXuat) {
    console.error(`\nRoute se tra ve ${e.status}: ${e.message}\n`);
    process.exit(1);
  }
  throw e;
}
