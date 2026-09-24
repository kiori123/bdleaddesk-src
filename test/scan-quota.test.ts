import { test } from 'node:test';
import assert from 'node:assert/strict';

import { planScan, resetsAtFromPeriodStart, type BrandReq } from '../lib/scanQuota';

const brand = (name: string): BrandReq => ({ name, tier: 1 });
const costOfBrand1 = () => 1; // khong brand nao co alias trong cac test nay
const RESET = '2026-09-11T00:00:00.000Z'; // gia tri co dinh, khong quan trong noi dung that
const CAP = 8; // = MAX_BRAND_MOI_LAN cua scan/route.ts

test('request fitting within what remains -> scans normally, no prompt', () => {
  const plan = planScan({
    brands: [brand('A'), brand('B'), brand('C')],
    costOfBrand: costOfBrand1,
    quota: { brandRemaining: 10, profileRemaining: 1000 },
    maxBrandsPerRequest: CAP,
    resetsAt: RESET,
  });
  assert.equal(plan.status, 'fits');
  assert.equal(plan.toScan.length, 3);
});

test('request exceeding what remains -> confirm payload, nothing scanned', () => {
  const plan = planScan({
    brands: [brand('A'), brand('B'), brand('C'), brand('D'), brand('E')],
    costOfBrand: costOfBrand1,
    quota: { brandRemaining: 3, profileRemaining: 1000 },
    maxBrandsPerRequest: CAP,
    resetsAt: RESET,
  });
  assert.equal(plan.status, 'confirm');
  if (plan.status !== 'confirm') return;
  assert.equal(plan.asked, 5);
  // Dung 3 cai DAU TIEN theo thu tu da gui, khong phai chon ngau nhien.
  assert.deepEqual(plan.wouldScanNames, ['A', 'B', 'C']);
});

test('confirmed follow-up request (trimmed list resubmitted) -> scans, rechecked fresh', () => {
  // Khong co "trang thai confirm" nao duoc luu server-side. Lan gui lai chi
  // la MOT loi goi planScan khac, voi danh sach da rut gon va mot quota MOI
  // doc lai. O day gia dinh khong ai khac tieu gi them: cung ket qua nhu se
  // xay ra neu request goc chi gui dung 3 brand nay ngay tu dau.
  const plan = planScan({
    brands: [brand('A'), brand('B'), brand('C')],
    costOfBrand: costOfBrand1,
    quota: { brandRemaining: 3, profileRemaining: 1000 },
    maxBrandsPerRequest: CAP,
    resetsAt: RESET,
  });
  assert.equal(plan.status, 'fits');
});

test('remaining drops between warning and confirmation -> confirmed request is trimmed further, never overshoots', () => {
  const first = planScan({
    brands: [brand('A'), brand('B'), brand('C'), brand('D'), brand('E')],
    costOfBrand: costOfBrand1,
    quota: { brandRemaining: 3, profileRemaining: 1000 },
    maxBrandsPerRequest: CAP,
    resetsAt: RESET,
  });
  assert.equal(first.status, 'confirm');
  if (first.status !== 'confirm') return;
  assert.deepEqual(first.wouldScanNames, ['A', 'B', 'C']);

  // PIC bam "Scan these 3 now", gui lai [A, B, C] - nhung giua luc do dong
  // nghiep da tieu bot, remaining rot xuong 2. Lan goi thu hai nay PHAI tu
  // doc quota MOI (khong tin gi tu lan truoc) va khong bao gio vuot qua 2.
  const second = planScan({
    brands: [brand('A'), brand('B'), brand('C')],
    costOfBrand: costOfBrand1,
    quota: { brandRemaining: 2, profileRemaining: 1000 },
    maxBrandsPerRequest: CAP,
    resetsAt: RESET,
  });
  assert.equal(second.status, 'confirm');
  if (second.status !== 'confirm') return;
  assert.equal(second.toScan.length, 2);
  assert.deepEqual(second.wouldScanNames, ['A', 'B']);
});

test('zero brand slots remaining -> blocked (no confirmation prompt)', () => {
  const plan = planScan({
    brands: [brand('A')],
    costOfBrand: costOfBrand1,
    quota: { brandRemaining: 0, profileRemaining: 1000 },
    maxBrandsPerRequest: CAP,
    resetsAt: RESET,
  });
  assert.equal(plan.status, 'blocked');
});

test('zero profile slots remaining -> blocked (no confirmation prompt)', () => {
  const plan = planScan({
    brands: [brand('A')],
    costOfBrand: costOfBrand1,
    quota: { brandRemaining: 10, profileRemaining: 0 },
    maxBrandsPerRequest: CAP,
    resetsAt: RESET,
  });
  assert.equal(plan.status, 'blocked');
});

test('request that exactly reaches the ceiling -> allowed', () => {
  const plan = planScan({
    brands: [brand('A'), brand('B'), brand('C')],
    costOfBrand: costOfBrand1,
    quota: { brandRemaining: 3, profileRemaining: 300 }, // 3 brand * 100 uoc/brand (PROFILES_PER_CALL) = 300, dung khop
    maxBrandsPerRequest: CAP,
    resetsAt: RESET,
  });
  assert.equal(plan.status, 'fits');
});

test('brands with an alias cost two slots, not one', () => {
  const aliased = new Set(['Chin-su']);
  const plan = planScan({
    brands: [brand('Chin-su'), brand('Omachi')],
    costOfBrand: (b) => (aliased.has(String(b.name)) ? 2 : 1),
    // Chin-su (2) + Omachi (1) = 3, vua dung 3
    quota: { brandRemaining: 3, profileRemaining: 1000 },
    maxBrandsPerRequest: CAP,
    resetsAt: RESET,
  });
  assert.equal(plan.status, 'fits');
});

test('profile estimate scales with costOfBrand, not a flat per-brand constant', () => {
  // Brand anh xa toi 2 cong ty (costOfBrand tra 4 = 2 cong ty x
  // CALLS_PER_COMPANY_WORST_CASE) phai xin gap doi profile-quota so voi mot
  // brand thuong (costOfBrand tra 2). Truoc day day la MOT hang so co dinh
  // cho moi brand - sai voi brand co alias tro toi nhieu hon mot cong ty, vi
  // no thuc su can goi SignalHire nhieu lan hon.
  const twoCompanies = planScan({
    brands: [brand('Multi-company brand')],
    costOfBrand: () => 4,
    // 4 luot * 100 (PROFILES_PER_CALL) = 400 dung khop. 399 thi phai chan lai.
    quota: { brandRemaining: 4, profileRemaining: 400 },
    maxBrandsPerRequest: CAP,
    resetsAt: RESET,
  });
  assert.equal(twoCompanies.status, 'fits');

  const notEnough = planScan({
    brands: [brand('Multi-company brand')],
    costOfBrand: () => 4,
    quota: { brandRemaining: 4, profileRemaining: 399 },
    maxBrandsPerRequest: CAP,
    resetsAt: RESET,
  });
  assert.equal(notEnough.status, 'blocked');
});

// --- D4: planScan phai biet MAX_BRAND_MOI_LAN, khong de scan/route.ts cat lan hai ---

test('quota allows more than the per-request cap -> confirm never proposes more than the cap', () => {
  // 10 brand, quota con du cho ca 10, nhung moi request toi da 8. Day KHONG
  // phai chuyen han muc ngay - co che notRun/conLai co san da xu ly viec nay,
  // nen KHONG duoc hien banner "confirm": status phai la 'fits' voi dung 8.
  const brands = Array.from({ length: 10 }, (_, i) => brand(String(i)));
  const plan = planScan({
    brands,
    costOfBrand: costOfBrand1,
    quota: { brandRemaining: 10, profileRemaining: 1000 },
    maxBrandsPerRequest: CAP,
    resetsAt: RESET,
  });
  assert.equal(plan.status, 'fits');
  assert.equal(plan.toScan.length, 8);
});

test('quota itself limits to more than the per-request cap -> proposal is capped at the cap, not the quota figure', () => {
  // 20 brand, han muc ngay cho phep toi 12 - NHIEU HON tran 8 moi request.
  // Neu chi xet han muc ngay thi se de xuat 12, nhung request nay chi bao
  // gio chay duoc toi da 8 - de xuat phai la 8, khong phai 12, neu khong
  // banner se hua nhieu hon nhung gi thuc su chay khi PIC bam xac nhan.
  const brands = Array.from({ length: 20 }, (_, i) => brand(String(i)));
  const plan = planScan({
    brands,
    costOfBrand: costOfBrand1,
    quota: { brandRemaining: 12, profileRemaining: 1000 },
    maxBrandsPerRequest: CAP,
    resetsAt: RESET,
  });
  // toiDaTheNay = min(20, 8) = 8; han muc ngay (12) khong phai ly do duy nhat
  // it hon 20 duoc chon (tran 8 moi request cung chan truoc do roi), nen day
  // van la 'fits' voi dung 8 - khong phai 'confirm' voi 12.
  assert.equal(plan.status, 'fits');
  assert.equal(plan.toScan.length, 8);
});

test('quota limits below the per-request cap -> confirm payload never exceeds what will actually run', () => {
  // 20 brand, han muc ngay chi cho 5 (it hon tran 8 moi request). Day MOI la
  // chuyen han muc ngay that su, va 5 <= 8 nen banner "Scan these 5 now" la
  // dung su that: xac nhan xong se chay dung 5, khong bi cat lan hai.
  const brands = Array.from({ length: 20 }, (_, i) => brand(String(i)));
  const plan = planScan({
    brands,
    costOfBrand: costOfBrand1,
    quota: { brandRemaining: 5, profileRemaining: 1000 },
    maxBrandsPerRequest: CAP,
    resetsAt: RESET,
  });
  assert.equal(plan.status, 'confirm');
  if (plan.status !== 'confirm') return;
  assert.equal(plan.toScan.length, 5);
  assert.ok(plan.toScan.length <= CAP, 'wouldScan khong duoc vuot qua MAX_BRAND_MOI_LAN');
});

// --- resetsAtFromPeriodStart: cong 1 ngay vao ky_bat_dau cua DB, khong tu --
// --- doan lai "bay gio la may gio o VN" -----------------------------------

test('resetsAtFromPeriodStart adds exactly one day, at 00:00 Vietnam time', () => {
  // ky_bat_dau = 2026-09-10 (00:00 VN ngay do). Ky tiep theo: 2026-09-11
  // 00:00 VN = 2026-09-10 17:00 UTC.
  assert.equal(resetsAtFromPeriodStart('2026-09-10'), '2026-09-10T17:00:00.000Z');
});

test('resetsAtFromPeriodStart rolls over month/year boundaries correctly', () => {
  // Thang 9 chi co 30 ngay - ky_bat_dau = 2026-09-30 phai lan sang 2026-10-01.
  assert.equal(resetsAtFromPeriodStart('2026-09-30'), '2026-09-30T17:00:00.000Z');
  // Cuoi nam: 2026-12-31 -> 2027-01-01 00:00 VN.
  assert.equal(resetsAtFromPeriodStart('2026-12-31'), '2026-12-31T17:00:00.000Z');
});

test('resetsAtFromPeriodStart rejects a malformed date rather than silently computing garbage', () => {
  assert.throws(() => resetsAtFromPeriodStart('not-a-date'));
  assert.throws(() => resetsAtFromPeriodStart('2026-09-10T00:00:00Z'));
});
