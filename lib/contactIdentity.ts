/**
 * Mot noi DUY NHAT tra loi cau "hai dong contact nay co phai CUNG MOT NGUOI
 * khong".
 *
 * Vi sao can: bang `contact` la (nguoi x brand), khong phai (nguoi). Mot nguoi
 * that su xuat hien NHIEU LAN la chuyen binh thuong va DUNG - PIC can biet ai
 * la dau moi cho brand nao, va mot nguoi o cong ty me thuong phu trach nhieu
 * brand con. Da xac minh tren DB that: 13 trong 14 cap trung la cung mot nguoi
 * nam o mot cong ty me VA o brand con cua no (Tan Phu Plastic/Inochi, Xuong
 * Giang Paper/Posy, Fani/TopGia, Sunlight/Vim - hai brand Unilever). Xoa mot
 * trong hai la mat duong lien he cua mot brand.
 *
 * Nhung bao cao thi KHONG duoc coi do la hai nguoi. "993 leads" nghe nhu 993
 * con nguoi, thuc te la 981. Nen o day tach hai con so, khong hop nhat du lieu:
 * so DONG giu nguyen de PIC dung, so NGUOI tinh qua ham nay de bao cao.
 *
 * Cach gop: THANH PHAN LIEN THONG, khong phai khoa uu tien.
 *
 * Mot phien ban "uu tien uid > linkedin > email" nghe don gian hon nhung sai
 * mot cach im lang: dong A co uid=X va linkedin=L, dong B chi co linkedin=L
 * (uid rong) - A lay khoa "u:X", B lay khoa "l:L", hai nguoi. Tren DB that
 * truong hop nay CO: 971/993 dong co external_uid, 22 dong khong, va nhieu
 * dong trong so do van co linkedin_url. Noi tat ca cac manh nhan dang cua
 * cung mot dong lai voi nhau roi lay thanh phan lien thong thi A va B ve
 * chung mot nhom bat ke dong nao thieu truong gi.
 *
 * KHONG dung phone lam khoa nhan dang. Tong dai cong ty dung chung: tren DB
 * that co mot nguoi dung chung mot so dien thoai tren bon brand khac nhau, va
 * hai nguoi khac nhau o cung mot cong ty cung se trung so do. Mot khoa gop
 * nham thi khong co gi bao - no chi lam so NGUOI be di.
 *
 * KHONG dung ten lam khoa nhan dang. Ten Viet Nam trung nhau rat nhieu: tren
 * DB that co 35 nhom trung ten tuyet doi, phan lon la nguoi khac nhau o cac
 * brand khac nhau.
 */

/** Chuan hoa email. Khac hoa thuong khong tao ra nguoi moi. */
function khoaEmail(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim().toLowerCase();
  if (!s || !s.includes('@')) return null;

  // Dia chi dung chung cua ca cong ty KHONG duoc lam khoa nhan dang: no gop
  // hai nguoi that su khac nhau thanh mot. Sai theo huong nay nguy hiem hon
  // sai theo huong kia - bo sot mot cap trung chi lam so NGUOI nhinh len,
  // con gop nham thi lam no be di va khong cach nao phat hien.
  const local = s.split('@')[0].replace(/[._-]/g, '');
  const DUNG_CHUNG = new Set([
    'info', 'contact', 'sales', 'hello', 'admin', 'support', 'office',
    'marketing', 'cskh', 'kinhdoanh', 'hr', 'tuyendung', 'care', 'service',
    'enquiry', 'enquiries', 'inquiry', 'team', 'mail', 'email', 'no', 'noreply',
  ]);
  if (DUNG_CHUNG.has(local)) return null;

  return 'e:' + s;
}

/**
 * Chuan hoa LinkedIn URL ve dang so sanh duoc.
 *
 * Cung mot profile duoc dan vao duoi rat nhieu dang: co/khong https, co/khong
 * www, co/khong dau / cuoi, kem ?originalSubdomain=vn (rat hay gap voi
 * profile Viet Nam), hoac tien to quoc gia vn.linkedin.com. Khong chuan hoa
 * thi moi dang la mot "nguoi".
 */
export function khoaLinkedin(raw: string | null | undefined): string | null {
  let s = (raw ?? '').trim();
  if (!s) return null;

  // Giai ma %XX TRUOC khi so. Trinh duyet copy link profile Viet Nam ra dang
  // da ma hoa ("b%E1%BA%A3o-tr%C3%A2m"), trong khi SignalHire tra ve dang chu
  // that ("bao-tram" co dau). Khong giai ma thi hai dang cua CUNG mot nguoi
  // thanh hai nguoi. Da do tren du lieu that: trong 107 duong link da dan,
  // phan khong tim ra contact deu roi vao dang nay.
  //
  // decodeURIComponent nem loi voi chuoi %XX hong (vi du mot dau % don le),
  // nen phai boc - mot URL la khong duoc lam hong ca lan reveal.
  try { s = decodeURIComponent(s); } catch { /* giu nguyen chuoi goc */ }

  // Dau tieng Viet co hai cach ma hoa Unicode (dung san va to hop). NFC dua
  // ca hai ve mot dang, neu khong thi hai chuoi nhin y het nhau van khac nhau.
  s = s.normalize('NFC').toLowerCase();

  s = s.replace(/^https?:\/\//, '').replace(/^[a-z]{2,3}\./, '').replace(/^www\./, '');
  s = s.split('?')[0].split('#')[0].replace(/\/+$/, '');
  if (!s.includes('linkedin.com/')) return null;

  // Chi giu phan dinh danh (vd "in/abc-123"), bo ten mien va moi thu sau do.
  const m = s.match(/linkedin\.com\/(in|pub|profile)\/([^/]+)/);
  if (!m) return null;
  return 'l:' + m[2];
}

/** Chuan hoa uid cua SignalHire. */
function khoaUid(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim().toLowerCase();
  if (!s) return null;

  // Mot so dong cu luu CHINH duong link da dan vao o o external_uid thay vi
  // uid hex cua SignalHire. Quy chung ve khoa linkedin de no gop duoc voi dong
  // mang uid hex that cua cung nguoi do.
  if (s.startsWith('http')) return khoaLinkedin(s);
  return 'u:' + s;
}

/** Du lieu toi thieu de nhan dang mot dong contact. */
export type CoTheNhanDang = {
  id: string;
  external_uid?: string | null;
  linkedin_url?: string | null;
  email?: string | null;
};

/** Moi manh nhan dang cua MOT dong, da chuan hoa. Rong = khong nhan dang duoc. */
export function manhNhanDang(c: CoTheNhanDang): string[] {
  return [
    khoaUid(c.external_uid),
    khoaLinkedin(c.linkedin_url),
    khoaEmail(c.email),
  ].filter((x): x is string => x != null);
}

/**
 * Gan cho moi dong mot ma NGUOI. Hai dong cung ma = cung mot con nguoi.
 *
 * Dong khong co manh nhan dang nao (khong uid, khong linkedin, khong email
 * rieng) duoc tinh la MOT nguoi rieng, lay chinh id cua no lam ma. Day la
 * huong an toan: tha dem thua mot nguoi con hon gop nham hai nguoi lam mot.
 */
export function maNguoiTheoDong(rows: CoTheNhanDang[]): Map<string, string> {
  // Union-find tren tap "id cua dong" + "manh nhan dang".
  const cha = new Map<string, string>();
  const goc = (x: string): string => {
    let r = cha.get(x);
    if (r == null) { cha.set(x, x); return x; }
    while (r !== cha.get(r)) r = cha.get(r)!;
    cha.set(x, r);
    return r;
  };
  const noi = (a: string, b: string) => {
    const ra = goc(a), rb = goc(b);
    if (ra !== rb) cha.set(ra, rb);
  };

  for (const c of rows) {
    goc(c.id);
    for (const m of manhNhanDang(c)) noi(c.id, m);
  }

  const ra = new Map<string, string>();
  for (const c of rows) ra.set(c.id, goc(c.id));
  return ra;
}

/** So CON NGUOI trong mot tap dong contact (khac so dong khi mot nguoi o nhieu brand). */
export function demNguoi(rows: CoTheNhanDang[]): number {
  const ma = maNguoiTheoDong(rows);
  return new Set(ma.values()).size;
}
