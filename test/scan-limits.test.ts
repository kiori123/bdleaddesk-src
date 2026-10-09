import { test } from 'node:test';
import assert from 'node:assert/strict';

import { catTheoBrand, MAX_PROFILE_MOI_BRAND } from '../lib/scanLimits';

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
