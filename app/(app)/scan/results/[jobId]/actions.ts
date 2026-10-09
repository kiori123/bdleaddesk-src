'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { nameKey } from '@/lib/nameKey';
import { loadSettings, searchBrand } from '@/lib/signalhire';
import { CALLS_PER_COMPANY_WORST_CASE } from '@/lib/scanLimits';
import { khopVung, vungCoChiaDuoc, xepTrongVungLenTruoc } from '@/lib/rank';
import { timVung } from '@/lib/regions';
import { catTheoBrand } from '@/lib/scanLimits';

export type Cand = {
  id: string;
  brand_id: string | null;
  brand_name: string;
  external_uid: string;
  full_name: string;
  job_title: string | null;
  company: string | null;
  location: string | null;
  years_in_role: number | null;
  open_to_work: boolean;
  score: number;
  score_reasons: string[];
  contact_id: string | null;
  /**
   * Nguoi nay co lam viec trong vung PIC da chon khong.
   *
   * null nghia la CAU HOI KHONG AP DUNG, khong phai "khong khop": vung
   * "Global"/"Group headquarters" khong co danh sach nuoc, va job cu co the
   * khong luu vung. O do man hinh khong chia nhom.
   */
  inRegion: boolean | null;
};

/**
 * "28 of 1020 found" hay "Not found in SignalHire" - xem BrandResult.total /
 * .outcome o lib/signalhire.ts. total null nghia la khong biet (loi mang).
 */
export type BrandStat = {
  brand: string;
  total: number | null;
  outcome: 'not_found' | 'all_shown' | 'narrowed' | 'error';
  found: number;
  /**
   * Co hua loc (outcome 'narrowed') ma khong loc duoc khong - xem
   * CongTyResult.filterSkipped o lib/signalhire.ts. Job cu (luu truoc khi co
   * truong nay) khong co no; mac dinh false de khong bien moi lan quet cu
   * thanh mot canh bao khong co co so.
   */
  filterSkipped: boolean;
};

export type JobView = {
  status: string;
  error: string | null;
  createdAt: string;
  /** Brand bi bo qua vi da co nguoi tren he thong. */
  skipped: string[];
  /** Brand ma alias tra ve rong nen da phai tim lai bang chinh ten brand. */
  fellBack: { brand: string; from: string; to: string }[];
  /** Brand vuot qua tran moi lan quet nen chua chay. */
  notRun: string[];
  /**
   * Nguoi DUOC HIEN, da cat con toi da MAX_PROFILE_MOI_BRAND moi brand.
   *
   * Man hinh khong bao gio cam danh sach day du, va day la co y: nut lay
   * contact chi chon duoc trong so nay, nen khong the lo tieu credit cho mot
   * nguoi PIC chua nhin thay.
   */
  candidates: Cand[];
  /**
   * So nguoi THAT SU co cho moi brand, TRUOC khi cat. Man hinh doi chieu voi
   * so dong thuc hien de noi "20 of 63" - khong co no thi mot danh sach dung
   * 20 nguoi doc giong het mot brand chi co 20 nguoi.
   */
  tongTheoBrand: Record<string, number>;
  /** total/outcome tung brand - xem BrandStat. */
  brandStats: BrandStat[];
  /**
   * Nhan cua vung PIC da chon (vi du "Vietnam"), null khi vung khong chia
   * nhom duoc - xem Cand.inRegion. Man hinh dung no lam tieu de nhom.
   */
  regionLabel: string | null;
};

const COLS =
  'id, brand_id, brand_name, external_uid, full_name, job_title, company, ' +
  'location, years_in_role, open_to_work, score, score_reasons, contact_id';

/**
 * Man ket qua hoi lai cho den khi job xong.
 *
 * RLS lo phan ai duoc xem gi: job_read va scan_candidate_read deu buoc job phai
 * la cua chinh nguoi dang dang nhap (hoac admin). Nen o day khong can kiem tra
 * quyen bang tay, chi can KHONG dung service_role.
 */
export async function pollJob(jobId: string): Promise<JobView | null> {
  const db = await supabaseServer();

  const { data: job } = await db
    .from('job').select('status, error, created_at, result, payload').eq('id', jobId).single();
  if (!job) return null;

  const ketQua = (job as any).result ?? {};
  const boQua = ketQua.skipped;

  const dsBrandKetQua: any[] = Array.isArray(ketQua.brands) ? ketQua.brands : [];

  const doiTen = dsBrandKetQua
    .filter((b: any) => b?.fellBack && b?.aliasCompany)
    .map((b: any) => ({
      brand: String(b.brand ?? ''),
      from: String(b.aliasCompany ?? ''),
      to: String(b.company ?? ''),
    }));

  const brandStats: BrandStat[] = dsBrandKetQua.map((b: any) => ({
    brand: String(b.brand ?? ''),
    total: Number.isFinite(Number(b.total)) ? Number(b.total) : null,
    outcome: (['not_found', 'all_shown', 'narrowed', 'error'] as const)
      .includes(b.outcome) ? b.outcome : 'error',
    found: Number.isFinite(Number(b.found)) ? Number(b.found) : 0,
    // Chi coi la "chua loc" khi job GHI RO true. Job cu khong co truong nay,
    // va undefined khong phai bang chung cua viec gi ca.
    filterSkipped: b.filterSkipped === true,
  }));

  const { data: cands } = await db
    .from('scan_candidate').select(COLS).eq('job_id', jobId)
    .order('score', { ascending: false })
    .order('full_name');

  /**
   * Vung PIC da chon, doc tu job.payload.location - CHINH lua chon cua lan quet
   * do, khong phai lua chon hien tai cua form. Mo lai mot job cu thi thu tu
   * phai giong luc no chay.
   *
   * Xep nguoi trong vung len truoc: xem xepTrongVungLenTruoc() o lib/rank.ts
   * ve ly do va ve viec no KHONG loai ai ca. Day cung la ly do bao cao "ra
   * toan SEA" van dung ngay ca sau khi bo loc o nguon da chay lai duoc - cong
   * ty duoi 100 nguoi thi CO Y khong loc gi, luc do chi con thu tu quyet dinh
   * PIC doc thay gi truoc.
   */
  const vung = typeof (job as any).payload?.location === 'string'
    ? String((job as any).payload.location) : null;
  const chiaDuoc = vungCoChiaDuoc(vung);

  // Du an khong sinh type tu schema Supabase, nen voi chuoi COLS dai, thu vien
  // khong suy ra noi hinh dang hang va tra ve GenericStringError[]. Ep thang
  // sang Cand[] bi tu choi vi hai kieu khong giao nhau, phai di vong qua
  // unknown. Doi lai: Cand la giao keo duy nhat, sua COLS thi phai sua Cand.
  const dsCand = ((cands ?? []) as unknown as Omit<Cand, 'inRegion'>[]).map((c) => ({
    ...c,
    inRegion: chiaDuoc ? khopVung(c.location, vung) !== null : null,
  }));

  const dsXep = xepTrongVungLenTruoc(dsCand);

  /**
   * Cat con MAX_PROFILE_MOI_BRAND nguoi moi brand.
   *
   * Cat o DAY, sau xepTrongVungLenTruoc, chu khong phai bang `.limit()` tren
   * truy van: thu tu cuoi cung la trong-vung-truoc roi moi den diem, va thu
   * tu do chi co sau khi doc xong `job.payload.location`. Cat o truy van se
   * giu 20 nguoi diem cao nhat KE CA khi ho deu nam ngoai vung PIC chon, tuc
   * dung thu tu cu va sai thu tu man hinh.
   */
  const { hien: dsHien, tongTheoBrand } = catTheoBrand(dsXep);

  return {
    status: job.status,
    error: job.error,
    createdAt: job.created_at,
    skipped: Array.isArray(boQua) ? boQua.map(String) : [],
    fellBack: doiTen,
    notRun: Array.isArray(ketQua.notRun) ? ketQua.notRun.map(String) : [],
    brandStats,
    regionLabel: chiaDuoc && vung ? (timVung(vung)?.label ?? null) : null,
    candidates: dsHien,
    tongTheoBrand,
  };
}

/**
 * PIC thu mot ten phap nhan khac cho mot brand khong tim thay ai, va neu ra
 * nguoi thi luu lai lam alias.
 *
 * Vi sao can. Tren LinkedIn nguoi ta khai phap nhan chu quan chu khong khai
 * brand truc thuoc, nen brand con thuong tra ve 0 nguoi va man ket qua chi
 * noi duoc "check whether this brand trades under a different legal entity".
 * Cau do dung nhung la ngo cut: sua alias la quyen admin, ma doi hinh co 8
 * PIC tren 2 admin. PIC con lai phai doan mot ten khac, go lai ca lan quet,
 * va doan dung cung khong duoc he thong nho - tuc lan sau lai doan tu dau.
 *
 * XAC MINH TRUOC KHI LUU, khong luu thang. Day la diem mau chot:
 *   - PIC thay ngay ten minh doan co ra nguoi khong, thay vi quet lai roi doi.
 *   - Khong co alias nao duoc ghi mu. Ca phien nay vua di don 83 alias tu hoc
 *     sai, trong do mot brand sua bot bi gan vao mot truong cap ba; mo cho ghi
 *     tu do them mot duong nua la lap lai dung cai do.
 *   - Vi phai co nguoi that tra ve moi luu, mot lan thu hong khong de lai dau
 *     vet gi ngoai mot luot trong dong ho han muc.
 *
 * Do la ly do khong can gioi han o admin: viec nay tieu dung mot luot tim -
 * thu ma PIC von da duoc phep lam - va chi ghi alias khi SignalHire xac nhan
 * co nguoi that o do.
 *
 * priority 0 (nhap tay) de no thang moi dong tu hoc, giong saveAlias() ben
 * admin - xem fix_alias_priority.sql.
 */
export async function thuTenPhapNhan(brand: string, employer: string): Promise<
  { ok: true; soNguoi: number; daLuu: boolean } | { ok: false; error: string }
> {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const { data: me } = await db.from('profile')
    .select('active, email').eq('id', user.id).maybeSingle();
  if (!me?.active) return { ok: false, error: 'This account is not active.' };

  const tenBrand = String(brand ?? '').trim();
  const tenCty = String(employer ?? '').trim();
  if (!tenBrand) return { ok: false, error: 'No brand to search for.' };
  if (tenCty.length < 2) return { ok: false, error: 'Type the company name you want to try.' };
  if (nameKey(tenCty) === nameKey(tenBrand)) {
    return { ok: false, error: 'That is the same name the scan already tried. Try the legal entity or the parent company.' };
  }

  // Tran ngay cua SignalHire, dung chung ca team. Mot lan thu cung la mot luot
  // that, nen phai hoi truoc va ghi lai sau - xem CLAUDE.md.
  const { data: quota, error: quotaErr } = await db.rpc('my_quota');
  if (quotaErr || !quota || typeof quota.dang_khoa !== 'boolean') {
    return { ok: false, error: 'Could not check the daily search limit right now. Nothing was searched.' };
  }
  if (quota.dang_khoa) {
    return { ok: false, error: 'Searching is locked because the team hit SignalHire’s daily limit. Try again after it resets.' };
  }
  if ((quota.brand?.team_con_lai ?? 0) < CALLS_PER_COMPANY_WORST_CASE) {
    return { ok: false, error: 'The team has no searches left today. Try again tomorrow.' };
  }

  const admin = supabaseAdmin();
  const { apikey } = await loadSettings();
  if (!apikey) return { ok: false, error: 'No SignalHire key saved in Settings yet.' };

  // aliases rong + brand = chinh ten PIC go: searchBrand se tim DUNG mot cong
  // ty do, khong tra cuu alias va khong tu tim lai bang ten nao khac. Dung mot
  // duong goi SignalHire duy nhat cua app (lib/signalhire.ts), nen van di qua
  // hang doi 3-dong-thoi va van tra ve `calls` de ghi dong ho.
  const r = await searchBrand({
    apikey,
    brand: tenCty,
    tier: 1,
    aliases: new Map(),
    region: 'Vietnam and Southeast Asia',
    roles: [],
    keywords: '',
  });

  const { error: usageErr } = await admin.from('search_usage').insert({
    profile_id: user.id,
    brands: r.calls,
    profiles: r.candidates.length,
  });
  if (usageErr) console.error('[alias] khong ghi duoc search_usage:', usageErr.message);

  if (r.problem && r.candidates.length === 0) {
    return { ok: false, error: `SignalHire could not be reached (${r.problem.status}). Nothing was saved.` };
  }

  const soNguoi = r.total ?? r.candidates.length;
  if (soNguoi <= 0) {
    return { ok: true, soNguoi: 0, daLuu: false };
  }

  const { error } = await admin.from('brand_alias').upsert(
    {
      alias: nameKey(tenBrand),
      employer: tenCty,
      relation: 'owner',
      priority: 0,
      note: `Nhap tay ${new Date().toISOString().slice(0, 10)} tu man ket qua quet`
        + `${me.email ? ` (${me.email})` : ''}: SignalHire co ${soNguoi} nguoi o ten nay.`,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'alias,employer' },
  );
  if (error) return { ok: false, error: `Found ${soNguoi} people but could not save the name: ${error.message}` };

  return { ok: true, soNguoi, daLuu: true };
}
