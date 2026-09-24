'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { khopVung, vungCoChiaDuoc, xepTrongVungLenTruoc } from '@/lib/rank';
import { timVung } from '@/lib/regions';

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
 * "28 of 1020 shown" hay "Not found in SignalHire" - xem BrandResult.total /
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
  candidates: Cand[];
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

  return {
    status: job.status,
    error: job.error,
    createdAt: job.created_at,
    skipped: Array.isArray(boQua) ? boQua.map(String) : [],
    fellBack: doiTen,
    notRun: Array.isArray(ketQua.notRun) ? ketQua.notRun.map(String) : [],
    brandStats,
    regionLabel: chiaDuoc && vung ? (timVung(vung)?.label ?? null) : null,
    candidates: dsXep,
  };
}
