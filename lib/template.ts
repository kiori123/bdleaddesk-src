/**
 * Dien cho trong trong mau thu outreach.
 *
 * Mot ban duy nhat, dung chung cho ca man soan mau lan nut Email o trang brand.
 * Tach lam hai ban la man xem thu hien mot dang con thu that di mot dang khac,
 * ma khong co gi bao.
 */

export type TruongMau = {
  key: string;
  nhan: string;
  /** Truong nay hay rong, canh bao nguoi soan. */
  hayRong?: boolean;
  /**
   * Rong thi KHONG chan gui.
   *
   * Chi dung cho truong ma rong la mot trang thai hop le chu khong phai thieu
   * du lieu. {{files}} la vi du: mau khong dinh kem file nao thi dong do bien
   * mat, do la y muon chu khong phai loi.
   */
  khongChan?: boolean;
};

/**
 * Danh sach cho trong. Them mot dong o day la man soan tu co them nut chen.
 * Khong co bang thu hai nao phai sua theo.
 */
export const TRUONG: TruongMau[] = [
  { key: 'first_name', nhan: 'Tên gọi người nhận' },
  { key: 'full_name', nhan: 'Họ tên đầy đủ' },
  { key: 'job_title', nhan: 'Chức danh', hayRong: true },
  { key: 'company', nhan: 'Tên công ty (theo LinkedIn)', hayRong: true },
  { key: 'brand', nhan: 'Tên brand' },
  { key: 'location', nhan: 'Nơi làm việc', hayRong: true },
  { key: 'bio', nhan: 'Dòng giới thiệu', hayRong: true },
  { key: 'sender_name', nhan: 'Tên người gửi' },
  { key: 'sender_email', nhan: 'Email người gửi' },
  { key: 'files', nhan: 'Link file đính kèm', khongChan: true },
];

const KHONG_CHAN = new Set(TRUONG.filter((t) => t.khongChan).map((t) => t.key));

export type NguonDL = Record<string, string | null | undefined>;

// Ho pho bien cua nguoi Viet, da bo dau. Dung de biet ho nam dau hay cuoi.
const HO_VIET = new Set([
  'nguyen', 'tran', 'le', 'pham', 'hoang', 'huynh', 'phan', 'vu', 'vo', 'dang',
  'bui', 'do', 'ho', 'ngo', 'duong', 'ly', 'dinh', 'mai', 'truong', 'ta', 'luu',
  'chu', 'trinh', 'cao', 'thai', 'kieu', 'ha', 'quach', 'ton', 'ong', 'lam',
]);

const khongDau = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase();

/**
 * Ten de goi trong cau chao.
 *
 * Day la cho de sai nhat trong ca man nay, va sai thi khach hang doc thay.
 * Du lieu that trong bang co du kieu: "Tien Tran (Millie)", "Siriporn H.",
 * "Hoang Anh Pham, ACMA, CGMA, CPA (Aust.)". Lay bua tu cuoi cung se ra
 * "(Millie)", "H." va "(Aust.)".
 *
 * Bon buoc:
 *   1. Bo phan trong ngoac, ke ca ngoac toan giac cua tieng Trung
 *   2. Cat tu dau phay tro di, do la chuoi bang cap chu khong phai ten
 *   3. Bo cac tu chi la chu cai viet tat kieu "H."
 *   4. Nhin xem HO nam o dau
 *
 * Buoc 4 la buoc quan trong. Nguoi Viet viet ten theo hai kieu, va hai kieu cho
 * ket qua nguoc nhau:
 *   "Nguyen Thi Ngoc Anh"  ho dung truoc  -> ten goi la tu CUOI  (Anh)
 *   "Khanh Minh Tran"      ho dung sau    -> ten goi la tu DAU   (Khanh)
 * Lay bua mot phia la mot nua so nguoi bi goi bang ho.
 */
export function tenGoi(hoTen: string | null | undefined) {
  let s = String(hoTen ?? '');
  s = s.replace(/[（(][^）)]*[）)]/g, ' ');  // bo ngoac
  s = s.split(',')[0];                       // cat bang cap
  const t = s.trim().split(/\s+/)
    .filter(Boolean)
    .filter((w) => !/^\p{L}\.?$/u.test(w));  // bo chu cai viet tat

  if (!t.length) return '';
  if (t.length === 1) return t[0];

  const dau = khongDau(t[0]);
  const cuoi = khongDau(t[t.length - 1]);

  // Ho dung truoc: lay tu cuoi.
  if (HO_VIET.has(dau) && !HO_VIET.has(cuoi)) return t[t.length - 1];
  // Ho dung sau: lay tu dau.
  if (HO_VIET.has(cuoi) && !HO_VIET.has(dau)) return t[0];

  // Khong nhan ra ho o phia nao. Ten Tay gan nhu luon la ten goi truoc, ho sau,
  // nen lay tu dau. Do cung la lua chon it thiet hai hon: goi nguoi Tay bang
  // ten rieng la binh thuong, con goi nguoi Viet bang ho thi nghe rat la.
  return t[0];
}

const MAU_CHO_TRONG = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** Cho trong nao co trong mau. Tra ve theo thu tu xuat hien, khong trung. */
export function choTrongTrongMau(text: string): string[] {
  const ra: string[] = [];
  for (const m of String(text ?? '').matchAll(MAU_CHO_TRONG)) {
    if (!ra.includes(m[1])) ra.push(m[1]);
  }
  return ra;
}

/**
 * Dien mau.
 *
 * KHONG bao gio de lai chuoi "{{bio}}" trong ket qua, va cung khong am tham
 * thay bang chuoi rong. Ca hai deu di thang ra hop thu khach hang: mot cai la
 * ky tu la, mot cai la mot lo hong giua cau. Truong nao thieu thi tra ve trong
 * `thieu` de goi tu quyet dinh, va man hinh se chan nut gui.
 */
export function dienMau(text: string, dl: NguonDL) {
  const thieu: string[] = [];
  const ra = String(text ?? '').replace(MAU_CHO_TRONG, (_m, key: string) => {
    const v = dl[key];
    const s = v == null ? '' : String(v).trim();
    if (!s) {
      // Truong duoc phep rong thi bien mat gon gang, khong chan gui va khong
      // de lai dau vet. Mau khong co file dinh kem la chuyen binh thuong.
      if (KHONG_CHAN.has(key)) return '';
      if (!thieu.includes(key)) thieu.push(key);
      // Giu nguyen cho trong de nguoi soan nhin thay no nam o dau trong cau.
      return `{{${key}}}`;
    }
    return s;
  });
  // Truong rong bi go co the de lai mot dong trong lo lung giua thu.
  return { text: ra.replace(/\n{3,}/g, '\n\n'), thieu };
}

/** Gom du lieu cua mot contact thanh nguon dien mau. */
export function nguonTuContact(o: {
  full_name?: string | null;
  job_title?: string | null;
  company?: string | null;
  location?: string | null;
  bio?: string | null;
  brand?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  /** Cac file da bat co chia se cua mau dang dung. */
  files?: { name: string; url: string }[] | null;
}): NguonDL {
  return {
    first_name: tenGoi(o.full_name),
    full_name: o.full_name ?? '',
    job_title: o.job_title ?? '',
    company: o.company ?? '',
    brand: o.brand ?? '',
    location: o.location ?? '',
    bio: o.bio ?? '',
    sender_name: o.senderName ?? '',
    sender_email: o.senderEmail ?? '',
    files: (o.files ?? []).map((f) => `${f.name}: ${f.url}`).join('\n'),
  };
}

/**
 * Duong dan mo Outlook da dien san.
 *
 * Noi dung di kem trong duong dan nen co tran. Chrome chiu duoc khoang 32k ky
 * tu, nhung mot so proxy cua doanh nghiep cat o 2k va cat KHONG BAO GI CA:
 * thu mo ra cut mat doan cuoi ma nguoi gui khong biet. Nen chan o day va noi
 * ra, thay vi de no am tham hong.
 */
export const TRAN_DUONG_DAN = 1800;

export function duongDanOutlook(to: string, subject: string, body: string, cc = '') {
  const dsCc = String(cc ?? '').split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const cot = `https://outlook.office.com/mail/deeplink/compose`
    + `?to=${encodeURIComponent(to)}`
    + (dsCc.length ? `&cc=${encodeURIComponent(dsCc.join(','))}` : '')
    + `&subject=${encodeURIComponent(subject)}`
    + `&body=${encodeURIComponent(body)}`;
  return { url: cot, qua_dai: encodeURIComponent(body).length > TRAN_DUONG_DAN };
}

/**
 * Ban day du de dan tay vao Outlook.
 *
 * Ly do ton tai: duong dan o tren KHONG dinh kem duoc file, va se khong bao gio
 * dinh duoc. Khong mot cach mo san hop soan thu nao qua duong dan lam duoc viec
 * do, trinh duyet khong duoc phep gan file vao thu ho nguoi dung. CC thi di
 * duoc nhung chinh dien dan cua Microsoft ghi nhan la thinh thoang khong dien
 * vao, nhat la khi phien dang nhap vua het han.
 *
 * Nen ai can gui kem ho so nang luc, hoac can chac chan CC dung nguoi, thi
 * chep cai nay roi tu soan trong Outlook. Cham hon mot buoc, doi lai khong co
 * gioi han nao.
 */
export function banDeChep(to: string, cc: string, subject: string, body: string) {
  const dong = [`To: ${to}`];
  if (cc.trim()) dong.push(`Cc: ${cc.trim()}`);
  dong.push(`Subject: ${subject}`, '', body);
  return dong.join('\n');
}

/** Mau khoi dau cho PIC moi, de khong ai phai nhin mot o trong. */
export const MAU_KHOI_DAU = {
  name: 'Standard outreach',
  cc: '',
  subject: 'Partnership Opportunity with {{brand}}',
  body: `Hi {{first_name}},

I am {{sender_name}} from OnPoint E-Commerce in Vietnam. We run end to end e-commerce for international brands on Shopee, Lazada and TikTok Shop, from store operations to marketing and fulfilment.

I am reaching out because {{brand}} looks well placed for the Vietnamese market, and as {{job_title}} you would be the right person to talk to.

Would you be open to a 15 minute call to see whether there is a fit?

Best regards,
{{sender_name}}
{{sender_email}}`,
};
