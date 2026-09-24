import { NextResponse, type NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { supabaseServer } from '@/lib/supabase/server';

// exceljs can Node, khong chay duoc tren edge runtime.
export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Doc file danh sach brand roi tra ve ten, KHONG quet gi ca.
 *
 * Thay cho hai node "Parse Brand List" va "Map Uploaded Columns" ben n8n cu.
 *
 * Vi sao chi tra ten ve chu khong quet luon: PIC phai nhin thay app doc duoc gi
 * truoc khi tieu luot. File Excel that thuong co dong tieu de, dong tong, o gop,
 * cot ghi chu. Doc nham mot cot la quet 40 cai ten vo nghia va het tran ngay.
 * Do ra o nhap thi ho sua duoc.
 */

const TRAN_DONG = 500;
const TRAN_BYTE = 5 * 1024 * 1024;

// Tieu de cot co the la tieng Anh hoac tieng Viet, co dau hoac khong.
const TU_KHOA_CO_T = ['brand', 'ten', 'name', 'company', 'thuong hieu', 'nhan hang', 'cong ty'];

function bo_dau(s: string) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .toLowerCase().trim();
}

/** Dong nay co phai tieu de khong. */
function laTieuDe(o: string[]) {
  return o.some((c) => TU_KHOA_CO_T.some((k) => bo_dau(c).includes(k)));
}

/**
 * Chon cot chua ten brand.
 *
 * Uu tien cot co tieu de nhac den brand. Khong co tieu de thi lay cot dau tien
 * co nhieu o chu nhat: file xuat tu he thong khac thuong co cot so thu tu o dau,
 * lay bua cot dau la duoc mot danh sach 1,2,3.
 */
function chonCot(hang: string[][]): number {
  const dau = hang[0] ?? [];
  if (laTieuDe(dau)) {
    const i = dau.findIndex((c) => TU_KHOA_CO_T.some((k) => bo_dau(c).includes(k)));
    if (i >= 0) return i;
  }

  const soCot = Math.max(...hang.map((h) => h.length), 1);
  let tot = 0; let diemTot = -1;
  for (let c = 0; c < soCot; c++) {
    let diem = 0;
    for (const h of hang) {
      const v = String(h[c] ?? '').trim();
      // Co chu cai va khong phai thuan so.
      if (v && /\p{L}/u.test(v) && !/^\d+([.,]\d+)?$/.test(v)) diem++;
    }
    if (diem > diemTot) { diemTot = diem; tot = c; }
  }
  return tot;
}

function locTen(hang: string[][], cot: number) {
  const batDau = laTieuDe(hang[0] ?? []) ? 1 : 0;
  const thay = new Set<string>();
  const ra: string[] = [];

  for (let i = batDau; i < hang.length; i++) {
    let v = String(hang[i]?.[cot] ?? '').trim();
    if (!v) continue;
    // Bo cac dong tong ket hay ghi chu cuoi bang.
    if (/^(total|tong|sum|grand total)\b/i.test(bo_dau(v))) continue;
    // Cat duoi dang "(T)" hoac "(T1)" theo quy uoc cua sheet hunting.
    v = v.replace(/\s*\((?:T\d*)\)\s*$/i, '').trim();
    if (!v || v.length > 120) continue;

    const k = bo_dau(v);
    if (thay.has(k)) continue;
    thay.add(k);
    ra.push(v);
    if (ra.length >= TRAN_DONG) break;
  }
  return ra;
}

export async function POST(req: NextRequest) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file was uploaded.' }, { status: 400 });
  }
  if (file.size > TRAN_BYTE) {
    return NextResponse.json(
      { error: 'That file is over 5MB. Save just the brand column to a new file and upload that.' },
      { status: 413 });
  }

  const ten = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  let hang: string[][] = [];

  try {
    if (ten.endsWith('.csv') || ten.endsWith('.tsv') || ten.endsWith('.txt')) {
      const text = buf.toString('utf8');
      // Tach cot theo dau phay, tab hoac cham phay. KHONG xu ly dau ngoac kep
      // long nhau: danh sach ten brand hiem khi co dau phay trong ten, va doan
      // CSV day du o day la them mot dong loi khong dang.
      hang = text.split(/\r?\n/).filter((d) => d.trim())
        .map((d) => d.split(/[,;\t]/).map((c) => c.replace(/^"|"$/g, '').trim()));
    } else {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as any);
      const ws = wb.worksheets[0];
      if (!ws) throw new Error('file khong co sheet nao');

      ws.eachRow({ includeEmpty: false }, (row) => {
        if (hang.length >= TRAN_DONG + 50) return;
        const o: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          const v = cell.value as any;
          // O cong thuc tra ve object, lay ket qua chu khong lay cong thuc.
          const t = v && typeof v === 'object' && 'result' in v ? v.result
            : v && typeof v === 'object' && 'text' in v ? v.text
              : v;
          o.push(t == null ? '' : String(t));
        });
        hang.push(o);
      });
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: `Could not read that file. ${String(e?.message ?? '')}`.trim()
        + ' Try saving it as .csv and uploading again.' },
      { status: 400 });
  }

  if (!hang.length) {
    return NextResponse.json({ error: 'That file has no rows in it.' }, { status: 400 });
  }

  const cot = chonCot(hang);
  const names = locTen(hang, cot);

  if (!names.length) {
    return NextResponse.json(
      { error: 'No brand names were found in that file. Put the names in the first column, or give that column a header with the word "brand" in it.' },
      { status: 400 });
  }

  return NextResponse.json({
    names,
    // Noi ro da doc cot nao. Doc nham cot la loi de xay ra nhat o buoc nay, va
    // PIC chi phat hien duoc neu app noi ra.
    column: String(hang[0]?.[cot] ?? `column ${cot + 1}`).trim() || `column ${cot + 1}`,
    rows: hang.length,
  });
}
