import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { supabaseServer } from '@/lib/supabase/server';
import { originLabel } from '@/lib/contactOrigin';

// exceljs can Node, khong chay duoc tren edge runtime.
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Xuat danh ba lien he ra file Excel that, mot dong moi nguoi.
 *
 * VI SAO KHONG CON LA CSV. Excel doc file CSV theo kieu doan kieu du lieu, va
 * no doan sai dung nhung o quan trong nhat:
 *   0355832588   -> mat so 0 dau, thanh 355832588
 *   84983579285  -> qua 11 chu so, thanh 8.49836E+10
 *   +63 917 626  -> co khi thanh cong thuc
 * So dien thoai hong la ca dong contact do vo dung. Khong co cach nao ep kieu
 * trong CSV cho moi phien ban Excel, nhung file .xlsx thi ghi thang duoc dinh
 * dang van ban vao tung o, va no dung o moi may.
 *
 * Tien the to mau theo cap bac, vi thu sep nhin dau tien la ai to nhat trong
 * danh sach nay.
 */

const TEAL  = 'FF0C3D47';
const RED   = 'FFD43A38';
const AMBER = 'FFB9791F';
const NHAT  = 'FFF1F4F4';

const STATUS: Record<string, string> = {
  in_progress: 'In progress', waiting_brand: 'Waiting for brand',
  stuck: 'Stuck', won: 'Won', lost: 'Lost',
};
const STAGE: Record<string, string> = {
  first_meeting: 'First meeting', internal_review: 'Internal review',
  bp_pitch: 'BP pitch', negotiating: 'Negotiating', live: 'Live',
};

/** Cung nguong voi TIERS ben BrandView, doi mot ben ma quen ben kia thi lech. */
function bac(r: number | null) {
  if (r == null) return { ten: '', hang: 9 };
  if (r <= 20) return { ten: 'Executive', hang: 1 };
  if (r <= 38) return { ten: 'Head / Director', hang: 2 };
  if (r <= 50) return { ten: 'Manager', hang: 3 };
  return { ten: 'Team', hang: 4 };
}

export async function POST(req: NextRequest) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return new Response('Not signed in.', { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.brandIds) ? body.brandIds.map(String) : [];
  if (!ids.length) return new Response('No brands were given.', { status: 400 });

  // RLS van ap dung o ca hai truy van: PIC chi xuat duoc category cua minh.
  const LO = 100;
  const brands: any[] = [];
  const contacts: any[] = [];
  for (let i = 0; i < ids.length; i += LO) {
    const lo = ids.slice(i, i + LO);
    const [{ data: b, error: eb }, { data: c, error: ec }] = await Promise.all([
      // Khoa cua view brand_progress la `id`, KHONG phai `brand_id`. Loc nham
      // ten cot thi PostgREST tra ve loi, data thanh null, va file xuat ra chi
      // co dong tieu de. Da dinh dung mot lan.
      db.from('brand_progress').select('*').in('id', lo),
      db.from('contact')
        .select('brand_id, full_name, job_title, email, phone, linkedin_url, location, org_rank, source')
        .in('brand_id', lo),
    ]);
    // Hong thi PHAI bao. File rong ma van tai ve binh thuong la kieu hong te
    // nhat: nguoi dung tuong trong he thong khong co du lieu.
    if (eb) return new Response(`Could not read the brands: ${eb.message}`, { status: 500 });
    if (ec) return new Response(`Could not read the contacts: ${ec.message}`, { status: 500 });
    brands.push(...(b ?? []));
    contacts.push(...(c ?? []));
  }

  if (!brands.length) {
    return new Response(
      'None of those brands came back. They may belong to a category you do not cover.',
      { status: 404 },
    );
  }

  const theoBrand = new Map<string, any[]>();
  for (const c of contacts) {
    if (!theoBrand.has(c.brand_id)) theoBrand.set(c.brand_id, []);
    theoBrand.get(c.brand_id)!.push(c);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'BD Lead Hub';
  wb.created = new Date();
  const ws = wb.addWorksheet('Contacts', { properties: { tabColor: { argb: TEAL } } });

  const cot = [
    { h: 'Brand', w: 22 }, { h: 'Tier', w: 6 }, { h: 'Category', w: 15 },
    { h: 'Stage', w: 15 }, { h: 'Status', w: 15 }, { h: 'Owner', w: 14 },
    { h: 'Last update', w: 12 }, { h: 'Days since update', w: 17 },
    { h: 'Contact', w: 24 }, { h: 'Job title', w: 30 }, { h: 'Level', w: 15 },
    { h: 'Email', w: 30 }, { h: 'Phone', w: 18 }, { h: 'LinkedIn', w: 34 },
    { h: 'Location', w: 24 }, { h: 'Origin', w: 16 },
  ];
  ws.addRow(cot.map((c) => c.h));

  const hr = ws.getRow(1);
  hr.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  hr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
  hr.alignment = { vertical: 'middle' };
  hr.height = 22;
  cot.forEach((c, i) => { ws.getColumn(i + 1).width = c.w; });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cot.length } };

  // Cot dien thoai: dinh dang VAN BAN cho CA COT. Day la ca ly do doi sang xlsx.
  ws.getColumn(13).numFmt = '@';
  ws.getColumn(13).alignment = { horizontal: 'left' };

  const thuTu = new Map(ids.map((id, i) => [id, i]));
  brands.sort((a, b) => (thuTu.get(a.id) ?? 0) - (thuTu.get(b.id) ?? 0));

  let soDong = 0;
  for (const b of brands) {
    const nen = [
      b.brand, b.tier ?? '', b.category ?? '',
      b.stage ? (STAGE[b.stage] ?? b.stage) : '',
      b.status ? (STATUS[b.status] ?? b.status) : '',
      b.owner_name ?? '',
      b.last_update_at ? String(b.last_update_at).slice(0, 10) : '',
      b.days_since_update ?? '',
    ];

    const ds = (theoBrand.get(b.id) ?? [])
      .sort((x, y) => bac(x.org_rank).hang - bac(y.org_rank).hang);

    // Brand chua co ai VAN duoc mot dong. Bo di la mat luon thong tin "cai nay
    // chua tim duoc ai", ma do moi la thu can lam tiep.
    const dsDong = ds.length ? ds : [null];

    for (const c of dsDong) {
      const bc = bac(c?.org_rank ?? null);
      const r = ws.addRow([
        ...nen,
        c?.full_name ?? '', c?.job_title ?? '', bc.ten,
        c?.email ?? '',
        // Ghi thang chuoi, khong de ExcelJS doan.
        c?.phone ? String(c.phone) : '',
        c?.linkedin_url ?? '', c?.location ?? '', c ? originLabel(c.source) : '',
      ]);
      soDong += 1;

      r.getCell(13).numFmt = '@';

      if (!c) {
        // Dong trong: lam mo di de mat luot qua nhanh, nhung van doc duoc.
        r.getCell(9).value = 'no contact yet';
        r.getCell(9).font = { italic: true, color: { argb: 'FF6F878B' } };
      } else if (bc.hang === 1) {
        // Cap cao nhat: to ca dong. Day la thu sep tim dau tien.
        r.font = { bold: true, color: { argb: TEAL } };
        r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NHAT } };
      } else if (bc.hang === 2) {
        r.getCell(11).font = { bold: true, color: { argb: AMBER } };
      }

      // Khong co ca email lan dien thoai thi reveal xong cung khong lien he
      // duoc. To do o cot Email de nhin ra ngay.
      if (c && !c.email && !c.phone) {
        r.getCell(12).value = 'no email or phone';
        r.getCell(12).font = { italic: true, color: { argb: RED } };
      }
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const ten = `bd-lead-hub-contacts-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(buf as any, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${ten}"`,
      'Content-Length': String((buf as ArrayBuffer).byteLength),
      'X-Row-Count': String(soDong),
    },
  });
}
