import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';

import { canUseCategory } from '../lib/credit';
import { makeFakeDb, type Fixture } from './fakeDb';

/**
 * userA so huu catA, userB so huu catB. inactivePic co dong profile_category
 * tro toi catB nhung profile da bi khoa (active: false) - dung de test rieng
 * nhanh "PIC" cua canUseCategory cung phai bi active chan lai, khong chi
 * nhanh admin. inactiveAdmin la admin nhung bi khoa, KHONG co dong
 * profile_category nao ca - dung de test nhanh admin cung bi active chan.
 */
const fixture: Fixture = {
  profiles: [
    { id: 'userA', role: 'pic', active: true },
    { id: 'userB', role: 'pic', active: true },
    { id: 'admin1', role: 'admin', active: true },
    { id: 'inactivePic', role: 'pic', active: false },
    { id: 'inactiveAdmin', role: 'admin', active: false },
  ],
  profileCategories: [
    { profile_id: 'userA', category_id: 'catA' },
    { profile_id: 'userB', category_id: 'catB' },
    { profile_id: 'inactivePic', category_id: 'catB' },
  ],
};

function db() {
  return makeFakeDb(fixture) as unknown as SupabaseClient;
}

function readSource(relPath: string) {
  return readFileSync(new URL(relPath, import.meta.url), 'utf8');
}

test("user A reveals under user B's category -> rejected", async () => {
  // /api/reveal goi canUseCategory(db, user.id, categoryId) truoc damBaoBrand
  // va truoc khi tao job - day chinh la dieu kien quyet dinh 403 cua duong do.
  const allowed = await canUseCategory(db(), 'userA', 'catB');
  assert.equal(allowed, false);
});

test("user A scans under user B's category -> rejected", async () => {
  // /api/scan goi CUNG mot ham voi cung tham so, truoc khi cham vao SignalHire.
  const allowed = await canUseCategory(db(), 'userA', 'catB');
  assert.equal(allowed, false);
});

test("free seed_verified reveal (amount = 0) under user B's category -> rejected", async () => {
  // canUseCategory khong biet gi ve amount/source - phai luon tra ve false
  // cho (userA, catB) bat ke duong goi la reveal tra tien hay mien phi.
  const allowed = await canUseCategory(db(), 'userA', 'catB');
  assert.equal(allowed, false);

  // Khong the goi that /api/reveal tu day (can Next.js runtime, phien dang
  // nhap, DB that). Thay vao do, kiem thu tu bang doc source: check phai nam
  // TRUOC damBaoBrand va TRUOC ca job insert lan "if (amount > 0)", khong
  // duoc nam trong nhanh amount > 0 nhu truoc khi sua - do dung la cho reveal
  // mien phi tung lot qua.
  const src = readSource('../app/api/reveal/route.ts');
  const idxCheck = src.indexOf('canUseCategory(db, user.id, categoryId)');
  const idxDamBaoBrand = src.indexOf('await damBaoBrand(tenBrand)');
  const idxJobInsert = src.indexOf("kind: 'reveal',");
  const idxAmountGate = src.indexOf('if (amount > 0) {');

  assert.ok(idxCheck > -1, 'khong tim thay canUseCategory(...) trong reveal/route.ts');
  assert.ok(idxDamBaoBrand > -1, 'khong tim thay damBaoBrand(...) trong reveal/route.ts');
  assert.ok(idxJobInsert > -1, 'khong tim thay job insert trong reveal/route.ts');
  assert.ok(idxAmountGate > -1, 'khong tim thay "if (amount > 0)" trong reveal/route.ts');

  assert.ok(idxCheck < idxDamBaoBrand, 'canUseCategory phai chay TRUOC damBaoBrand');
  assert.ok(idxCheck < idxJobInsert, 'canUseCategory phai chay TRUOC khi tao job');
  assert.ok(idxCheck < idxAmountGate, 'canUseCategory phai chay KHONG DIEU KIEN, truoc "if (amount > 0)"');
});

test("free scan request under user B's category -> the guard must run before SignalHire and before any write", async () => {
  // /api/scan khong co khai niem "amount", nhung co CUNG mot rui ro: check
  // phai nam truoc lan goi SignalHire dau tien va truoc ban ghi dau tien
  // (job insert), khong duoc de lot ai do them logic truoc no roi quen dat
  // check len dau.
  const allowed = await canUseCategory(db(), 'userA', 'catB');
  assert.equal(allowed, false);

  const src = readSource('../app/api/scan/route.ts');
  const idxCheck = src.indexOf('canUseCategory(db, user.id, categoryId)');
  const idxSignalHireCall = src.indexOf('dsBrand.map((b: any) => searchBrand(');
  const idxJobInsert = src.indexOf("kind: 'search', status: 'queued'");

  assert.ok(idxCheck > -1, 'khong tim thay canUseCategory(...) trong scan/route.ts');
  assert.ok(idxSignalHireCall > -1, 'khong tim thay lan goi searchBrand(...) trong scan/route.ts');
  assert.ok(idxJobInsert > -1, 'khong tim thay job insert trong scan/route.ts');

  assert.ok(idxCheck < idxSignalHireCall, 'canUseCategory phai chay TRUOC lan goi SignalHire dau tien');
  assert.ok(idxCheck < idxJobInsert, 'canUseCategory phai chay TRUOC ban ghi dau tien (job insert)');
});

test('a deactivated PIC with a valid profile_category row -> rejected', async () => {
  // inactivePic THAT SU co dong profile_category tro toi catB - chi bi active:
  // false chan lai.
  const allowed = await canUseCategory(db(), 'inactivePic', 'catB');
  assert.equal(allowed, false);
});

test('a deactivated admin with no profile_category row -> rejected', async () => {
  // role = 'admin' nhung active = false, va khong co dong profile_category
  // nao. Truoc buoc 2 (Step 2 cua phien truoc), nhanh admin cua
  // canUseCategory chi kiem role === 'admin' && profile.active - da dung -
  // nhung bai test nay chua ton tai. Them de khoa lai hanh vi: mat active la
  // mat quyen, du la admin.
  const allowed = await canUseCategory(db(), 'inactiveAdmin', 'catA');
  assert.equal(allowed, false);
});
