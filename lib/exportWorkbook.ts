import ExcelJS from 'exceljs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isAppGenerated, isByCredit, ORIGIN_LABEL } from '@/lib/contactOrigin';
import { khopVung } from '@/lib/rank';
import { TEAL, RED, AMBER, GREY } from '@/lib/categoryPalette';
import {
  veSheetCreditContacts, type CatRow, type ViTriRow, type BrandRong,
} from '@/lib/creditSheet';

/**
 * Dung toan bo workbook cua /api/export.
 *
 * Tach ra khoi route de CHINH ma nay dung duoc o hai cho: route (client
 * Supabase co phien dang nhap, RLS ap dung) va mot script chay tay de xuat file
 * mau cho PIC xem TRUOC khi deploy. Neu script tu dung lai mot ban sao thi file
 * mau khong con la bang chung ve file that - dung cai bay ma lib/nameKey.ts va
 * lib/regions.ts deu da bi cat mot lan.
 *
 * Ham nay khong biet gi ve HTTP: loi di ra bang LoiXuat, route tu doi thanh
 * Response.
 */

/** Loi co ma HTTP kem theo, de route dich lai thanh Response dung ma. */
export class LoiXuat extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'LoiXuat';
  }
}

/** Bo loc tren ExportPanel. null nghia la khong loc theo truong do. */
export type LocXuat = {
  category: string | null;
  owner: string | null;
  status: string | null;
  /** YYYY-MM-DD, theo last_update_at. */
  from: string | null;
  to: string | null;
};

// Ngay ca voi 60s, mot to chuc qua lon van co the vuot. MAX_HANG_XUAT chan
// TRUOC khi dung workbook: bao loi ro rang (413), khong de Vercel tu giet
// ngang giua chung roi tra ve mot loi timeout chung chung, kho hieu cho PIC.
const MAX_HANG_XUAT = 2000;

const STATUS: Record<string, string> = {
  in_progress: 'In progress', waiting_brand: 'Waiting for brand',
  stuck: 'Stuck', won: 'Won', lost: 'Lost',
};
const REASON: Record<string, string> = {
  no_response: 'No response', waiting_bdm: 'Waiting for BDM',
  waiting_brand: 'Waiting for brand', contact_not_relevant: 'Contact not relevant',
  need_more_info: 'Need more information', negotiation: 'Negotiation',
  internal_approval: 'Internal approval', other: 'Other',
};
const STAGE: Record<string, string> = {
  first_meeting: 'First meeting', internal_review: 'Internal review',
  bp_pitch: 'BP pitch', negotiating: 'Negotiating', live: 'Live',
};

/** Tieu de dam, nen dam, khoa het cac dong tren no de cuon van thay ten cot. */
function header(ws: ExcelJS.Worksheet, widths: number[], atRow = 1) {
  const row = ws.getRow(atRow);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
  row.alignment = { vertical: 'middle' };
  row.height = 22;
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: atRow }];
  ws.autoFilter = { from: { row: atRow, column: 1 }, to: { row: atRow, column: widths.length } };
}

function paint(cell: ExcelJS.Cell, argb: string) {
  cell.font = { color: { argb }, bold: true };
}

/**
 * `db` nhan bat ky client Supabase nao. Route truyen client co phien dang nhap
 * (RLS ap dung: PIC chi xuat duoc category cua ho, admin duoc het). Script xuat
 * file mau truyen client service-role, tuc DOC het - hop ly cho mot file mau de
 * admin kiem bo cuc, nhung KHONG duoc dung no de phuc vu nguoi dung.
 */
export async function dungWorkbookXuat(
  db: SupabaseClient<any, any, any>,
  loc: LocXuat,
): Promise<ExcelJS.Workbook> {
  const { category: fCat, owner: fOwner, status: fStatus, from: fFrom, to: fTo } = loc;

  // RLS van ap dung: PIC export ra chi co category cua ho, admin duoc het.
  //
  // Cung mot bo loc dung hai lan: dem truoc (head:true, khong keo du lieu) de
  // chan neu qua lon, roi lan nay moi lay that.
  // any: chi la filter builder cua Supabase di qua nhieu .eq()/.gte() tuy dieu
  // kien, khong can giu kieu chinh xac qua ham nay - cac cho dung ket qua da
  // ep kieu rieng (xem "as any[]" ben duoi).
  function locBrandProgress(q: any) {
    if (fCat)    q = q.eq('category_id', fCat);
    if (fOwner)  q = q.eq('owner_id', fOwner);
    if (fStatus) q = q.eq('status', fStatus);
    if (fFrom)   q = q.gte('last_update_at', fFrom);
    if (fTo)     q = q.lte('last_update_at', `${fTo}T23:59:59`);
    return q;
  }

  const { count } = await locBrandProgress(
    db.from('brand_progress').select('*', { count: 'exact', head: true }),
  );
  if ((count ?? 0) > MAX_HANG_XUAT) {
    throw new LoiXuat(
      `This filter matches ${count} brands, too many for one export (limit ${MAX_HANG_XUAT}). `
      + 'Narrow it by category, owner, status or date range and try again.',
      413,
    );
  }

  // Timeline khong loc theo status: loc "stuck only" roi chi lay dong stuck
  // thi mat het boi canh, khong con thay no tac o buoc nao.
  let tl = db.from('case_timeline').select('*');
  if (fCat)   tl = tl.eq('category_id', fCat);

  const [{ data: rows }, { data: health }, { data: timeline }] = await Promise.all([
    locBrandProgress(db.from('brand_progress').select('*')).order('category').order('brand'),
    db.from('category_health').select('*'),
    tl,
  ]);

  /**
   * Contacts / Full contacts / Found by the app / Added by hand PHAI cong dung
   * nhau cho tung brand, khong duoc lay tu hai nguon khac nhau (mot cot doc
   * brand_progress, hai cot kia tu tinh) roi hy vong chung khop - lech mot cho
   * la bao cao sai ma khong ai biet. Nen ca bon so o day deu tinh tu CUNG mot
   * lan doc bang contact, thay vi tin vao contacts/contacts_full san co trong
   * brand_progress.
   */
  const brandIds = [...new Set((rows ?? []).map((b: any) => b.id).filter(Boolean))];
  const origin = new Map<string, { total: number; full: number; app: number; manual: number }>();
  const LO = 100;
  for (let i = 0; i < brandIds.length; i += LO) {
    const lo = brandIds.slice(i, i + LO);
    const { data: cs, error: ecs } = await db
      .from('contact').select('brand_id, source, email, phone, linkedin_url').in('brand_id', lo);
    if (ecs) throw new LoiXuat(`Could not read the contacts: ${ecs.message}`, 500);
    for (const c of (cs ?? []) as any[]) {
      const g = origin.get(c.brand_id) ?? { total: 0, full: 0, app: 0, manual: 0 };
      g.total++;
      if (c.email && c.phone) g.full++;
      if (isAppGenerated(c.source)) g.app++; else g.manual++;
      origin.set(c.brand_id, g);
    }
  }
  const originOf = (brandId: string) => origin.get(brandId) ?? { total: 0, full: 0, app: 0, manual: 0 };

  const wb = new ExcelJS.Workbook();
  wb.creator = 'OnPoint Lead Desk';
  wb.created = new Date();

  // ---------- Sheet 1: Summary ----------
  // Day la sheet mot C-level mo dau tien. Hai thu ho can thay ngay ma truoc
  // day KHONG co: (1) Won/Lost - category_health view co san hai cot nay
  // nhung export chua bao gio doc, nen ket qua thang/thua that su khong nam
  // o dau trong file ca; (2) sap xep worst-first - ExportPanel.tsx da noi
  // "worst first" nhung code chi lay nguyen thu tu DB (alphabet).
  const s1 = wb.addWorksheet('Summary', { properties: { tabColor: { argb: TEAL } } });

  const VERDICT_RANK: Record<string, number> = {
    Blocked: 0, 'Not started': 1, 'Going stale': 2, 'Follow-up overdue': 2, Healthy: 3,
  };
  const sortedHealth = [...(health ?? [])]
    .sort((a: any, b: any) => (VERDICT_RANK[a.verdict] ?? 1.5) - (VERDICT_RANK[b.verdict] ?? 1.5));

  const sumWon    = sortedHealth.reduce((s, h: any) => s + (h.won ?? 0), 0);
  const sumLost   = sortedHealth.reduce((s, h: any) => s + (h.lost ?? 0), 0);
  const sumActive = sortedHealth.reduce((s, h: any) => s + (h.active_cases ?? 0), 0);
  const sumNoOwner= sortedHealth.reduce((s, h: any) => s + (h.unassigned ?? 0), 0);
  const notStarted = sortedHealth.filter((h: any) => h.verdict === 'Not started' || h.verdict === 'Blocked').length;

  const headline: string[] = [`${sumWon} won, ${sumLost} lost, ${sumActive} active in the pipeline.`];
  if (sumActive > 0 && sumNoOwner > 0) {
    headline.push(`${sumNoOwner} of ${sumActive} active brands (${Math.round((sumNoOwner / sumActive) * 100)}%) have no owner yet.`);
  }
  if (notStarted > 0) {
    headline.push(`${notStarted} of ${sortedHealth.length} categories haven't started.`);
  }
  s1.mergeCells('A1:O1');
  s1.getCell('A1').value = headline.join('  ·  ');
  s1.getCell('A1').font = { bold: true, size: 11.5, color: { argb: TEAL } };
  s1.getRow(1).height = 20;
  s1.addRow([]);

  s1.addRow(['Category', 'Verdict', 'Won', 'Lost', 'Active', 'Never updated', 'In progress',
             'Waiting', 'Stuck', 'Top stuck reason', 'No update 7d+',
             'Overdue follow-up', 'No owner', 'Avg days in stage', 'Stuck brands']);
  header(s1, [18, 18, 8, 8, 9, 14, 12, 10, 8, 22, 14, 17, 10, 17, 40], 3);

  for (const h of sortedHealth) {
    const r = s1.addRow([
      h.category, h.verdict, h.won ?? 0, h.lost ?? 0, h.active_cases, h.never_updated, h.in_progress,
      h.waiting_brand, h.stuck,
      h.top_stuck_reason ? (REASON[h.top_stuck_reason] ?? h.top_stuck_reason) : '',
      h.no_update_7d, h.overdue_followup, h.unassigned,
      h.avg_days_in_stage ?? '', h.stuck_brands ?? '',
    ]);
    // Verdict la thu sep doc dau tien, to mau theo muc nghiem trong
    const v = r.getCell(2);
    if (h.verdict === 'Blocked' || h.verdict === 'Not started') paint(v, RED);
    else if (h.verdict === 'Going stale' || h.verdict === 'Follow-up overdue') paint(v, AMBER);
    else if (h.verdict === 'Healthy') paint(v, TEAL);
    if (h.won > 0) paint(r.getCell(3), TEAL);
    if (h.lost > 0) paint(r.getCell(4), RED);
    if (h.stuck > 0) paint(r.getCell(9), RED);
    if (h.never_updated > 0) paint(r.getCell(6), RED);
  }

  // ---------- Sheet 2: Pipeline ----------
  const s2 = wb.addWorksheet('Pipeline');
  s2.addRow(['Brand', 'Category', 'Owner', 'Stage', 'Status', 'Stuck reason',
             'Days in stage', 'Days since update', 'Last update', 'Next action',
             'Next follow-up', 'Overdue', 'Contacts', 'Full contacts',
             ORIGIN_LABEL.app, ORIGIN_LABEL.manual, 'Latest note']);
  header(s2, [22, 16, 14, 16, 16, 20, 13, 17, 12, 26, 14, 9, 10, 13, 15, 15, 46]);

  for (const b of rows ?? []) {
    const o = originOf(b.id);
    const r = s2.addRow([
      b.brand, b.category ?? '', b.owner_name ?? '',
      b.stage ? (STAGE[b.stage] ?? b.stage) : '',
      STATUS[b.status] ?? b.status,
      b.stuck_reason ? (REASON[b.stuck_reason] ?? b.stuck_reason) : '',
      b.days_in_stage ?? '', b.days_since_update ?? '',
      b.last_update_at ? String(b.last_update_at).slice(0, 10) : '',
      b.next_action ?? '', b.next_follow_up ?? '',
      b.follow_up_overdue ? 'YES' : '',
      // Ca bon cot nay tu origin (xem Promise.all o tren), khong con doc
      // contacts/contacts_full cua brand_progress nua - Found by the app +
      // Added by hand PHAI cong dung Contacts, khong the lech vi lay tu hai
      // nguon khac nhau.
      o.total, o.full, o.app, o.manual, b.last_note ?? '',
    ]);
    if (b.status === 'stuck') paint(r.getCell(5), RED);
    if ((b.days_since_update ?? 0) >= 7) paint(r.getCell(8), RED);
    else if ((b.days_since_update ?? 0) >= 3) paint(r.getCell(8), AMBER);
    if (b.follow_up_overdue) paint(r.getCell(12), RED);
    if (!b.owner_name) paint(r.getCell(3), AMBER);
  }

  // ---------- Sheet 3: Stuck cases ----------
  const s3 = wb.addWorksheet('Stuck cases', { properties: { tabColor: { argb: RED } } });
  s3.addRow(['Brand', 'Category', 'Owner', 'Stuck reason', 'Days in stage',
             'Days since update', 'Next action', 'Latest note']);
  header(s3, [22, 16, 14, 22, 13, 17, 28, 52]);

  const stuck = (rows ?? [])
    .filter((b: any) => b.status === 'stuck')
    .sort((a: any, b: any) => (b.days_in_stage ?? 0) - (a.days_in_stage ?? 0));

  if (stuck.length === 0) {
    const r = s3.addRow(['Nothing is stuck right now.']);
    r.getCell(1).font = { italic: true, color: { argb: 'FF6F878B' } };
  }
  for (const b of stuck) {
    const r = s3.addRow([
      b.brand, b.category ?? '', b.owner_name ?? '',
      b.stuck_reason ? (REASON[b.stuck_reason] ?? b.stuck_reason) : '',
      b.days_in_stage ?? '', b.days_since_update ?? '',
      b.next_action ?? '', b.last_note ?? '',
    ]);
    paint(r.getCell(4), RED);
  }

  // ---------- Sheet 4: Case history ----------
  const s4 = wb.addWorksheet('Case history');
  s4.addRow(['Brand', 'Category', 'Date', 'What happened', 'Detail',
             'Stuck reason', 'Note', 'By', 'Days until next', 'Current']);
  header(s4, [22, 15, 12, 26, 20, 20, 46, 14, 15, 9]);

  const feed = (timeline ?? []).slice().sort((a: any, b: any) =>
    String(a.brand).localeCompare(String(b.brand)) || String(a.at).localeCompare(String(b.at)));

  if (feed.length === 0) {
    const r = s4.addRow(['No history yet. It fills up as PICs update cases.']);
    r.getCell(1).font = { italic: true, color: { argb: 'FF6F878B' } };
  }

  let prevBrand = '';
  for (const e of feed as any[]) {
    // chi in ten brand o dong dau moi nhom, de mat doc theo cum
    const label = e.brand === prevBrand ? '' : e.brand;
    prevBrand = e.brand;

    const what = e.kind === 'stage'
      ? (e.from_val === 'start'
          ? `Entered ${STAGE[e.to_val] ?? e.to_val}`
          : e.from_val === e.to_val
            ? `Re-saved ${STAGE[e.to_val] ?? e.to_val}`
            : `${STAGE[e.from_val] ?? e.from_val} \u2192 ${STAGE[e.to_val] ?? e.to_val}`)
      : `Status set to ${STATUS[e.to_val] ?? e.to_val}`;

    const r = s4.addRow([
      label, label ? e.category : '',
      String(e.at).slice(0, 10),
      what,
      e.kind === 'stage' ? (STAGE[e.to_val] ?? e.to_val) : (STATUS[e.to_val] ?? e.to_val),
      e.reason ? (REASON[e.reason] ?? e.reason) : '',
      e.note ?? '', e.actor ?? '',
      e.days_until_next ?? '', e.is_current ? 'NOW' : '',
    ]);

    if (e.to_val === 'stuck') { paint(r.getCell(4), RED); paint(r.getCell(6), RED); }
    if (e.is_current) paint(r.getCell(10), TEAL);
    // dung mot buoc qua lau: day la cho tac that su
    if (e.kind === 'stage' && (e.days_until_next ?? 0) >= 14) paint(r.getCell(9), RED);
    else if (e.kind === 'stage' && (e.days_until_next ?? 0) >= 7) paint(r.getCell(9), AMBER);
    if (label) r.getCell(1).font = { bold: true };
  }

  // ---------- Sheet 5: Credit & Contacts ----------
  // Sheet nay CO CHU DICH khong theo cat/owner/status tren panel: no la buc
  // tranh toan cuc de so sanh cac category voi nhau, loc con mot category thi
  // bar chart mat het y nghia. Chi ap dung from/to (neu co) cho khoang thoi
  // gian tinh chi tieu, con brand/contact la trang thai hien tai.
  const s5 = wb.addWorksheet('Credit & Contacts', { properties: { tabColor: { argb: AMBER } } });

  const [{ data: categories, error: ecat }, { data: allBrands, error: ebr }, { data: ledger, error: eled }] =
    await Promise.all([
      db.from('category').select('id, name').eq('active', true).order('name'),
      db.from('brand').select('id, name, category_id'),
      (() => {
        let q = db.from('credit_ledger').select('category_id, amount').eq('status', 'committed');
        if (fFrom) q = q.gte('created_at', fFrom);
        if (fTo)   q = q.lte('created_at', `${fTo}T23:59:59`);
        return q;
      })(),
    ]);
  if (ecat) throw new LoiXuat(`Could not read the categories: ${ecat.message}`, 500);
  if (ebr)  throw new LoiXuat(`Could not read the brands: ${ebr.message}`, 500);
  if (eled) throw new LoiXuat(`Could not read the credit ledger: ${eled.message}`, 500);

  // Hinh dang phai KHOP CatRow cua lib/creditSheet.ts - do la giao keo duy nhat
  // giua phan doc du lieu (o day) va phan ve sheet.
  type CatAgg = CatRow;
  const catAgg = new Map<string, CatAgg>();
  for (const c of categories ?? []) {
    catAgg.set(c.id, {
      id: c.id, name: c.name, brands: 0, withContact: 0, noContact: 0,
      paid: 0, paidFull: 0, paidMailOnly: 0, paidPhoneOnly: 0, paidNeither: 0,
      paidNeitherWithLinkedin: 0, free: 0, spend: 0,
      paidVn: 0, paidVnEmpty: 0, paidNgoai: 0, paidNgoaiEmpty: 0,
    });
  }

  const brandCat = new Map<string, string>();
  // Ten brand, de phan tich nguyen nhan noi duoc DICH DANH brand nao dang ganh
  // het so reveal rong - con so theo category che mat dieu do.
  const brandName = new Map<string, string>();
  const catTheoBrandTen = new Map<string, string>();
  for (const b of (allBrands ?? []) as any[]) {
    if (b.name) brandName.set(b.id, String(b.name));
    if (b.name && b.category_id) {
      catTheoBrandTen.set(String(b.name), catAgg.get(b.category_id)?.name ?? '');
    }
    if (!b.category_id) continue; // brand chua gan category: fail-closed, khong tinh vao cate nao (xem schema.sql)
    brandCat.set(b.id, b.category_id);
    const agg = catAgg.get(b.category_id);
    if (agg) agg.brands += 1;
  }

  /**
   * PHAN TICH NGUYEN NHAN, thu ba duoc thu thap trong cung mot vong doc contact.
   *
   * Hai truc, vi mot con so theo category KHONG tra loi duoc cau "vi sao":
   *
   *   1. Theo NOI NGUOI DO NGOI. Day moi la nguyen nhan that, do duoc tren du
   *      lieu that: nguoi o Viet Nam co 30% reveal ve tay khong, nguoi ngoai
   *      Viet Nam la 65% - hon gap doi. Va 33 trong 37 cai rong ngoai VN la
   *      Han Quoc. Tuc SignalHire giu email/phone cho ho so Viet Nam thuong
   *      xuyen hon nhieu so voi ho so nuoc ngoai.
   *
   *      Do la ly do Beauty co full rate thap nhat: Beauty la cho tap trung
   *      brand indie Han (Iunik, mixsoon, HaruHaru Wonder, APLB, UL
   *      Corporation), va nguoi quyet dinh cua chung ngoi o Han. KHONG phai vi
   *      category Beauty co van de gi rieng.
   *
   *   2. Theo BRAND. Con so theo category che mat su that o cap brand, va do
   *      la dieu PIC canh bao dung: F&B co 5 reveal rong, nhung 14 trong 16
   *      brand cua no SACH HOAN TOAN - ba brand ganh het. Mot con so "F&B 67%
   *      full" doc nhu ca category deu on, trong khi RITA FOOD rong 29%.
   *      Khong hien cap brand thi nguoi doc ket luan sai ve 14 brand con lai.
   */
  const viTriDem = {
    vn: { paid: 0, empty: 0, full: 0, emptyWithLinkedin: 0, nuoc: new Map<string, number>() },
    ngoai: { paid: 0, empty: 0, full: 0, emptyWithLinkedin: 0, nuoc: new Map<string, number>() },
    chuaBiet: { paid: 0, empty: 0, full: 0, emptyWithLinkedin: 0, nuoc: new Map<string, number>() },
  };
  const rongTheoBrand = new Map<string, { paid: number; empty: number }>();

  const brandContactCount = new Map<string, number>();
  const allBrandIds = [...brandCat.keys()];
  const LO2 = 100;
  for (let i = 0; i < allBrandIds.length; i += LO2) {
    const lo = allBrandIds.slice(i, i + LO2);
    const { data: cs, error: ecs2 } = await db
      .from('contact').select('brand_id, source, email, phone, location, linkedin_url').in('brand_id', lo);
    if (ecs2) throw new LoiXuat(`Could not read the contacts: ${ecs2.message}`, 500);
    for (const c of (cs ?? []) as any[]) {
      brandContactCount.set(c.brand_id, (brandContactCount.get(c.brand_id) ?? 0) + 1);
      const agg = catAgg.get(brandCat.get(c.brand_id)!);
      if (!agg) continue;
      /**
       * TACH theo "credit co mua khong", khong dem chung mot cuc.
       *
       * isByCredit() o lib/contactOrigin.ts la ban DUY NHAT cua phep phan loai
       * nay - UsagePanel.tsx cung goi chinh no. Truoc day sheet nay dem het
       * vao mot so `contacts` roi chia ra ti le, nen con so do tron ca contact
       * nguoi go tay (khong ton credit nao) voi contact reveal that: Mom & Baby
       * hien 41% full trong khi 3 credit cua no chi mua 21 contact o 29%.
       */
      if (isByCredit(c.source)) {
        agg.paid += 1;
        // Bon nhanh loai tru nhau va cong dung bang agg.paid - xem CatRow.
        // Phan nay tra loi VI SAO full rate thap: thieu phone la mot chuyen
        // (van goi duoc mail), ve tay khong la chuyen khac han.
        const coMail = Boolean(c.email);
        const coPhone = Boolean(c.phone);
        if (coMail && coPhone) agg.paidFull += 1;
        else if (coMail) agg.paidMailOnly += 1;
        else if (coPhone) agg.paidPhoneOnly += 1;
        else {
          agg.paidNeither += 1;
          // Con so cuu duoc viec: khong email khong phone nhung van co LinkedIn.
          if (c.linkedin_url) agg.paidNeitherWithLinkedin += 1;
        }
      } else {
        agg.free += 1;
      }

      // --- hai truc phan tich nguyen nhan, xem ghi chu o viTriDem ----------
      if (isByCredit(c.source)) {
        const rong = !c.email && !c.phone;

        // khopVung() o lib/rank.ts la ban DUY NHAT cua phep "dia diem nay co
        // thuoc vung do khong" - man ket qua scan cung goi chinh no. Mot ban
        // thu hai o day se lech ma khong co gi bao.
        const trongVN = Boolean(c.location) && khopVung(c.location, 'Vietnam only') !== null;
        const g = !c.location ? viTriDem.chuaBiet : (trongVN ? viTriDem.vn : viTriDem.ngoai);

        // Cheo category x vi tri - xem CatRow.paidVn. Bo qua dong khong co
        // location: mot nhom khong biet o dau thi khong tra loi duoc cau hoi
        // ve dia diem.
        if (c.location) {
          if (trongVN) { agg.paidVn += 1; if (rong) agg.paidVnEmpty += 1; }
          else { agg.paidNgoai += 1; if (rong) agg.paidNgoaiEmpty += 1; }
        }
        g.paid += 1;
        if (c.email && c.phone) g.full += 1;
        if (rong) {
          g.empty += 1;
          if (c.linkedin_url) g.emptyWithLinkedin += 1;
          // Ten nuoc = cum cuoi cua location. Du de noi "33 cua no o Han Quoc",
          // khong can bang tra quoc gia rieng.
          const nuoc = String(c.location ?? '').split(',').pop()?.trim();
          if (nuoc) g.nuoc.set(nuoc, (g.nuoc.get(nuoc) ?? 0) + 1);
        }

        const tenBrand = brandName.get(c.brand_id);
        if (tenBrand) {
          const b = rongTheoBrand.get(tenBrand) ?? { paid: 0, empty: 0 };
          b.paid += 1;
          if (rong) b.empty += 1;
          rongTheoBrand.set(tenBrand, b);
        }
      }
    }
  }
  for (const [brandId, catId] of brandCat) {
    const agg = catAgg.get(catId);
    if (!agg) continue;
    if ((brandContactCount.get(brandId) ?? 0) > 0) agg.withContact += 1; else agg.noContact += 1;
  }
  for (const l of (ledger ?? []) as any[]) {
    const agg = catAgg.get(l.category_id);
    if (agg) agg.spend += l.amount;
  }

  const dsCat = [...catAgg.values()];

  /**
   * Nuoc troi nhat trong nhom rong, de cau ket luan noi duoc dich danh
   * ("33 of those are in Republic of Korea") thay vi mot cau chung chung.
   */
  const troiNhat = (m: Map<string, number>) => {
    let ten: string | null = null; let n = 0;
    for (const [k, v] of m) if (v > n) { ten = k; n = v; }
    return { ten, n };
  };

  const viTri: ViTriRow[] = ([
    ['vn', 'In Vietnam', viTriDem.vn],
    ['ngoai', 'Outside Vietnam', viTriDem.ngoai],
    // Nhan noi RO la nhom nay bi loai khoi so sanh. Kiem tren du lieu that:
    // 22 dong nay co external_uid kieu 'sh-samsung-01' hoac null, tuc la du
    // lieu di tru tu ban n8n cu, khong phai reveal cua app - va chung 0% rong
    // vi ai do da chon loc san. De trong bang so sanh ve dia diem thi lam lech
    // ket luan; an di thi giau mat 22 dong. Nen: hien, va ghi ro bi loai.
    ['chuaBiet', 'No location recorded — left out of the comparison', viTriDem.chuaBiet],
  ] as const).map(([key, label, d]) => {
    const t = troiNhat(d.nuoc);
    return {
      key, label, paid: d.paid, empty: d.empty, full: d.full,
      emptyWithLinkedin: d.emptyWithLinkedin,
      topNuoc: t.ten, topNuocEmpty: t.n,
    };
  });

  /**
   * Brand dang ganh so reveal rong. Chi lay brand co it nhat MIN_PAID_BRAND
   * reveal: mot brand co 1 reveal va 1 cai rong la 100% nhung khong noi len
   * dieu gi - dung cai bay mau nho da phai sua o bang category.
   */
  const MIN_PAID_BRAND = 5;
  const brandRong: BrandRong[] = [...rongTheoBrand.entries()]
    .filter(([, g]) => g.empty > 0 && g.paid >= MIN_PAID_BRAND)
    .map(([brand, g]) => ({
      brand,
      category: catTheoBrandTen.get(brand) ?? '',
      paid: g.paid,
      empty: g.empty,
    }))
    .sort((a, b) => b.empty - a.empty || b.empty / b.paid - a.empty / a.paid)
    .slice(0, 10);

  veSheetCreditContacts(s5, { rows: dsCat, viTri, brands: brandRong, from: fFrom, to: fTo });

  // ke soc nhe cho de doc
  for (const ws of [s1, s2, s3]) {
    ws.eachRow((row, i) => {
      if (i > 1 && i % 2 === 0) {
        row.eachCell((c) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY } };
        });
      }
    });
  }

  return wb;
}
