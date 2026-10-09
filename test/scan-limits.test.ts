import { test } from 'node:test';
import assert from 'node:assert/strict';

import { catTheoBrand, chayTheoTho, MAX_PROFILE_MOI_BRAND } from '../lib/scanLimits';

// Phep cat nay giau 59% so dong scan_candidate tren du lieu that (11.071 /
// 18.716). Sai mot cai la PIC mat nguoi ma khong co gi bao, nen no duoc test
// rieng chu khong nam lan trong server action.

const p = (brand_name: string, ten: string) => ({ brand_name, ten });

/** N nguoi cua mot brand, danh so 1..N de kiem duoc thu tu giu lai. */
const nhom = (brand: string, n: number) =>
  Array.from({ length: n }, (_, i) => p(brand, `${brand}-${i + 1}`));

test('brand it hon tran thi giu nguyen het', () => {
  const ds = nhom('A', 5);
  const { hien, tongTheoBrand } = catTheoBrand(ds, 20);
  assert.equal(hien.length, 5);
  assert.deepEqual(tongTheoBrand, { A: 5 });
});

test('brand dung bang tran thi khong cat, va khong bao thua', () => {
  const ds = nhom('A', 20);
  const { hien, tongTheoBrand } = catTheoBrand(ds, 20);
  assert.equal(hien.length, 20);
  assert.equal(tongTheoBrand.A, 20);
  // Man hinh chi hien "top N of M" khi M > N - o day hai so bang nhau nen
  // khong duoc hien gi them.
  assert.equal(tongTheoBrand.A > hien.length, false);
});

test('brand vuot tran: giu dung N NGUOI DAU, khong phai N nguoi bat ky', () => {
  // Thu tu vao da la trong-vung-truoc roi den diem. Giu nham nguoi la dua
  // nguoi kem hon len man hinh va vut nguoi tot nhat di.
  const ds = nhom('A', 63);
  const { hien, tongTheoBrand } = catTheoBrand(ds, 20);
  assert.equal(hien.length, 20);
  assert.equal(tongTheoBrand.A, 63);
  assert.deepEqual(hien.map((c) => c.ten).slice(0, 3), ['A-1', 'A-2', 'A-3']);
  assert.equal(hien[19].ten, 'A-20');
});

test('nhieu brand XEN KE nhau van cat dung tung brand', () => {
  // xepTrongVungLenTruoc sap TOAN CUC theo inRegion, khong gom theo brand, nen
  // danh sach vao that su xen ke. Cat mot lat theo vi tri se cat nham brand.
  const ds = [
    p('A', 'a1'), p('B', 'b1'), p('A', 'a2'), p('B', 'b2'),
    p('A', 'a3'), p('B', 'b3'), p('A', 'a4'),
  ];
  const { hien, tongTheoBrand } = catTheoBrand(ds, 2);
  assert.deepEqual(hien.map((c) => c.ten), ['a1', 'b1', 'a2', 'b2']);
  assert.deepEqual(tongTheoBrand, { A: 4, B: 3 });
});

test('thu tu tuong doi cua danh sach vao duoc giu nguyen', () => {
  // Ham KHONG duoc tu sap lai: man hinh dua vao thu tu nay de ke duong
  // "Outside <vung>" o dung mot cho duy nhat.
  const ds = [p('A', 'x'), p('B', 'y'), p('A', 'z')];
  const { hien } = catTheoBrand(ds, 20);
  assert.deepEqual(hien.map((c) => c.ten), ['x', 'y', 'z']);
});

test('tongTheoBrand dem CA nguoi bi cat, khong phai so nguoi hien ra', () => {
  // Day la ca ly do truong nay ton tai: khong co no thi mot danh sach dung 20
  // nguoi doc giong het mot brand chi co 20 nguoi.
  const ds = [...nhom('A', 100), ...nhom('B', 3)];
  const { hien, tongTheoBrand } = catTheoBrand(ds, 20);
  assert.equal(hien.filter((c) => c.brand_name === 'A').length, 20);
  assert.equal(hien.filter((c) => c.brand_name === 'B').length, 3);
  assert.deepEqual(tongTheoBrand, { A: 100, B: 3 });
});

test('danh sach rong khong lam vo ham', () => {
  const { hien, tongTheoBrand } = catTheoBrand([], 20);
  assert.deepEqual(hien, []);
  assert.deepEqual(tongTheoBrand, {});
});

test('ten brand rong van la mot nhom rieng, khong bi gop vao brand khac', () => {
  const ds = [p('', 'k1'), p('', 'k2'), p('A', 'a1')];
  const { hien, tongTheoBrand } = catTheoBrand(ds, 1);
  assert.deepEqual(hien.map((c) => c.ten), ['k1', 'a1']);
  assert.equal(tongTheoBrand[''], 2);
});

test('ten brand trung voi thuoc tinh san cua Object khong lam hong phep dem', () => {
  // tongTheoBrand la object thuong, nen mot brand ten "constructor" hay
  // "toString" se dung phai thuoc tinh ke thua neu dem bang `?? 0` tren mot
  // object co prototype. Kiem that de biet phep dem khong ra NaN hay vo.
  const ds = [p('constructor', 'c1'), p('constructor', 'c2'), p('toString', 't1')];
  const { hien, tongTheoBrand } = catTheoBrand(ds, 1);
  assert.equal(tongTheoBrand['constructor'], 2);
  assert.equal(tongTheoBrand['toString'], 1);
  assert.deepEqual(hien.map((c) => c.ten), ['c1', 't1']);
});

test('tran mac dinh la MAX_PROFILE_MOI_BRAND, va dang la 20', () => {
  // Con so PIC chon. Doi thi doi o lib/scanLimits.ts, khong rai rac trong JSX.
  assert.equal(MAX_PROFILE_MOI_BRAND, 20);
  const { hien } = catTheoBrand(nhom('A', 50));
  assert.equal(hien.length, MAX_PROFILE_MOI_BRAND);
});

// --- chayTheoTho: han chot cho mot lan quet ---------------------------------
//
// Truoc day scan bung het brand bang Promise.all roi de hang doi 3-dong-thoi
// ben trong tu chen. Vuot maxDuration (60s) la job ket o 'running' VINH VIEN,
// khong ai biet vi sao. Cai chan nay bien no thanh xuong thang em: brand chua
// kip bat dau roi vao `notRun`, man ket qua noi ro, PIC quet lai.

/** Dong ho gia: chi nhich khi minh bao nhich. */
function dongHo(batDau = 0) {
  let t = batDau;
  return { now: () => t, nhich: (ms: number) => { t += ms; } };
}

test('chua qua han thi lam het moi viec', async () => {
  const dh = dongHo();
  const r = await chayTheoTho([1, 2, 3, 4, 5], async (n) => n * 2,
    { hanChot: 1000, soTho: 3, now: dh.now });
  assert.deepEqual(r.xong.sort((a, b) => a - b), [2, 4, 6, 8, 10]);
  assert.deepEqual(r.quaGio, []);
});

test('qua han giua chung: viec con lai vao quaGio, khong mat cai nao', async () => {
  const dh = dongHo();
  const r = await chayTheoTho([1, 2, 3, 4, 5, 6], async (n) => {
    dh.nhich(400);          // moi viec ton 400ms theo dong ho gia
    return n;
  }, { hanChot: 1000, soTho: 1, now: dh.now });

  // Tong so vao luon bang tong so ra: khong duoc nuot brand nao.
  assert.equal(r.xong.length + r.quaGio.length, 6);
  assert.ok(r.xong.length > 0, 'phai lam duoc it nhat mot viec truoc khi het gio');
  assert.ok(r.quaGio.length > 0, 'phai bo lai phan chua kip');
  // Thu tu giu nguyen: phan lam duoc la phan dau danh sach.
  assert.deepEqual([...r.xong, ...r.quaGio], [1, 2, 3, 4, 5, 6]);
});

test('da qua han ngay tu dau thi khong goi SignalHire lan nao', async () => {
  // Quan trong: moi lan goi an mot luot trong tran 300 brand/ngay cua ca team.
  const dh = dongHo(5000);
  let soLanGoi = 0;
  const r = await chayTheoTho([1, 2, 3], async (n) => { soLanGoi++; return n; },
    { hanChot: 1000, soTho: 3, now: dh.now });
  assert.equal(soLanGoi, 0);
  assert.deepEqual(r.xong, []);
  assert.deepEqual(r.quaGio, [1, 2, 3]);
});

test('viec DA bat dau duoc chay cho xong, khong cat ngang', async () => {
  // Cat giua chung se vut di mot lan goi SignalHire da tieu luot roi.
  const dh = dongHo();
  let xongHan = false;
  const r = await chayTheoTho([1], async () => {
    dh.nhich(10_000);       // chay qua han chot
    xongHan = true;
    return 'xong';
  }, { hanChot: 1000, soTho: 3, now: dh.now });
  assert.equal(xongHan, true);
  assert.deepEqual(r.xong, ['xong']);
  assert.deepEqual(r.quaGio, []);
});

test('so tho khong vuot so viec, va khong bao gio bang 0', async () => {
  // soTho = 0 se tao ra khong tho nao va treo vinh vien.
  const r = await chayTheoTho([1, 2], async (n) => n, { hanChot: Number.MAX_SAFE_INTEGER, soTho: 0 });
  assert.deepEqual(r.xong.sort(), [1, 2]);
  const rong = await chayTheoTho([], async (n) => n, { hanChot: Number.MAX_SAFE_INTEGER, soTho: 3 });
  assert.deepEqual(rong.xong, []);
  assert.deepEqual(rong.quaGio, []);
});

test('nhieu tho chay that su song song, khong noi duoi nhau', async () => {
  let dangChay = 0, dinhCao = 0;
  await chayTheoTho([1, 2, 3, 4, 5, 6], async (n) => {
    dangChay++; dinhCao = Math.max(dinhCao, dangChay);
    await new Promise((r) => setTimeout(r, 5));
    dangChay--; return n;
  }, { hanChot: Number.MAX_SAFE_INTEGER, soTho: 3 });
  assert.equal(dinhCao, 3, 'phai co dung 3 viec chay cung luc');
});

test('mot viec nem loi thi loi noi ra, khong nuot', async () => {
  // Nuot loi o day la bao "quet xong" trong khi mot brand that bai.
  await assert.rejects(
    () => chayTheoTho([1, 2], async (n) => { if (n === 2) throw new Error('SignalHire 429'); return n; },
      { hanChot: Number.MAX_SAFE_INTEGER, soTho: 2 }),
    /SignalHire 429/,
  );
});
