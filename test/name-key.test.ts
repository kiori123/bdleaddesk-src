import { test } from 'node:test';
import assert from 'node:assert/strict';

import { nameKey } from '../lib/nameKey';
import { gomAliasTheoUuTien } from '../lib/signalhire';

/**
 * Bo doi chieu duoi day KHONG phai bia ra: cot `alias` la gia tri that dang
 * nam trong bang brand_alias tren production (bo alias goc duoc nap voi dau
 * cau da thay bang khoang trang), cot ten la cach PIC go vao o Brand.
 *
 * Truoc khi sua, moi cap trong bang nay khong khop nhau, nen app bo qua alias
 * va di tim dung ten dong san pham lam ten cong ty.
 */
const THAT: { ten: string; alias: string; employer: string }[] = [
  { ten: "L'Oreal Paris",  alias: 'l oreal paris',   employer: "L'Oreal Vietnam" },
  { ten: "Kiehl's",        alias: 'kiehl s',         employer: "L'Oreal Vietnam" },
  { ten: 'La Roche-Posay', alias: 'la roche posay',  employer: "L'Oreal Vietnam" },
  { ten: "Lay's",          alias: 'lay s',           employer: 'PepsiCo Foods Vietnam' },
  { ten: "Pond's",         alias: 'pond s',          employer: 'Unilever Vietnam' },
  { ten: "McDonald's",     alias: 'mcdonald s',      employer: "McDonald's Vietnam" },
  { ten: "Domino's Pizza", alias: 'domino s pizza',  employer: "Domino's Pizza Vietnam" },
  { ten: "Biti's",         alias: 'biti s',          employer: 'Binh Tien Dong Nai' },
  { ten: "Nature's Way",   alias: 'nature s way',    employer: "Nature's Way Vietnam" },
  { ten: "Johnson's Baby", alias: 'johnson s baby',  employer: 'Kenvue Vietnam' },
  { ten: "Wall's",         alias: 'wall s',          employer: 'Unilever Vietnam' },
  { ten: "Beck's",         alias: 'beck s',          employer: 'AB InBev Vietnam' },
  { ten: "Koala's March",  alias: 'koala s march',   employer: 'Lotte Vietnam' },
  { ten: "M&M's",          alias: 'm m s',           employer: 'Mars Vietnam' },
  { ten: 'P/S',            alias: 'p s',             employer: 'Unilever Vietnam' },
];

test('brand co dau cau tra ra dung alias cua no', () => {
  const aliases = gomAliasTheoUuTien(THAT.map((r) => ({ alias: r.alias, employer: r.employer })));

  for (const r of THAT) {
    assert.deepEqual(
      aliases.get(nameKey(r.ten)) ?? null, [r.employer],
      `"${r.ten}" phai tra ra ${r.employer} (alias luu la "${r.alias}")`,
    );
  }
});

test('ten go kieu nao cung ve mot khoa', () => {
  // Cung mot brand, nam cach go ma nguoi that dung.
  const kieu = ["L'Oreal Paris", 'L Oreal Paris', "l'oreal  paris", 'LOREAL PARIS  ', "L’Oreal Paris'"];
  const khoa = new Set(kieu.map(nameKey));
  // "LOREAL PARIS" khong co cho tach chu nen ra "loreal paris", khac that su -
  // day la gioi han da biet cua phep chuan hoa nay, khong phai loi.
  assert.deepEqual([...khoa].sort(), ['l oreal paris', 'loreal paris']);

  // Dau nhay thang va dau nhay cong (U+2019, cai Word tu doi) phai bang nhau:
  // PIC dan ten tu file Excel thi hay ra dau cong.
  assert.equal(nameKey("Kiehl's"), nameKey('Kiehl’s'));
  assert.equal(nameKey('Chin-su'), nameKey('Chin Su'));
  assert.equal(nameKey('Dr.Melaxin'), nameKey('Dr. Melaxin'));
});

test('bo dau tieng Viet va giu chu cua he chu viet khac', () => {
  assert.equal(nameKey('Cỏ Cây Hoa Lá ( Ona Global )'), 'co cay hoa la ona global');
  assert.equal(nameKey('ĐẶNG GIA'), 'dang gia');

  // \p{L}\p{N} chu khong phai a-z0-9: category China Project co the co ten chu
  // Han, va a-z0-9 se bien no thanh chuoi rong - tuc brand khong co khoa.
  assert.equal(nameKey('美的 Midea'), '美的 midea');
  assert.notEqual(nameKey('美的'), '');
});

test('khoa khong bao gio co dau cau hay khoang trang thua', () => {
  for (const t of [
    "Asia Master Trade Co.,Ltd.", 'RITA FOOD & DRINK CO.', 'Goo:by',
    '  --- Brand  X ---  ', "O'food", 'Axix-Y',
  ]) {
    const k = nameKey(t);
    assert.ok(!/[^\p{L}\p{N} ]/u.test(k), `${t} -> "${k}" con dau cau`);
    assert.ok(!/\s{2}|^\s|\s$/.test(k), `${t} -> "${k}" con khoang trang thua`);
  }
  assert.equal(nameKey('Asia Master Trade Co.,Ltd.'), 'asia master trade co ltd');
  assert.equal(nameKey('  --- Brand  X ---  '), 'brand x');
});

test('nameKey chiu duoc dau vao rong va rac', () => {
  assert.equal(nameKey(''), '');
  assert.equal(nameKey('   '), '');
  assert.equal(nameKey('---'), '');
  assert.equal(nameKey(null as unknown as string), '');
  assert.equal(nameKey(undefined as unknown as string), '');
});
