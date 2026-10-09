import { test } from 'node:test';
import assert from 'node:assert/strict';

import { demNguoi, khoaLinkedin, maNguoiTheoDong, manhNhanDang } from '../lib/contactIdentity';

// Bang `contact` la (nguoi x brand). Mot nguoi phu trach nhieu brand chiem
// nhieu dong, va do la DUNG - xem ghi chu dau lib/contactIdentity.ts. Nhung
// bao cao phai doc ra so NGUOI, khong duoc doc so dong thanh so nguoi.

const r = (id: string, x: Partial<{ external_uid: string | null; linkedin_url: string | null; email: string | null }> = {}) =>
  ({ id, external_uid: null, linkedin_url: null, email: null, ...x });

test('cung external_uid o hai brand van la mot nguoi', () => {
  // Truong hop that: mot nguoi o cong ty me dong thoi la dau moi cua brand con.
  const rows = [r('1', { external_uid: 'abc' }), r('2', { external_uid: 'abc' })];
  assert.equal(demNguoi(rows), 1);
});

test('gop bac cau: dong co uid+linkedin keo dong chi co linkedin ve cung nguoi', () => {
  // Day la cho mot phien ban "uu tien uid > linkedin > email" sai im lang:
  // dong A lay khoa "u:abc", dong B lay khoa "l:...", hoa ra hai nguoi. Tren
  // DB that co 22 dong khong he co external_uid nhung van co linkedin_url.
  const rows = [
    r('A', { external_uid: 'abc', linkedin_url: 'https://www.linkedin.com/in/nguyen-van-a' }),
    r('B', { linkedin_url: 'https://linkedin.com/in/nguyen-van-a/' }),
  ];
  assert.equal(demNguoi(rows), 1);
});

test('gop bac cau qua email: A-uid+email, B-email+linkedin, C-linkedin la mot nguoi', () => {
  const rows = [
    r('A', { external_uid: 'u1', email: 'an.nguyen@brand.vn' }),
    r('B', { email: 'an.nguyen@brand.vn', linkedin_url: 'https://www.linkedin.com/in/an-nguyen-99' }),
    r('C', { linkedin_url: 'https://vn.linkedin.com/in/an-nguyen-99?originalSubdomain=vn' }),
  ];
  assert.equal(demNguoi(rows), 1);
});

test('LinkedIn URL duoc chuan hoa truoc khi so', () => {
  // Cung mot profile duoc dan vao duoi rat nhieu dang. Khong chuan hoa thi
  // moi dang thanh mot "nguoi".
  const dang = [
    'https://www.linkedin.com/in/abc-123',
    'http://linkedin.com/in/abc-123/',
    'https://vn.linkedin.com/in/abc-123?originalSubdomain=vn',
    'LINKEDIN.COM/in/abc-123#about',
  ];
  const rows = dang.map((u, i) => r(String(i), { linkedin_url: u }));
  assert.equal(demNguoi(rows), 1);
});

test('external_uid luu chinh duong link van gop duoc voi dong mang uid hex', () => {
  // Mot so dong cu luu duong link da dan vao thang o o external_uid.
  const rows = [
    r('cu', { external_uid: 'https://www.linkedin.com/in/abc-123' }),
    r('moi', { external_uid: 'deadbeef', linkedin_url: 'https://linkedin.com/in/abc-123' }),
  ];
  assert.equal(demNguoi(rows), 1);
});

test('hop thu dung chung cua cong ty KHONG duoc gop hai nguoi', () => {
  // info@/sales@/cskh@ la hop thu chung. Gop theo no la lam so NGUOI be di
  // ma khong co gi bao - sai nguy hiem hon bo sot mot cap trung.
  for (const chung of ['info@brand.vn', 'sales@brand.vn', 'cskh@brand.vn', 'kinh.doanh@brand.vn']) {
    const rows = [r('1', { email: chung }), r('2', { email: chung })];
    assert.equal(demNguoi(rows), 2, `${chung} khong duoc lam khoa nhan dang`);
  }
  // Email ca nhan thi van gop binh thuong.
  const rows = [r('1', { email: 'thuy.vu@brand.vn' }), r('2', { email: 'Thuy.Vu@Brand.VN' })];
  assert.equal(demNguoi(rows), 1);
});

test('dong khong co gi nhan dang thi moi dong la mot nguoi rieng', () => {
  // Huong an toan: tha dem thua mot nguoi con hon gop nham hai nguoi.
  const rows = [r('1'), r('2'), r('3')];
  assert.equal(demNguoi(rows), 3);
  assert.deepEqual(manhNhanDang(rows[0]), []);
});

test('chuoi rong va khoang trang khong phai la mot manh nhan dang', () => {
  const rows = [r('1', { external_uid: '  ', linkedin_url: '', email: '   ' }), r('2', { external_uid: '' })];
  assert.equal(demNguoi(rows), 2);
});

test('linkedin_url khong phai profile thi khong lam khoa', () => {
  // Trang cong ty, khong phai nguoi. Hai dong tro ve cung trang cong ty
  // KHONG phai cung mot nguoi.
  const rows = [
    r('1', { linkedin_url: 'https://www.linkedin.com/company/onpoint' }),
    r('2', { linkedin_url: 'https://www.linkedin.com/company/onpoint' }),
  ];
  assert.equal(demNguoi(rows), 2);
});

test('maNguoiTheoDong tra ve mot ma cho moi dong, dong cung nguoi an chung ma', () => {
  const rows = [
    r('A', { external_uid: 'u1' }),
    r('B', { external_uid: 'u1' }),
    r('C', { external_uid: 'u2' }),
  ];
  const ma = maNguoiTheoDong(rows);
  assert.equal(ma.size, 3);
  assert.equal(ma.get('A'), ma.get('B'));
  assert.notEqual(ma.get('A'), ma.get('C'));
});

test('tap rong va mot dong duy nhat khong lam ham vo', () => {
  assert.equal(demNguoi([]), 0);
  assert.equal(demNguoi([r('1', { external_uid: 'x' })]), 1);
});

// --- khoaLinkedin: dung CHUNG voi app/api/reveal/route.ts de biet mot duong
// link PIC dan vao da co contact chua (dan lai thi phai mien phi). Mot ban thu
// hai cua phep chuan hoa nay se lech ma khong co gi bao.

test('URL ma hoa %XX va ban chu that cua cung profile ra cung mot khoa', () => {
  // Trinh duyet copy link profile Viet Nam ra dang da ma hoa, con SignalHire
  // tra ve dang chu that. Khong giai ma thi hai dang cua CUNG mot nguoi thanh
  // hai nguoi - tren du lieu that day dung la phan khong tim ra contact.
  const maHoa = 'https://www.linkedin.com/in/nguy%E1%BB%85n-v%C4%83n-a-000000000/?isSelfProfile=true';
  const chuThat = 'https://vn.linkedin.com/in/nguyễn-văn-a-000000000';
  assert.equal(khoaLinkedin(maHoa), khoaLinkedin(chuThat));
  assert.notEqual(khoaLinkedin(maHoa), null);
});

test('dau tieng Viet to hop va dung san ra cung mot khoa', () => {
  const dungSan = 'https://vn.linkedin.com/in/đỗ-thị-b-111111111'.normalize('NFC');
  const toHop = 'https://vn.linkedin.com/in/đỗ-thị-b-111111111'.normalize('NFD');
  assert.notEqual(dungSan, toHop);   // hai chuoi nhin y het nhau nhung khac byte
  assert.equal(khoaLinkedin(dungSan), khoaLinkedin(toHop));
});

test('URL ma hoa hong khong lam vo ham, chi tra ve khoa theo chuoi goc', () => {
  // decodeURIComponent nem loi voi mot dau % don le. Mot URL la khong duoc
  // lam hong ca lan reveal.
  assert.doesNotThrow(() => khoaLinkedin('https://www.linkedin.com/in/abc%-123'));
  assert.notEqual(khoaLinkedin('https://www.linkedin.com/in/abc%-123'), null);
});

test('hai nguoi khac nhau khong bao gio ra cung mot khoa LinkedIn', () => {
  // Day la dieu kien de duong "dan lai link thi mien phi" an toan: khop nham
  // nguoi khac se lam app bo qua mot lan tinh tien that.
  //
  // Hai dang hay gap nhat cua mot slug: ho-ten kem hau to, va mot slug dat
  // theo san pham/cong ty. Hai cai do phai luon khac khoa nhau.
  assert.notEqual(
    khoaLinkedin('https://www.linkedin.com/in/nguyen-van-a-b244a6145'),
    khoaLinkedin('https://www.linkedin.com/in/example-beverage-supplier'),
  );
});

test('chuoi khong phai LinkedIn tra ve null, khong doan bua', () => {
  assert.equal(khoaLinkedin('https://facebook.com/someone'), null);
  assert.equal(khoaLinkedin('abc123def'), null);
  assert.equal(khoaLinkedin(''), null);
  assert.equal(khoaLinkedin(null), null);
});
