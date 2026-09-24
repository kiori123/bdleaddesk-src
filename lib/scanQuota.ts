import { PROFILES_PER_CALL } from '@/lib/signalhire';
import { CALLS_PER_COMPANY_WORST_CASE, MAX_BRAND_MOI_LAN } from '@/lib/scanLimits';

// Xuat lai de scan/route.ts van import tu mot noi (lib/scanQuota.ts) nhu
// truoc - dinh nghia THAT nam o lib/scanLimits.ts, file khong keo theo
// lib/supabase/admin.ts, de Results.tsx (client component) import truc tiep
// tu do ma khong keo ca lib/signalhire.ts vao goi client. Xem ghi chu o
// lib/scanLimits.ts.
export { CALLS_PER_COMPANY_WORST_CASE, MAX_BRAND_MOI_LAN };

/**
 * Tinh xem mot yeu cau scan co vua trong han muc brand/profile con lai cua
 * team hom nay khong, va neu khong thi de xuat mot phan dau danh sach (theo
 * DUNG thu tu da gui) vua du cho VA vua trong MAX_BRAND_MOI_LAN (tran moi
 * lan goi cua chinh scan/route.ts, vi ly do maxDuration chu khong phai han
 * muc ngay).
 *
 * Ham thuan tuy, khong goi SignalHire hay Supabase that - de test nhanh khong
 * can DB/API that (chi import mot hang so tu lib/signalhire.ts, khong goi ham
 * nao trong do). app/api/scan/route.ts la noi duy nhat goi ham nay, ngay sau
 * khi da loc "brand da co nguoi" va truoc khi cham vao SignalHire.
 *
 * resetsAt la THAM SO DAU VAO, khong tu tinh trong file nay. my_quota() da
 * tra ve ky_bat_dau (ngay bat dau ky hien tai, DB tinh) - resetsAtFromPeriodStart()
 * chi cong 1 ngay vao gia tri DO, khong tu hoi "bay gio la may gio o Viet Nam"
 * mot lan nua. Du an nay da bi vo hai lan trong phien lam viec nay vi mot quy
 * tac song song o hai noi (is_admin()/my_categories()/canUseCategory(), roi
 * locked_until/00:00), nen o day CHI CON MOT nguon: ky_bat_dau cua DB.
 */

export type BrandReq = { name?: string | null; tier?: number };

export type QuotaSnapshot = {
  /** So luot brand con lai cua team hom nay (tu quota.brand.team_con_lai). */
  brandRemaining: number;
  /** So profile con lai cua team hom nay (tu quota.profile.team_con_lai). */
  profileRemaining: number;
};

export type ScanPlan =
  | { status: 'fits'; toScan: BrandReq[] }
  | {
      status: 'confirm';
      asked: number;
      toScan: BrandReq[];
      wouldScanNames: string[];
      brandRemaining: number;
      profileRemaining: number;
      resetsAt: string;
    }
  | { status: 'blocked'; brandRemaining: number; profileRemaining: number; resetsAt: string };

/**
 * my_quota() tra ve ky_bat_dau dang "YYYY-MM-DD" (ngay lich VN, DB da tinh).
 * Ky tiep theo bat dau luc 00:00 gio VN (UTC+7, khong DST) cua NGAY SAU do.
 *
 * Dung Date.UTC voi thang/ngay/gio truyen thang (khong ghep chuoi bang tay)
 * de no tu chuan hoa tran thang (vi du ngay 31 cua thang 9 - thang chi co 30
 * ngay - tu dong lan sang ngay 1 thang 10) va tran gio (-7 tu lui ve ngay
 * hom truoc theo UTC).
 */
export function resetsAtFromPeriodStart(kyBatDau: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(kyBatDau);
  if (!m) throw new Error(`ky_bat_dau khong dung dang YYYY-MM-DD: "${kyBatDau}"`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d + 1, -7, 0, 0)).toISOString();
}

export function planScan(opts: {
  brands: BrandReq[];
  /**
   * So LUOT GOI SIGNALHIRE TRUONG HOP XAU NHAT ma mot brand co the chiem -
   * KHONG con la so luot-han-muc-brand co y nghia rieng nhu ban cu (1, hoac 2
   * neu co alias). Tu thiet ke hai lan goi (kham pha + thu hep, xem
   * searchBrand() trong lib/signalhire.ts), moi cong ty da mapped toi da
   * CALLS_PER_COMPANY_WORST_CASE lan; brand co N cong ty mapped thi toi da
   * N * CALLS_PER_COMPANY_WORST_CASE, cong them CALLS_PER_COMPANY_WORST_CASE
   * neu co alias (truong hop TAT CA N cong ty khong co trong chi muc, phai
   * thu lai bang ten brand). Dung MOT con so nay cho CA hai truc han muc:
   * profile uoc luong = costOfBrand(b) * PROFILES_PER_CALL, vi moi lan goi deu
   * xin toi da PROFILES_PER_CALL nguoi - xem ghi chu o duoi.
   */
  costOfBrand: (b: BrandReq) => number;
  quota: QuotaSnapshot;
  /** MAX_BRAND_MOI_LAN cua scan/route.ts - tran cung request, khong lien quan han muc ngay. */
  maxBrandsPerRequest: number;
  /** Tu resetsAtFromPeriodStart(quota.ky_bat_dau), tinh MOT lan o noi goi. */
  resetsAt: string;
}): ScanPlan {
  let luotDung = 0;
  let uocProfileDung = 0;
  const toScan: BrandReq[] = [];

  for (const b of opts.brands) {
    if (toScan.length >= opts.maxBrandsPerRequest) break;
    const luot = opts.costOfBrand(b);
    // Uoc profile TRUC TIEP tu so luot goi, khong phai mot hang so rieng: moi
    // lan goi SignalHire xin toi da PROFILES_PER_CALL nguoi (bat ke la lan
    // kham pha hay lan thu hep), nen brand co nhieu cong ty mapped hon thi uoc
    // profile cung phai lon hon theo dung ti le - truoc day day la MOT hang so
    // co dinh cho moi brand, sai voi brand co alias tro toi nhieu hon 1 cong ty.
    const uocProfile = luot * PROFILES_PER_CALL;
    if (luotDung + luot > opts.quota.brandRemaining) break;
    if (uocProfileDung + uocProfile > opts.quota.profileRemaining) break;
    luotDung += luot;
    uocProfileDung += uocProfile;
    toScan.push(b);
  }

  // "fits" nghia la han muc NGAY khong phai ly do khien it hon duoc chon -
  // neu MAX_BRAND_MOI_LAN la ly do duy nhat (con han muc thi thoai mai), do
  // la chuyen cua co che notRun/conLai co san trong scan/route.ts, khong
  // phai chuyen can PIC xac nhan.
  const toiDaTheNay = Math.min(opts.brands.length, opts.maxBrandsPerRequest);

  if (toScan.length === toiDaTheNay) {
    return { status: 'fits', toScan };
  }
  if (toScan.length === 0) {
    return {
      status: 'blocked',
      brandRemaining: opts.quota.brandRemaining,
      profileRemaining: opts.quota.profileRemaining,
      resetsAt: opts.resetsAt,
    };
  }
  return {
    status: 'confirm',
    asked: opts.brands.length,
    toScan,
    wouldScanNames: toScan.map((b) => String(b?.name ?? '')),
    brandRemaining: opts.quota.brandRemaining,
    profileRemaining: opts.quota.profileRemaining,
    resetsAt: opts.resetsAt,
  };
}
