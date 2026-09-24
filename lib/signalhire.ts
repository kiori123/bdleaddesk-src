import { supabaseAdmin } from '@/lib/supabase/admin';
import { nameKey } from '@/lib/nameKey';
import { timVung } from '@/lib/regions';

/**
 * Goi SignalHire THANG tu app, khong qua n8n nua.
 *
 * Truoc day duong di la: app -> n8n -> goi nguoc ve app xin API key -> SignalHire
 * -> n8n nan du lieu -> goi ve /api/webhooks/n8n -> ghi DB. Hai chang HTTP thua,
 * hai chieu xac thuc, va mot chuoi bi mat phai khop o ca hai dau. Phan lon thoi
 * gian hong cua he thong nam o may cho noi do chu khong phai o logic.
 *
 * Nay: app doc key tu bang app_setting roi goi SignalHire, xong ghi DB. Mot
 * chieu, khong callback, khong bi mat chia se.
 *
 * Ban do thi truong va bang chuc vu duoi day dich nguyen tu node "Plan Search"
 * cua workflow App Bridge. Doi mot ben ma quen ben kia thi ket qua lech ma khong
 * co gi bao, nen ke tu nay CHI CON MOT BAN o day.
 */

const API = 'https://www.signalhire.com/api/v1';

/**
 * SignalHire chi cho toi da 3 request dong thoi tren CUNG mot tai khoan - xac
 * minh tu mot loi that ngay trong DB: "Only three requests are allowed at the
 * same time". Khong co gi giu dieu do truoc day: scan/route.ts goi
 * Promise.all tren toi 8 brand, moi brand toi da hai lan goi (kham pha + thu
 * hep) - toi da 16 request cung luc, gap hon 5 lan gioi han that.
 *
 * MOT hang doi DUNG CHUNG cho CA searchByQuery (goiMotLan) LAN candidate/search
 * (revealUids) - hai duong nay dung CHUNG mot khoa API nen phai dung CHUNG mot
 * gioi han. Neu moi ham tu dem rieng 3 cua no, mot lan reveal hang loat chay
 * dung luc mot PIC khac dang quet se vo tinh cong lai vuot 3 that su, du moi
 * ham tuong minh dang "trong gioi han" theo bien dem rieng cua no.
 *
 * Dat gate ngay tai goiSignalHire() - noi DUY NHAT ca hai duong goi fetch that
 * su - thay vi o Promise.all hay o vong lap cong ty, de dung bao nhieu lan goi
 * logic khong quan trong, chi so luong ket noi mang THAT SU dong thoi moi tinh.
 */
const SO_DONG_THOI_TOI_DA = 3;
let dangChay = 0;
const hangDoi: (() => void)[] = [];

function xinCho(): Promise<void> {
  if (dangChay < SO_DONG_THOI_TOI_DA) {
    dangChay += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => hangDoi.push(resolve));
}

function traCho(): void {
  dangChay -= 1;
  const ke = hangDoi.shift();
  if (ke) {
    dangChay += 1;
    ke();
  }
}

/**
 * Khong gioi han thoi gian cho moi request se treo ca function: mot lan
 * SignalHire cham/hang giu luon 1 trong 3 cho, cac request sau xep hang theo,
 * roi ca chuoi bi Vercel giet ngang khi het maxDuration - job va credit_ledger
 * ket lai o 'running'/'reserved' vinh vien vi khong con dong code nao chay
 * duoc nua de don don. Xac minh tu du lieu that: nhieu dong job kind='reveal'
 * nam o 'running' hang ngay, credit_ledger tuong ung con 'reserved'.
 */
const HET_GIO_MS = 25_000;

/** Moi request that su toi SignalHire (ca search lan reveal) phai di qua day. */
async function goiSignalHire(url: string, init: RequestInit): Promise<Response> {
  await xinCho();
  const bo = new AbortController();
  const dongHo = setTimeout(() => bo.abort(), HET_GIO_MS);
  try {
    return await fetch(url, { ...init, signal: bo.signal });
  } finally {
    clearTimeout(dongHo);
    traCho();
  }
}

// Danh sach vung nam trong lib/regions.ts, dung chung voi man hinh. Truoc day
// moi ben giu mot ban va mot dong ghi chu bat nguoi sua phai nho ca hai; kieu
// do hong lang le chu khong bao loi.
//
// Bo luon "Korea, Republic of" khoi East Asia: no la cach viet cua chuan ISO
// chu chua bao gio duoc kiem la SignalHire hieu, ma tai lieu cua ho noi ro ten
// khong nhan ra thi ca lan goi tra ve 422. Mot dong doan mo nhu vay du de lam
// hong ca lua chon East Asia.

// KHONG con gui `department` sang SignalHire. Day la cho lan truoc doan mo va
// no da lam hong bo loc dia diem trong suot nhieu ngay.
//
// Chuyen da xay ra, doc duoc tu job.error trong DB: MOI lan quet mot cong ty
// lon deu tra ve `[422] Department is not recognized` - L'Oreal Paris, indomie,
// Nutifood, Heineken, Suntory Pepsico, Vinasoy, Dutch Lady, Lof, wake up 247,
// Omo, Lifestyle Co. SignalHire tu choi CA request khi chi mot gia tri
// department khong nam trong danh muc cua ho, va DEPARTMENTS trong
// SearchForm.tsx la nhan TU DAT cua app ("E-commerce and digital", "Export and
// international"), khong phai danh muc cua ho. Ghi chu cu da tu noi ra dieu
// nay - chi "Marketing" tung duoc xac minh - roi van gui ca danh sach di.
//
// Hau qua khong phai la "thieu mot bo loc": lan goi thu hep that bai keo theo
// CA location va currentTitle roi theo, nen timMotCongTy() lui ve ket qua kham
// pha KHONG LOC GI. PIC chon "Vietnam only" va nhan lai 100 nguoi dau tien
// trong chi muc toan cau - dung nhu bao cao "filter Vietnam nhung ra toan SEA"
// (that ra con xa hon: Washington, Ohio, Denmark, Moscow, Mumbai).
//
// Function (roles) tu nay CHI la dau vao xep hang - lib/rank.ts da doi chieu no
// voi job_title san roi (xem scoreCandidate, W.department), la cach doi chieu
// dung hon voi chuc danh lon xon o Viet Nam. Muon dua department tro lai lam
// dieu kien tim thi phai co danh muc THAT cua SignalHire truoc, va phai anh xa
// nhan cua app sang danh muc do, khong duoc gui nguyen nhan tu dat.
const SENIOR =
  'CEO OR CFO OR COO OR CMO OR "Chief Executive" OR President OR Founder'
  + ' OR "Managing Director" OR Director OR "Vice President" OR SVP OR EVP OR "Head of"'
  + ' OR "Country Manager" OR "General Manager" OR Manager OR Lead'
  + ' OR "Tong Giam doc" OR "Chu tich" OR "Giam doc" OR "Truong phong" OR "Quan ly"';

const HQ =
  'Group OR Corporate OR Global OR Headquarters OR "Head Office" OR CEO'
  + ' OR President OR "Managing Director" OR "Vice President" OR Founder OR "Board Member"';

/**
 * size toi da SignalHire cho phep moi lan goi searchByQuery (xac minh bang
 * curl that). Dung cho CA hai lan goi cua mot cong ty - xem searchBrand().
 */
export const PROFILES_PER_CALL = 100;

export type Candidate = {
  external_uid: string;
  full_name: string;
  job_title: string | null;
  company: string | null;
  location: string | null;
  years_in_role: number | null;
  open_to_work: boolean;
  industry: string | null;
  skills: string[] | null;
  /** Cac dong kinh nghiem qua khu (va hien tai) SignalHire tra ve. Dung de xep
   * hang o lib/rank.ts - vi du mot nguoi lam "Financial Planning - Seasoning
   * (Nam Ngu, Chin-su, Tam Thai Tu)" phai duoc tinh cho brand Chin-su du cong
   * ty hien tai la Masan. */
  experience: { company: string | null; title: string | null }[];
  raw: unknown;
};

/** Ket qua tim mot CONG TY (mot lan goi searchByQuery, hoac hai neu total > 100). */
export type CongTyResult = {
  company: string;
  /** total that tu SignalHire. null khi lan goi loi (khong biet duoc). */
  total: number | null;
  candidates: Candidate[];
  calls: number;
  /**
   *   not_found : total === 0 - cong ty khong co trong chi muc cua SignalHire.
   *   all_shown : 0 < total <= 100 - lay het trong MOT lan goi, khong loc gi.
   *   narrowed  : total > 100 - phai goi lan hai co loc de con dung sizeToi da.
   *   error     : lan goi (dau tien) that bai, khong biet total.
   */
  outcome: 'not_found' | 'all_shown' | 'narrowed' | 'error';
  /**
   * true khi le ra phai loc ma KHONG loc duoc: lan goi thu hep (dia diem + cap
   * bac + keywords) that bai, nen cai dang tra ve la ket qua KHAM PHA khong
   * loc gi - 100 nguoi dau tien cua chi muc toan cau, khong phai nguoi trong
   * vung PIC chon.
   *
   * Dat ten theo huong "da bo qua mot buoc loc", KHONG phai "co loc hay
   * khong". Hai nhanh not_found va all_shown CO Y khong loc gi ca (cong ty nho
   * thi PIC muon thay het) - mot truong dat ten theo huong "co loc" se phai
   * mang gia tri am o hai nhanh do ma o do no khong co nghia gi, de lan sau
   * doc nham thanh "chua loc" roi canh bao vo co. Truong nay chi bat o dung
   * mot truong hop: co hua loc ma khong loc.
   *
   * Truoc day khong co truong nay, nen man ket qua noi "narrowed at the source
   * because the company is large" trong CA hai truong hop; dung mot cau do cho
   * mot danh sach chua loc la noi sai voi PIC.
   */
  filterSkipped: boolean;
  problem: { status: number; message: string } | null;
};

export type BrandResult = {
  brand: string;
  tier: number;
  /** Ten cong ty CUOI CUNG da dung de tim. */
  company: string;
  mapped: boolean;
  /** Co alias nhung alias ra rong nen da tim lai bang ten brand. */
  fellBack: boolean;
  /** Ten cong ty cua alias, giu lai de noi cho PIC biet alias nao hong. */
  aliasCompany: string | null;
  /** So lan goi SignalHire that su, de ghi dung vao dong ho han muc. */
  calls: number;
  candidates: Candidate[];
  problem: { status: number; message: string } | null;
  /**
   * Tong so nguoi SignalHire bao co (cong don qua moi cong ty da mapped cho
   * brand nay). null khi khong biet (moi lan goi deu loi). Dung de hien
   * "28 of 1020 shown" cho PIC - xem Results.tsx.
   */
  total: number | null;
  /** Gom outcome cua tung cong ty - xem CongTyResult.outcome. */
  outcome: 'not_found' | 'all_shown' | 'narrowed' | 'error';
  /**
   * true khi co it nhat mot cong ty le ra phai loc ma khong loc duoc - xem
   * CongTyResult.filterSkipped. Man ket qua dung truong nay de khong khoe da
   * loc khi that ra chua.
   */
  filterSkipped: boolean;
};

/**
 * Key va bang alias, doc mot lan roi dung cho ca lan quet.
 *
 * Bang alias duy nhat theo cap (alias, employer), tuc MOT alias duoc phep tro
 * toi NHIEU cong ty (chu so huu, nha phan phoi...) - gio day tim ca nhung
 * cong ty do (xem searchBrand), khong chi mot cai nhu truoc.
 *
 * Thu tu trong danh sach van co y nghia (cai dau tien la "chinh", dung lam
 * aliasCompany hien thi): priority nho thang, bang nhau thi cai moi cap nhat
 * thang.
 *
 * Thang do priority - CO Y NGHIA CO DINH, doi la vo hieu hoa "admin luon
 * thang" ma tab1_fix_alias_priority.sql thiet lap:
 *   0 = admin tu tay nhap (saveAlias)      - LUON THANG, kha nang con lai
 *       khong duoc phep vuot qua so nay.
 *   1 = tu hoc qua duong tim lai (fellBack) - alias cu da chung minh sai,
 *       nen thang hon mot dong tu hoc thong thuong nhung KHONG duoc thang
 *       admin.
 *   2 = tu hoc lan dau thanh cong           - chi la ghi lai de tham khao,
 *       thua ca hai loai tren.
 */
/**
 * Gop cac dong brand_alias (da doc theo priority asc, updated_at desc, xem
 * loadSettings) thanh Map alias -> danh sach cong ty, GIU THU TU: phan tu dau
 * tien la "cong ty chinh" (dung lam aliasCompany hien thi va cong ty thu
 * truoc trong searchBrand). Vi hang vao da sap theo priority asc, dong
 * priority=0 (admin tu tay nhap - saveAlias) luon duoc chen truoc dong tu hoc
 * (priority 1/2 - ghiAliasHocDuoc) cho CUNG mot khoa, nen "chinh" luon la lua
 * chon cua admin neu co - dung nhu tab_fix_alias_priority.sql thiet lap.
 *
 * Tach rieng thanh ham thuan de test duoc ma khong can goi DB that.
 */
export function gomAliasTheoUuTien(rows: { alias: unknown; employer: unknown }[]): Map<string, string[]> {
  const aliases = new Map<string, string[]>();
  for (const r of rows ?? []) {
    const k = nameKey(String((r as any).alias ?? ''));
    const v = String((r as any).employer ?? '').trim();
    if (!k || !v) continue;
    const ds = aliases.get(k);
    if (ds) { if (!ds.includes(v)) ds.push(v); } else aliases.set(k, [v]);
  }
  return aliases;
}

export async function loadSettings() {
  const db = supabaseAdmin();
  const [{ data: setting }, { data: rows }] = await Promise.all([
    db.from('app_setting').select('value').eq('key', 'signalhire_api_key').maybeSingle(),
    db.from('brand_alias').select('alias, employer, priority, updated_at')
      .order('priority', { ascending: true })
      .order('updated_at', { ascending: false }),
  ]);

  // MOT alias co the tro toi NHIEU cong ty (chu so huu + nha phan phoi...).
  // Giu ca danh sach, khong chi dong dau tien nhu truoc - searchBrand se tim
  // tat ca.
  const aliases = gomAliasTheoUuTien(rows ?? []);
  return { apikey: String((setting as any)?.value ?? '').trim(), aliases };
}

/**
 * Ghi lai ten cong ty ma nguoi that su khai, thanh alias cho brand.
 *
 * Thay cho ba node "Collect Aliases", "Add Alias Prompt" va "Save Brand Alias"
 * ben n8n cu. Khong co no thi moi lan PIC mo duoc mot brand kho la kien thuc do
 * chet theo phien lam viec, nguoi sau lai do lai tu dau.
 *
 * Ba cai chan de khong hoc phai rac:
 *   - Duoi 3 ung vien thi khong hoc. Mot hai nguoi de la trung ten ngau nhien.
 *   - Ten cong ty phai xuat hien it nhat 2 lan, hoac chiem tu 60% tro len.
 *   - Trung voi chinh ten brand thi khong hoc, vi khong them thong tin gi.
 *
 * priority 1 khi day la ket qua cua lan tim lai (fellBack): alias cu da chung
 * minh ra rong, nen dong nay phai thang MOI dong tu hoc khac - nhung khong
 * duoc thang priority 0 (admin tu tay nhap, xem saveAlias). Con lai ghi
 * priority 2, tuc chi luu lam ho so, khong lan quyen ai ca.
 */
export async function ghiAliasHocDuoc(opts: {
  brand: string;
  candidates: Candidate[];
  /** Lan tim lai da cuu duoc brand nay hay khong. */
  fellBack: boolean;
  /** Cong ty cua alias cu, chi de ghi vao note cho nguoi sau doc hieu. */
  aliasCompany: string | null;
}) {
  const khoaBrand = nameKey(opts.brand);
  if (!khoaBrand || opts.candidates.length < 3) return null;

  const dem = new Map<string, { ten: string; n: number }>();
  for (const c of opts.candidates) {
    const ten = String(c.company ?? '').trim();
    const k = nameKey(ten);
    if (!k) continue;
    const cu = dem.get(k);
    if (cu) cu.n += 1; else dem.set(k, { ten, n: 1 });
  }

  const xepHang = [...dem.values()].sort((a, b) => b.n - a.n);
  const dan = xepHang[0];
  if (!dan) return null;

  const duNhieu = dan.n >= 2 || dan.n / opts.candidates.length >= 0.6;
  if (!duNhieu) return null;
  if (nameKey(dan.ten) === khoaBrand) return null;

  const note = opts.fellBack
    ? `Tu hoc ${new Date().toISOString().slice(0, 10)}: alias cu "${opts.aliasCompany ?? ''}" tra ve 0 nguoi, `
      + `ten nay ra ${dan.n}/${opts.candidates.length} nguoi.`
    : `Tu hoc ${new Date().toISOString().slice(0, 10)}: ${dan.n}/${opts.candidates.length} ket qua khai ten nay.`;

  const { error } = await supabaseAdmin().from('brand_alias').upsert(
    {
      alias: khoaBrand,
      employer: dan.ten,
      relation: 'owner',
      priority: opts.fellBack ? 1 : 2,
      note: note.slice(0, 300),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'alias,employer' },
  );

  // Hong o day khong duoc lam ca lan quet that bai theo. Ket qua da co roi,
  // hoc them duoc hay khong chi la chuyen cua lan sau.
  if (error) { console.error('[alias] khong ghi duoc alias hoc duoc:', error.message); return null; }
  return { alias: khoaBrand, employer: dan.ten, n: dan.n };
}

/**
 * Dieu kien KHAM PHA: lan goi DAU TIEN cho mot cong ty. Khong loc gi ca ngoai
 * chinh cong ty do - khong currentTitle, khong location, khong keywords,
 * khong department. Muc dich duy nhat la doc total that tu SignalHire de
 * quyet dinh buoc tiep theo (xem timMotCongTy).
 *
 * excludeRevealed: true de khong xin lai nhung nguoi da reveal roi - do la
 * tin hieu that, khong phai bo loc lam mat nguoi chua tung thay.
 */
function dieuKienKhamPha(company: string): Record<string, unknown> {
  return { currentCompany: company, size: PROFILES_PER_CALL, excludeRevealed: true };
}

/**
 * Dieu kien THU HEP: chi goi khi lan kham pha bao total > 100, tuc qua nhieu
 * de lay het trong mot lan. Luc nay loc o nguon moi hop ly - tra tim nguoi it
 * lien quan nhat, khong phai tra bo sot nguoi.
 *
 * level tra ve 422 (xac minh bang curl that), nen cap bac VAN dung SENIOR
 * trong currentTitle nhu truoc, khong doi.
 *
 * CHI gui nhung tham so da duoc xac minh la SignalHire hieu: currentCompany,
 * size, excludeRevealed, location, currentTitle, keywords. `department` da bi
 * bo han - xem ghi chu dai o dau file: mot gia tri khong nam trong danh muc
 * cua ho lam CA request tra 422, va khi lan thu hep that bai thi location cung
 * chet theo, nen bo loc dia diem PIC chon khong bao gio duoc ap dung.
 *
 * Mot tham so sai o day khong hong mot minh no. No hong CA lan goi, va lan goi
 * do la lan DUY NHAT co bo loc dia diem - do la ly do cho nay chi duoc chua
 * nhung gi da kiem, khong chua gi de doan.
 */
function dieuKienThuHep(
  company: string,
  // CO Y KHONG nhan `roles`: tham so nay tung duoc gui di duoi dang
  // `department` va lam ca lan goi tra 422 (xem ghi chu o dau file). De no
  // ngoai chu ky ham nghia la khong ai vo tinh gui lai duoc.
  opts: { region: string; keywords: string },
): Record<string, unknown> {
  const hqOnly = opts.region === 'Group headquarters';
  const q: Record<string, unknown> = {
    currentCompany: company, size: PROFILES_PER_CALL, excludeRevealed: true,
  };

  const vung = timVung(opts.region);
  const loc = vung?.nuoc ?? null;
  if (!hqOnly && loc && loc.length) q.location = loc;

  q.currentTitle = hqOnly ? HQ : SENIOR;

  // keywords la truong tu do PIC go (xem SearchForm.tsx) - gui NGUYEN VAN,
  // PIC duoc dung ca OR/AND/ngoac vi day la cu phap truy van cua SignalHire.
  const kw = opts.keywords?.trim();
  if (kw) q.keywords = kw;

  return q;
}

/**
 * searchByQuery tra ve experience[].title, KHONG co co current va khong co ngay
 * bat dau. Endpoint reveal thi lai dung position. Doc nham la chuc danh null het
 * va diem xep hang bang 0, da dinh mot lan roi.
 */
function toCandidate(p: any, wantCompany: string): Candidate | null {
  const uid = p?.uid;
  const name = p?.fullName ?? p?.full_name;
  if (!uid || !name) return null;

  const exp: any[] = Array.isArray(p.experience) ? p.experience : [];
  const want = nameKey(wantCompany);

  // Nguoi ta liet ke ca cong ty cu. Lay dong khop dung cong ty vua tim truoc,
  // khong thay thi moi lay dong dau; lay bua dong dau la gan cho ho mot chuc
  // danh o noi lam viec cu.
  let cur: any = null;
  if (want) {
    cur = exp.find((e) => e && nameKey(String(e.company ?? '')) === want)
      ?? exp.find((e) => e && nameKey(String(e.company ?? '')).includes(want))
      ?? null;
  }
  if (!cur) cur = exp[0] ?? {};

  return {
    external_uid: String(uid),
    full_name: String(name),
    job_title: cur.title ?? cur.position ?? p.headLine ?? null,
    company: cur.company ?? wantCompany ?? null,
    location: p.location ?? null,
    years_in_role: null,          // endpoint nay khong tra ngay thang
    open_to_work: Boolean(p.openToWork),
    industry: null,
    skills: Array.isArray(p.skills) ? p.skills.map(String) : null,
    // Giu CA danh sach kinh nghiem (khong chi dong hien tai) de lib/rank.ts
    // doi chieu voi keywords/title cua PIC tren CA qua khu.
    experience: exp.map((e) => ({
      company: e?.company != null ? String(e.company) : null,
      title: (e?.title ?? e?.position) != null ? String(e.title ?? e.position) : null,
    })),
    raw: p,
  };
}

/**
 * Mot lan goi searchByQuery. Khong biet gi ve alias hay fallback.
 *
 * total la so THAT SignalHire bao (xac minh bang curl that: ten cong ty bia
 * dat ra total 0, Masan Consumer ra total 1020) - dang tin duoc, khac voi
 * profiles.length von bi cham size. Thieu total (vi du fixture cu trong test)
 * thi lui ve profiles.length, de khong lam hong cac test da co tu truoc.
 */
async function goiMotLan(apikey: string, query: Record<string, unknown>, company: string) {
  let res: Response;
  try {
    res = await goiSignalHire(`${API}/candidate/searchByQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey },
      body: JSON.stringify(query),
    });
  } catch (e: any) {
    return { candidates: [] as Candidate[], total: null as number | null,
      problem: { status: 0, message: String(e?.message ?? 'network error') } };
  }

  if (!res.ok) {
    // Giu nguyen ma so. 429 la cham tran ngay, 401 la sai credential, 402 co the
    // la ca hai tuy cau chu ho tra ve. Ba chuyen do hau qua khac han nhau nen
    // khong duoc gop thanh mot loi chung chung.
    const text = await res.text().catch(() => '');
    // SignalHire tra loi duoi khoa `error`, KHONG phai `message` (xac minh tu
    // dong that trong job.error hom nay: {"error":"Only three requests are
    // allowed at the same time"}). Doc nham khoa lam ca cau bao loi roi ve
    // nguyen khoi JSON tho thay vi cau chu nguoi doc duoc.
    let msg = text;
    try {
      const parsed = JSON.parse(text);
      msg = parsed?.message ?? parsed?.error ?? text;
    } catch { /* giu nguyen text */ }
    return { candidates: [] as Candidate[], total: null as number | null,
      problem: { status: res.status, message: String(msg).slice(0, 300) } };
  }

  const body: any = await res.json().catch(() => ({}));
  const profiles: any[] = Array.isArray(body?.profiles) ? body.profiles : [];
  const total = Number.isFinite(Number(body?.total)) ? Number(body.total) : profiles.length;
  return {
    candidates: profiles.map((p) => toCandidate(p, company)).filter((c): c is Candidate => c !== null),
    total,
    problem: null,
  };
}

/**
 * Tim mot cong ty, theo thiet ke HAI LAN GOI dua tren total.
 *
 * Nguyen tac chi dao: bo loc de THU HEP mot tap ket qua LON. Cong ty it nguoi
 * thi PIC muon thay HET, khong phan biet chuc danh/vung/chuc nang - xep hang
 * sap xep lai, khong bao gio loai bo.
 *
 *   total === 0   : khong co trong chi muc SignalHire. KHONG goi lan hai -
 *                   noi rong ra (bo loc) khong lam cong ty xuat hien them.
 *   total <= 100  : da co het trong lan kham pha. Khong goi lan hai; cap bac/
 *                   vung/keywords/department chi con la dau vao xep hang.
 *   total > 100   : qua nhieu de lay het. Goi lan hai co loc (dieuKienThuHep).
 */
async function timMotCongTy(
  apikey: string,
  company: string,
  opts: { region: string; roles: string[]; keywords: string },
): Promise<CongTyResult> {
  const kham = await goiMotLan(apikey, dieuKienKhamPha(company), company);

  if (kham.problem) {
    return { company, total: null, candidates: [], calls: 1, outcome: 'error', filterSkipped: false, problem: kham.problem };
  }
  if (kham.total === 0) {
    return { company, total: 0, candidates: [], calls: 1, outcome: 'not_found', filterSkipped: false, problem: null };
  }
  if (kham.total !== null && kham.total <= PROFILES_PER_CALL) {
    // filterSkipped: false. Cong ty nho thi CO Y khong loc gi ca, khong co
    // buoc nao bi bo qua, va man ket qua da noi dung dieu do ("everyone in
    // SignalHire's index for this company") - khong ai bi noi sai o nhanh nay.
    return { company, total: kham.total, candidates: kham.candidates, calls: 1, outcome: 'all_shown', filterSkipped: false, problem: null };
  }

  const hep = await goiMotLan(apikey, dieuKienThuHep(company, opts), company);
  if (hep.problem) {
    // Lan thu hep hong: dung tam thoi ket qua kham pha (100 nguoi dau) con hon
    // tra ve tay khong - KHONG loai nguoi nao di, dung bat bien cua he thong.
    //
    // Nhung phai danh dau filterSkipped: true. Danh sach dang tra ve la 100 nguoi
    // DAU TIEN cua chi muc toan cau, khong lien quan gi den vung PIC chon; goi
    // no la "narrowed at the source" la noi sai. KHONG goi lai lan nua o day:
    // moi lan goi an mot luot trong tran 300 brand/ngay cua ca team, va
    // CALLS_PER_COMPANY_WORST_CASE trong lib/scanQuota.ts uoc luong toi da hai
    // lan moi cong ty - them lan thu ba lam cai chan tran do dem thieu, tuc ca
    // team co the bi khoa 24 tieng.
    return { company, total: kham.total, candidates: kham.candidates, calls: 2, outcome: 'narrowed', filterSkipped: true, problem: hep.problem };
  }
  return { company, total: kham.total, candidates: hep.candidates, calls: 2, outcome: 'narrowed', filterSkipped: false, problem: null };
}

/**
 * Tim nguoi cua mot brand, tim CA MOI cong ty da mapped (chu so huu, nha
 * phan phoi...), roi tim lai bang chinh ten brand neu TAT CA deu that su
 * khong co trong chi muc (total === 0), khong phai chi vi profiles rong.
 *
 * Truoc day chi tim CONG TY DAU TIEN trong danh sach mapped, du bang alias
 * cho phep mot alias tro toi nhieu cong ty (khoa (alias, employer), khong
 * phai (alias)) va man hinh xem truoc (resolveBrands) da tung hien "Searching
 * X OR Y cho Brand". Preview hua nhieu hon nhung gi lan tim that su lam. Gio
 * tim tat ca, gop ket qua (khu trung theo external_uid) - preview va lan tim
 * that su dong y voi nhau.
 *
 * Vi sao can lan tim lai theo TEN BRAND. Bang alias ghi chu so huu chu khong
 * ghi phap nhan ma nguoi ta khai tren ho so. Vi du co that ngay 09/09: alias
 * dior tro toi "LVMH Vietnam", khong mot ai khai cong ty la LVMH Vietnam, nen
 * Dior tra ve 0 nguoi. Cung luc do PIC tu go "Parfums Christian Dior" thi ra
 * 20 nguoi, trong do co hai nguoi o TP HCM.
 *
 * Truoc day dieu kien thu lai la "profiles rong" - de bi danh lua boi bo loc
 * qua chat (currentTitle luon co, xem CLAUDE.md/bao cao B1). Gio dieu kien la
 * total === 0 cua LAN KHAM PHA (khong loc gi), nen chi that su thu lai khi
 * cong ty do KHONG co trong chi muc SignalHire, khong phai vi bo loc trung.
 *
 * Chi doi DUNG MOT bien: ten cong ty. Vung va chuc danh giu nguyen. Noi long
 * nhieu thu cung luc thi ket qua ve mot dong nguoi khong lien quan, ma khong ai
 * biet vi sao.
 *
 * Moi lan goi (moi cong ty mapped, moi cong ty co the goi 1 hoac 2 lan, cong ca
 * lan tim lai) deu an mot luot brand trong tran 300 mot ngay, nen tra ve calls
 * de cho goi ghi dung so vao dong ho - xem lib/scanQuota.ts ve uoc luong TRUOC
 * khi biet 1 hay 2 lan.
 */
export async function searchBrand(opts: {
  apikey: string;
  brand: string;
  tier: number;
  aliases: Map<string, string[]>;
  region: string;
  roles: string[];
  keywords: string;
}): Promise<BrandResult> {
  const mappedList = opts.aliases.get(nameKey(opts.brand));
  const mapped = Boolean(mappedList && mappedList.length);
  const congTyChinh = mapped ? mappedList! : [opts.brand];

  const nen = {
    brand: opts.brand, tier: opts.tier, mapped,
    aliasCompany: mapped ? congTyChinh[0] : null,
  };

  let calls = 0;
  let loiCuoi: { status: number; message: string } | null = null;
  const daThay = new Set<string>();
  const gop: Candidate[] = [];
  const ketQuaCongTy: CongTyResult[] = [];

  for (const company of congTyChinh) {
    const r = await timMotCongTy(opts.apikey, company, opts);
    calls += r.calls;
    ketQuaCongTy.push(r);
    if (r.problem) loiCuoi = r.problem;
    for (const c of r.candidates) {
      if (daThay.has(c.external_uid)) continue;
      daThay.add(c.external_uid);
      gop.push(c);
    }
  }

  // Tong hop total/outcome qua moi cong ty da thu - xem BrandResult.total.
  const tongTotal = ketQuaCongTy.some((r) => r.total != null)
    ? ketQuaCongTy.reduce((n, r) => n + (r.total ?? 0), 0)
    : null;
  const tatCaKhongThay = ketQuaCongTy.length > 0 && ketQuaCongTy.every((r) => r.outcome === 'not_found');

  // Chi mot cong ty le ra phai loc ma khong loc duoc la ca brand phai bao
  // chua loc: ung vien cua no da tron vao chung mot danh sach, va PIC khong
  // the biet dong nao den tu dau.
  const boQuaLoc = ketQuaCongTy.some((r) => r.filterSkipped);
  const gomOutcome: BrandResult['outcome'] = tatCaKhongThay
    ? 'not_found'
    : ketQuaCongTy.some((r) => r.outcome === 'narrowed')
      ? 'narrowed'
      : ketQuaCongTy.some((r) => r.outcome === 'all_shown')
        ? 'all_shown'
        : 'error';

  if (gop.length > 0) {
    // loiCuoi, KHONG hardcode null: truoc day dong nay luon ghi null vi voi
    // thiet ke MOT lan goi cu, "co candidate" va "khong loi" la cung mot su
    // that. Thiet ke hai lan goi lam dieu do sai - lan kham pha co the thanh
    // cong (co candidate de fallback) trong khi lan thu hep that bai rieng,
    // va ban cu se NUOT mat loi do, khong bao gio toi duoc job.error hay
    // thong bao (day chinh la ly do khong tim thay dong job/notification nao
    // nhac "SHEGLAM" kem loi, du 20 nguoi da hien ra dung nhu ket qua fallback
    // cua lan kham pha).
    return {
      ...nen, company: congTyChinh[0], fellBack: false, calls,
      candidates: gop, problem: loiCuoi, total: tongTotal, outcome: gomOutcome,
      filterSkipped: boQuaLoc,
    };
  }

  // Thu lai theo TEN BRAND chi khi TAT CA cong ty da mapped that su khong co
  // trong chi muc (total === 0 cua lan kham pha) - khong phai chi vi ra rong
  // sau loc, vi lan kham pha khong loc gi ca nen "ra rong" da co nghia "khong
  // co that".
  const tenThuong = opts.brand.trim();
  const dangThuLai = mapped && tenThuong && tatCaKhongThay
    && !congTyChinh.some((c) => nameKey(c) === nameKey(tenThuong));

  if (!dangThuLai) {
    return {
      ...nen, company: congTyChinh[0], fellBack: false, calls,
      candidates: [], problem: loiCuoi, total: tongTotal, outcome: gomOutcome,
      filterSkipped: boQuaLoc,
    };
  }

  const lan2 = await timMotCongTy(opts.apikey, tenThuong, opts);
  calls += lan2.calls;

  // Lan tim lai hong thi bao cao nhu mot lan tim binh thuong khong thay, KHONG
  // bao loi. Cac lan truoc da chay tron ven va ket luan "khong co ai" van dung.
  if (lan2.problem) {
    return {
      ...nen, company: congTyChinh[0], fellBack: false, calls,
      candidates: [], problem: null, total: tongTotal, outcome: gomOutcome,
      filterSkipped: boQuaLoc,
    };
  }

  return {
    ...nen,
    company: lan2.candidates.length > 0 ? tenThuong : congTyChinh[0],
    fellBack: lan2.candidates.length > 0,
    calls,
    candidates: lan2.candidates,
    problem: null,
    total: lan2.total,
    outcome: lan2.outcome,
    filterSkipped: lan2.filterSkipped,
  };
}

export type Revealed = {
  uid: string;
  name: string;
  title: string | null;
  /** Cong ty dang lam. Dung de doan brand khi PIC chi dan link LinkedIn. */
  company: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  location: string | null;
  bio: string | null;
};

/**
 * withoutWaterfall: chi lay du lieu SignalHire da co san, khong di doi vong qua
 * cac nguon khac. Nhanh hon va khong phat sinh chi phi ngoai du kien.
 */
export async function revealUids(apikey: string, uids: string[]) {
  let res: Response;
  try {
    // goiSignalHire, KHONG goi fetch() thang: reveal dung CHUNG mot khoa API
    // (va CHUNG gioi han 3 dong thoi) voi searchByQuery, xem ghi chu o
    // goiSignalHire(). Mot lan reveal hang loat (nhieu uid mot luc, van la MOT
    // request nen khong tu no vuot gioi han) chay dung luc mot PIC khac dang
    // quet thi hai duong nay PHAI cung xep hang, khong duoc tu do tin rieng no
    // con duoi 3.
    res = await goiSignalHire(`${API}/candidate/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey },
      body: JSON.stringify({ items: uids, withoutWaterfall: true }),
    });
  } catch (e: any) {
    // Cung mot dang tra ve nhu goiMotLan(): loi mang o day khong duoc nem ra
    // ngoai. reveal/route.ts da co san nhanh xu ly !out.ok goi releaseCredit -
    // nem thay vi tra ve se lam credit_ledger ket lai o 'reserved' vinh vien,
    // vi khong con cho nao doc duoc loi de tra tien lai.
    return {
      ok: false as const, status: 0,
      message: String(e?.message ?? 'network error'), people: [],
    };
  }

  if (!res.ok) {
    // Cung mot loi voi goiMotLan(): SignalHire tra loi duoi khoa `error`,
    // KHONG phai `message` (xac minh tu dong that trong job.error).
    const text = await res.text().catch(() => '');
    let msg = text;
    try {
      const parsed = JSON.parse(text);
      msg = parsed?.message ?? parsed?.error ?? text;
    } catch { /* giu nguyen text */ }
    return { ok: false as const, status: res.status, message: String(msg).slice(0, 300), people: [] };
  }

  const rows: any[] = await res.json().catch(() => []);
  const people: Revealed[] = [];

  for (const r of Array.isArray(rows) ? rows : []) {
    if (r?.status !== 'success' || !r?.candidate) continue;
    const c = r.candidate;

    const list: any[] = Array.isArray(c.contacts) ? c.contacts : [];
    const emails = list.filter((x) => x?.type === 'email');
    const phones = list.filter((x) => x?.type === 'phone');

    const exp: any[] = Array.isArray(c.experience) ? c.experience : [];
    const cur = exp.find((e) => e?.current) ?? exp[0] ?? {};
    const li = (Array.isArray(c.social) ? c.social : []).find((s: any) => s?.type === 'li');

    // Giu ca nguoi khong co email lan dien thoai. SignalHire van tra ve ten,
    // chuc danh va LinkedIn, va BD lien he qua LinkedIn duoc. Vut di la mat mot
    // nguoi that ma credit thi da tra roi.
    people.push({
      uid: String(c.uid ?? r.item ?? ''),
      name: String(c.fullName ?? ''),
      title: cur.position ?? cur.title ?? c.headLine ?? null,
      company: cur.company ?? null,
      email: (emails.find((e) => e.subType === 'work') ?? emails[0])?.value ?? null,
      phone: (phones.find((p) => p.subType === 'work_phone')
        ?? phones.find((p) => p.subType === 'mobile') ?? phones[0])?.value ?? null,
      linkedin: li?.link ?? null,
      location: c.locations?.[0]?.name ?? null,
      bio: c.headLine ?? null,
    });
  }

  return { ok: true as const, status: 200, message: '', people };
}
