// Chay mot file .sql len Supabase tu terminal.
//
//   $env:SUPABASE_PAT = "sbp_..."          # lay o Account > Access Tokens
//   node chay-sql.mjs socom_kenh_rieng.sql
//
// Vi sao can file nay. Du an khong co psql, khong co connection string
// Postgres trong .env, va Supabase CLI khong co lenh chay SQL tuy y
// (`supabase db` chi co diff/dump/push/pull/reset, va push thi doi mot thu
// muc migrations ma du an co y khong dung - xem dau can_use_category.sql).
// Con service role key thi di qua PostgREST, tuc CRUD tung bang chu khong
// chay duoc `create table`, `alter policy` hay transaction.
//
// Management API thi chay duoc. No doi PERSONAL ACCESS TOKEN rieng, khong
// phai service role key - va do la dieu tot: token nay do nguoi chay tu tao,
// tu dat vao moi truong, va khong nam trong .env.local cua app.
//
// AN TOAN:
//   - In ra SQL sap chay va BAT NGUOI GO LAI ten file de xac nhan. Khong co
//     che do chay thang, vi mot lan dan nham file vao DB that la khong lui
//     duoc.
//   - Khong bao gio in token ra man hinh hay ghi no vao dau.
//   - Gui NGUYEN file trong mot lan goi, de `begin;/commit;` trong file giu
//     dung nghia. Cat nho ra thanh tung cau se pha transaction.

import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv, env, exit } from 'node:process';

const API = 'https://api.supabase.com/v1';

const tenFile = argv[2];
if (!tenFile) {
  console.error('Thieu ten file.  Vi du:  node chay-sql.mjs socom_kenh_rieng.sql');
  exit(1);
}

/**
 * Doc mot bien tu .env.local.
 *
 * Co mat vi dan token vao prompt cua terminal hay khong an - Ctrl+V bi nuot
 * trong nhieu terminal, va Read-Host thi khong echo nen khong biet da dan
 * duoc chua. Dan vao file bang editor thi luon duoc.
 *
 * .env.local da nam trong .gitignore (`.env*`) va da la cho giu bi mat cua du
 * an, nen khong mo them duong ro ri nao.
 */
function docEnvLocal(ten) {
  try {
    for (const dong of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
      if (!dong.startsWith(`${ten}=`)) continue;
      return dong.slice(ten.length + 1).trim().replace(/^["']|["']$/g, '');
    }
  } catch { /* khong co file thi thoi */ }
  return '';
}

// Bien moi truong thang duoc uu tien: no de doi hon khi can chay mot lan voi
// token khac.
const pat = (env.SUPABASE_PAT ?? '').trim() || docEnvLocal('SUPABASE_PAT');
if (!pat) {
  console.error('Chua co SUPABASE_PAT. Chon mot trong hai cach:');
  console.error('');
  console.error('  A. Mo .env.local bang editor, them mot dong:');
  console.error('       SUPABASE_PAT=sbp_...');
  console.error('     (.env.local da duoc gitignore, khong len repo)');
  console.error('');
  console.error('  B. PowerShell:  $env:SUPABASE_PAT = "sbp_..."');
  console.error('');
  console.error('  Token lay o https://supabase.com/dashboard/account/tokens');
  exit(1);
}

// Project ref doc tu NEXT_PUBLIC_SUPABASE_URL trong .env.local. Ref nam trong
// URL cong khai nen khong phai bi mat; doc tu day de khong ai phai go tay va
// go nham sang project khac.
let ref = (env.SUPABASE_PROJECT_REF ?? '').trim();
if (!ref) {
  try {
    const dong = readFileSync('.env.local', 'utf8').split(/\r?\n/)
      .find((l) => l.startsWith('NEXT_PUBLIC_SUPABASE_URL='));
    ref = (dong ?? '').split('=')[1]?.trim().match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? '';
  } catch { /* khong doc duoc thi hoi ben duoi */ }
}
if (!ref) {
  console.error('Khong tim ra project ref. Dat tay:  $env:SUPABASE_PROJECT_REF = "..."');
  exit(1);
}

const sql = readFileSync(tenFile, 'utf8');

console.log('');
console.log(`  File    : ${tenFile}`);
console.log(`  Project : ${ref}`);
console.log(`  Do dai  : ${sql.length} ky tu, ${sql.split(/\r?\n/).length} dong`);
console.log('');
console.log('  Day la DATABASE THAT. Khong co nut hoan tac.');
console.log('');

const rl = createInterface({ input: stdin, output: stdout });
const traLoi = (await rl.question(`  Go lai dung ten file de chay (${tenFile}): `)).trim();
rl.close();

if (traLoi !== tenFile) {
  console.log('\n  Khong khop. Khong chay gi ca.\n');
  exit(1);
}

console.log('\n  Dang chay...\n');

const res = await fetch(`${API}/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});

const body = await res.text();

if (!res.ok) {
  console.error(`  LOI ${res.status}`);
  // Loi cua Postgres nam trong body. In nguyen van - cat bot la giau mat dong
  // thuc su hong.
  console.error(`  ${body}\n`);
  exit(1);
}

console.log('  Xong.\n');
try {
  const j = JSON.parse(body);
  console.log(JSON.stringify(j, null, 2).slice(0, 4000));
} catch {
  console.log(body.slice(0, 4000));
}
console.log('');
