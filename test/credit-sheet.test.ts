import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';

import {
  veSheetCreditContacts, LAYOUT, MIN_CONTACT_XEP_HANG, MIN_BRAND_BAO_DONG,
  MIN_PAID_BRAND_DE_XEP_HANG,
  type CatRow, type ViTriRow, type BrandRong,
} from '../lib/creditSheet';
import { relativeLuminance } from '../lib/categoryPalette';

/**
 * Bo cuc sheet "Credit & Contacts" da hong HAI LAN lien tiep tren ban that ma
 * khong cach nao thay truoc:
 *
 *   1. Chu trong bieu do ra o vuong rong, vi container Linux cua Vercel khong
 *      co font (may Windows thi dep - do la ly do no thoat duoc lan kiem tra
 *      tai cho).
 *   2. Bo he so thu nho 0.5 lam anh cao 340px, phu tu dong 5 xuong dong 21 va
 *      de len tieu de bang o dong 20 lan cac o highlight o cot H.
 *
 * Ca hai lot qua vi khong ai kiem duoc bo cuc ma khong deploy roi mo file bang
 * mat. Cac test duoi day thay cho viec do.
 */

/**
 * So THAT tu production ngay 18/09/2026, da tach theo nguon. Dung so that vi
 * hai loi thong ke duoi day chi lo ra voi dung hinh dang du lieu nay.
 */
const CATS: CatRow[] = [
  { id: 'c1', name: 'F&B',           brands: 17, withContact: 16, noContact: 1, spend: 53,
    paid: 55, paidFull: 37, paidMailOnly: 12, paidPhoneOnly: 1, paidNeither: 5,  paidNeitherWithLinkedin: 5,  free: 0, paidVn: 55, paidVnEmpty: 7, paidNgoai: 1, paidNgoaiEmpty: 1 },
  { id: 'c2', name: 'Beauty',        brands: 34, withContact: 34, noContact: 0, spend: 31,
    paid: 82, paidFull: 12, paidMailOnly: 20, paidPhoneOnly: 2, paidNeither: 48, paidNeitherWithLinkedin: 38, free: 0, paidVn: 31, paidVnEmpty: 15, paidNgoai: 53, paidNgoaiEmpty: 36 },
  { id: 'c3', name: 'FMCG',          brands: 23, withContact: 23, noContact: 0, spend: 5,
    paid: 34, paidFull: 14, paidMailOnly: 9,  paidPhoneOnly: 2, paidNeither: 9,  paidNeitherWithLinkedin: 9,  free: 2, paidVn: 18, paidVnEmpty: 8, paidNgoai: 2, paidNgoaiEmpty: 1 },
  { id: 'c4', name: 'Health & EL',   brands: 4,  withContact: 4,  noContact: 0, spend: 4,
    paid: 5,  paidFull: 1,  paidMailOnly: 4,  paidPhoneOnly: 0, paidNeither: 0,  paidNeitherWithLinkedin: 0,  free: 0, paidVn: 3, paidVnEmpty: 0, paidNgoai: 0, paidNgoaiEmpty: 0 },
  { id: 'c5', name: 'Mom & Baby',    brands: 38, withContact: 38, noContact: 0, spend: 3,
    paid: 21, paidFull: 6,  paidMailOnly: 7,  paidPhoneOnly: 0, paidNeither: 8,  paidNeitherWithLinkedin: 8,  free: 42, paidVn: 17, paidVnEmpty: 8, paidNgoai: 1, paidNgoaiEmpty: 0 },
  { id: 'c6', name: 'China Project', brands: 1,  withContact: 1,  noContact: 0, spend: 1,
    paid: 1,  paidFull: 1,  paidMailOnly: 0,  paidPhoneOnly: 0, paidNeither: 0,  paidNeitherWithLinkedin: 0,  free: 0, paidVn: 0, paidVnEmpty: 0, paidNgoai: 1, paidNgoaiEmpty: 0 },
  { id: 'c7', name: 'Fashion',       brands: 0,  withContact: 0,  noContact: 0, spend: 0,
    paid: 0,  paidFull: 0,  paidMailOnly: 0,  paidPhoneOnly: 0, paidNeither: 0,  paidNeitherWithLinkedin: 0,  free: 0, paidVn: 0, paidVnEmpty: 0, paidNgoai: 0, paidNgoaiEmpty: 0 },
];

/** Bat bien: bon nhanh phai cong dung bang paid. Sai cho nay la moi con so sau do sai theo. */
test('fixture hop le: full + mailOnly + phoneOnly + neither === paid', () => {
  for (const c of CATS) {
    assert.equal(c.paidFull + c.paidMailOnly + c.paidPhoneOnly + c.paidNeither, c.paid, c.name);
    assert.ok(c.paidNeitherWithLinkedin <= c.paidNeither, c.name);
  }
});

/**
 * Phan tich nguyen nhan, cung la so THAT tu production 18/09/2026:
 * trong Viet Nam 36/122 rong (30%), ngoai Viet Nam 37/57 rong (65%), va
 * 33 trong so rong ngoai VN la Han Quoc.
 */
const VI_TRI: ViTriRow[] = [
  { key: 'vn', label: 'In Vietnam', paid: 122, empty: 36, full: 50, emptyWithLinkedin: 28, topNuoc: 'Viet Nam', topNuocEmpty: 36 },
  { key: 'ngoai', label: 'Outside Vietnam', paid: 57, empty: 37, full: 8, emptyWithLinkedin: 35, topNuoc: 'Republic of Korea', topNuocEmpty: 33 },
  { key: 'chuaBiet', label: 'No location recorded — left out of the comparison', paid: 22, empty: 0, full: 13, emptyWithLinkedin: 0, topNuoc: null, topNuocEmpty: 0 },
];

const BRANDS: BrandRong[] = [
  { brand: 'La Roche-Posay', category: 'Beauty', paid: 11, empty: 10 },
  { brand: 'Iunik', category: 'Beauty', paid: 9, empty: 9 },
  { brand: 'Dr. Althea', category: 'Beauty', paid: 6, empty: 6 },
  { brand: 'Lix Detergent Joint Stock Company', category: 'FMCG', paid: 6, empty: 5 },
  { brand: 'RITA FOOD & DRINK CO.', category: 'F&B', paid: 14, empty: 4 },
];

function ve(rows: CatRow[] = CATS, viTri: ViTriRow[] = VI_TRI, brands: BrandRong[] = BRANDS) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Credit & Contacts');
  veSheetCreditContacts(ws, { rows, viTri, brands, from: null, to: null });
  return { wb, ws };
}

/** Cac o gop, doc lai duoi dang {top,left,bottom,right} 1-indexed. */
function oGop(ws: ExcelJS.Worksheet): { top: number; left: number; bottom: number; right: number }[] {
  const m = (ws as any).model?.merges ?? (ws as any)._merges;
  const ds: string[] = Array.isArray(m) ? m : Object.values(m ?? {}).map((x: any) => x.range ?? String(x));
  return ds.map((r) => {
    const [a, b] = String(r).split(':');
    const cell = (s: string) => {
      const mm = /^([A-Z]+)(\d+)$/.exec(s)!;
      let col = 0;
      for (const ch of mm[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
      return { col, row: Number(mm[2]) };
    };
    const p = cell(a); const q = cell(b ?? a);
    return { top: p.row, left: p.col, bottom: q.row, right: q.col };
  });
}

test('khong nhung anh nao vao sheet - chu trong anh khong render duoc o server', () => {
  const { ws } = ve();
  const imgs = (ws as any).getImages?.() ?? [];
  assert.equal(imgs.length, 0,
    'Sheet nay khong duoc chua anh. Chu trong anh rasterize o server ra o vuong rong '
    + 'vi container Vercel khong co font - xem lib/categoryPalette.ts.');
});

test('bang bat dau dung dong 9, khong phai 20', () => {
  const { ws } = ve();
  const hdr = ws.getRow(LAYOUT.TABLE_START);
  assert.equal(LAYOUT.TABLE_START, 9);
  assert.equal(hdr.getCell(1).value, 'Category');
  assert.equal(hdr.getCell(2).value, 'Credit spent');
  assert.equal(hdr.getCell(10).value, 'Full rate (paid)');
  assert.equal(hdr.getCell(11).value, 'Free contacts');
});

test('khong o gop nao cat vao dai bang', () => {
  const { ws } = ve();
  // Dai bang = tieu de + cac dong du lieu + dong Total. Chu thich nam DUOI dai
  // do va duoc gop ca dong - do la binh thuong, khong phai de len.
  const tu = LAYOUT.TABLE_START;
  const den = LAYOUT.TABLE_START + CATS.length + 1;
  for (const o of oGop(ws)) {
    const catVao = o.top <= den && tu <= o.bottom;
    assert.ok(!catVao,
      `O gop ${JSON.stringify(o)} cat vao dai bang (dong ${tu}-${den}). `
      + 'Day dung la kieu hong cua lan truoc: mot thu cao qua de len tieu de bang.');
  }
});

test('ba o KPI nam ngang tren cung mot dai, khong xep doc, khong trum nhau', () => {
  const { ws } = ve();
  const gop = oGop(ws).filter((o) => o.top >= LAYOUT.TILE_ROW && o.bottom <= LAYOUT.TILE_ROW_END);
  assert.ok(gop.length >= LAYOUT.TILES.length * 2,
    `Phai co it nhat ${LAYOUT.TILES.length * 2} o gop trong dai KPI, thay ${gop.length}`);

  // Khong cap nao chong cot lan nhau.
  for (let i = 0; i < gop.length; i++) {
    for (let j = i + 1; j < gop.length; j++) {
      const a = gop[i]; const b = gop[j];
      const trumDong = a.top <= b.bottom && b.top <= a.bottom;
      const trumCot = a.left <= b.right && b.left <= a.right;
      assert.ok(!(trumDong && trumCot),
        `Hai o gop trum nhau: ${JSON.stringify(a)} va ${JSON.stringify(b)}`);
    }
  }

  // Nhan cua ca ba o phai co mat, dung dong TILE_ROW.
  const nhan = LAYOUT.TILES.map((t) => String(ws.getRow(LAYOUT.TILE_ROW).getCell(t.from).value));
  assert.equal(nhan[0], 'Total credit spent');
  // Nhan PHAI noi ro tinh tren cai gi. Ban truoc chi ghi "Best contact yield"
  // trong khi mau so la moi contact, ke ca contact nguoi go tay.
  assert.ok(nhan[1].includes('paid reveals'), `nhan 2 phai noi "paid reveals": ${nhan[1]}`);
  assert.ok(nhan[1].includes(String(MIN_CONTACT_XEP_HANG)), `nhan 2 phai noi nguong mau: ${nhan[1]}`);
  assert.ok(/weakest/i.test(nhan[2]), `nhan 3 phai la "Weakest ...": ${nhan[2]}`);
});

test('moi cot trong bang co do rong - khong de cot nao tu gian ra', () => {
  const { ws } = ve();
  LAYOUT.COLS.forEach((w, i) => {
    assert.equal(ws.getColumn(i + 1).width, w, `cot ${i + 1} sai do rong`);
  });
});

test('ten category giu duoc o mau, va chu tren do doc duoc', () => {
  const { ws } = ve();
  // Ke soc tung ghi de o mau o cot 1: chu trang tren nen xam FFF1F4F4, tuc ten
  // category bien mat cu mot dong mot lan. Kiem CA BAY dong.
  for (let i = 0; i < CATS.length; i++) {
    const cell = ws.getRow(LAYOUT.TABLE_START + 1 + i).getCell(1);
    const bg = (cell.fill as any)?.fgColor?.argb as string;
    const fg = (cell.font as any)?.color?.argb as string;
    assert.ok(bg && bg !== 'FFF1F4F4',
      `dong ${i}: o mau bi ke soc ghi de (${bg}) - ten category se khong doc duoc`);

    const lum = (argbHex: string) => relativeLuminance('#' + argbHex.slice(2));
    const [hi, lo] = [lum(bg), lum(fg)].sort((a, b) => b - a);
    const tuongPhan = (hi + 0.05) / (lo + 0.05);
    assert.ok(tuongPhan >= 4.4,
      `dong ${i} (${String(cell.value)}): tuong phan chi ${tuongPhan.toFixed(2)}:1`);
  }
});

test('data bar chi ap cho dong du lieu, khong gom dong Total', () => {
  const { ws } = ve();
  const cf = (ws as any).conditionalFormattings ?? [];
  for (const k of cf) assert.equal(k.rules[0].type, 'dataBar');

  // Total luon la so lon nhat; gom no vao thi thanh cua no dai het co va dim
  // moi thanh con lai thanh vach mo. Chi kiem hai khoi cua BANG CATEGORY -
  // khoi "vi sao" ben duoi co data bar rieng, tren bang khac.
  const dongCuoiDuLieu = LAYOUT.TABLE_START + CATS.length;
  const cuaBang = cf
    .map((k: any) => String(k.ref))
    .filter((r: string) => /^[BH]\d+:/.test(r))
    .sort();
  assert.deepEqual(cuaBang, [
    `B${LAYOUT.TABLE_START + 1}:B${dongCuoiDuLieu}`,
    `H${LAYOUT.TABLE_START + 1}:H${dongCuoiDuLieu}`,
  ]);

  // Goc thanh do la 0, khong phai 'min': lay min lam goc thi category chi tieu
  // it nhat co thanh dai bang 0, doc ra nhu chua tieu gi.
  assert.deepEqual(cf[0].rules[0].cfvo[0], { type: 'num', value: 0 });
});

test('dong Total cong dung, va bang sap theo chi tieu giam dan', () => {
  const { ws } = ve();
  const spend: number[] = [];
  for (let i = 0; i < CATS.length; i++) {
    spend.push(Number(ws.getRow(LAYOUT.TABLE_START + 1 + i).getCell(2).value));
  }
  assert.deepEqual(spend, [...spend].sort((a, b) => b - a), 'bang phai sap theo spend giam dan');

  const total = ws.getRow(LAYOUT.TABLE_START + CATS.length + 1);
  assert.equal(total.getCell(1).value, 'Total');
  assert.equal(total.getCell(2).value, CATS.reduce((s, c) => s + c.spend, 0));
  assert.equal(total.getCell(4).value, CATS.reduce((s, c) => s + c.brands, 0));
  assert.equal(total.getCell(8).value, CATS.reduce((s, c) => s + c.paid, 0));
});

test('khong co du lieu nao thi khong no, va khong ap data bar', () => {
  const { ws } = ve([], [], []);
  const cf = (ws as any).conditionalFormattings ?? [];
  assert.equal(cf.length, 0, 'khong co dong du lieu thi khong duoc ap data bar');
  assert.equal(ws.getRow(LAYOUT.TABLE_START).getCell(1).value, 'Category');
  assert.equal(ws.getRow(LAYOUT.TILE_ROW).getCell(1).value, 'Total credit spent');
});

test('file viet ra duoc va doc lai duoc, khong hong', async () => {
  const { wb } = ve();
  const buf = await wb.xlsx.writeBuffer();
  assert.ok(buf.byteLength > 3000, `file qua nho: ${buf.byteLength} bytes`);

  const lai = new ExcelJS.Workbook();
  await lai.xlsx.load(buf as any);
  const ws = lai.getWorksheet('Credit & Contacts')!;
  assert.ok(ws, 'khong doc lai duoc sheet');
  assert.equal(ws.getRow(LAYOUT.TABLE_START).getCell(1).value, 'Category');
  assert.equal(ws.getRow(LAYOUT.TILE_ROW).getCell(1).value, 'Total credit spent');
});

// ===========================================================================
// Hai loi THONG KE da lo tren ban that. Ca hai deu la mot con so dung ve mat
// so hoc nhung noi sai su that.
// ===========================================================================

/** Doc gia tri cua mot o KPI (dong thu hai cua dai). */
function giaTriTile(ws: ExcelJS.Worksheet, i: number): string {
  return String(ws.getRow(LAYOUT.TILE_ROW + 1).getCell(LAYOUT.TILES[i].from).value ?? '');
}

test('mau nho KHONG duoc xep hang: China Project 1-tren-1 khong phai "best"', () => {
  const { ws } = ve();
  const best = giaTriTile(ws, 1);

  // Day dung la thu da hien tren ban that: "China Project - 100% full contacts".
  assert.ok(!best.includes('China Project'),
    `China Project co dung 1 paid contact, khong duoc goi la tot nhat. Thay: "${best}"`);
  assert.ok(best.startsWith('F&B'), `phai la F&B (37 of 55): "${best}"`);

  // Mau so LUON di kem, de khong ai doc mot ti le ma khong biet no tinh tren
  // bao nhieu.
  assert.ok(best.includes('37 of 55'), `phai kem mau so: "${best}"`);
});

test('"weakest" la Beauty 12% - cho credit vao ma full contact khong ra', () => {
  const { ws } = ve();
  const weak = giaTriTile(ws, 2);
  assert.ok(weak.startsWith('Beauty'), `phai la Beauty: "${weak}"`);
  assert.ok(weak.includes('12 of 82'), `phai kem mau so: "${weak}"`);
});

test('ti le tinh tren contact go tay KHONG duoc gop vao yield', () => {
  const { ws } = ve();
  const mb = CATS.find((c) => c.name === 'Mom & Baby')!;
  const dong = LAYOUT.TABLE_START + 1
    + [...CATS].sort((a, b) => b.spend - a.spend).findIndex((c) => c.id === mb.id);

  // 6/21 = 29% (chi paid), KHONG phai 26/63 = 41% (gop 42 contact go tay).
  const rate = Number(ws.getRow(dong).getCell(10).value);
  assert.equal(Math.round(rate * 100), 29,
    'Full rate phai tinh tren contact credit da mua. 41% cu la do 42 contact go tay ganh.');
  assert.equal(ws.getRow(dong).getCell(8).value, 21, 'Paid contacts');
  assert.equal(ws.getRow(dong).getCell(11).value, 42, 'Free contacts van phai hien, khong bi giau');
});

test('canh bao IM LANG khi khong co gi dang bao - F&B 1/17 brand khong phai bao dong', () => {
  const { ws } = ve();
  const dong3 = String(ws.getCell('A3').value ?? '');

  // Ban truoc khoe "F&B needs attention: 6% of its brands have no contact" -
  // tuc DUNG MOT brand tren 17, trong khi coverage cua F&B la 94%.
  assert.ok(!/needs attention/i.test(dong3),
    `Khong category nao dat nguong bao dong, dong takeaway khong duoc bao: "${dong3}"`);
  assert.ok(dong3.includes('116 of 117'),
    `Thay vao do phai noi con so that: "${dong3}"`);
});

test('canh bao CO len khi that su co van de', () => {
  const xau: CatRow[] = [
    ...CATS.filter((c) => c.name !== 'Fashion'),
    { id: 'x', name: 'Cross Border', brands: 10, withContact: 4, noContact: 6, spend: 12,
      paid: 30, paidFull: 3, paidMailOnly: 5, paidPhoneOnly: 2, paidNeither: 20,
      paidNeitherWithLinkedin: 11, free: 0, paidVn: 30, paidVnEmpty: 20, paidNgoai: 0, paidNgoaiEmpty: 0 },
  ];
  const { ws } = ve(xau);
  const dong3 = String(ws.getCell('A3').value ?? '');
  assert.ok(/Cross Border needs attention/.test(dong3), `phai bao dong: "${dong3}"`);
  assert.ok(dong3.includes(`6 of its 10 brands`), `phai kem so tuyet doi: "${dong3}"`);
  assert.ok(MIN_BRAND_BAO_DONG <= 6);
});

test('ti le co mau qua nho hien MO, de mat khong xep hang theo no', () => {
  const { ws } = ve();
  const sap = [...CATS].sort((a, b) => b.spend - a.spend);
  for (let i = 0; i < sap.length; i++) {
    const c = sap[i];
    const o = ws.getRow(LAYOUT.TABLE_START + 1 + i).getCell(10);
    const mo = (o.font as any)?.italic === true;
    if (c.paid > 0 && c.paid < MIN_CONTACT_XEP_HANG) {
      assert.ok(mo, `${c.name} chi co ${c.paid} paid contact, ti le phai hien mo`);
    } else if (c.paid >= MIN_CONTACT_XEP_HANG) {
      assert.ok(!mo, `${c.name} co ${c.paid} paid contact, khong duoc lam mo`);
    }
  }
});

test('KHONG ve data bar cho cot ti le - mot thanh dai het co cho 100%-cua-1 la tao lai dung cai bay', () => {
  const { ws } = ve();
  const refs: string[] = ((ws as any).conditionalFormattings ?? []).map((k: any) => k.ref);
  for (const r of refs) {
    assert.ok(!r.startsWith('C') && !r.startsWith('G') && !r.startsWith('J'),
      `cot ti le khong duoc co data bar: ${r}`);
  }
});

test('co chu thich duoi bang giai thich ba cach doc sai', () => {
  const { ws } = ve();
  let text = '';
  for (let r = LAYOUT.TABLE_START + CATS.length + 2; r <= LAYOUT.TABLE_START + CATS.length + 5; r++) {
    text += String(ws.getRow(r).getCell(1).value ?? '');
  }
  assert.ok(text.includes('too few to rank'), 'phai giai thich ti le hien mo');
  assert.ok(/Free contacts/.test(text), 'phai giai thich "Free contacts" la gi');
  assert.ok(/Do not divide Credit spent/.test(text),
    'phai noi ro khong duoc chia spend cho so contact - so ledger va contact khong cung moc thoi gian');
});

test('dong takeaway khong lap lai noi dung cua o KPI, va co wrap de khong bi cat', () => {
  const { ws } = ve();
  const a3 = ws.getCell('A3');
  const text = String(a3.value ?? '');

  // Gop het vao mot dong gop khong wrap thi phan tran bi cat mat khong dau vet.
  assert.equal((a3.alignment as any)?.wrapText, true, 'A3 phai wrapText');
  assert.ok((ws.getRow(3).height ?? 0) >= 24, 'dong 3 phai du cao cho hai dong chu');

  // Best/Weakest da nam o hai o KPI ngay duoi - nhac lai o day chi lam cau dai
  // them roi bi cat.
  assert.ok(!/Best contact yield/i.test(text), `A3 khong duoc lap lai o KPI: "${text}"`);
  assert.ok(!/Weakest/i.test(text), `A3 khong duoc lap lai o KPI: "${text}"`);

  assert.ok(/leads spend at/.test(text), `A3 phai co nguoi dan chi tieu: "${text}"`);
  assert.ok(text.length < 150, `A3 dai ${text.length} ky tu, kho lot mot dong gop: "${text}"`);
});

test('o "weakest" noi ca nguyen nhan, khong chi con so', () => {
  const { ws } = ve();
  const nhan = String(ws.getRow(LAYOUT.TILE_ROW).getCell(LAYOUT.TILES[2].from).value ?? '');
  const gt = String(ws.getRow(LAYOUT.TILE_ROW + 1).getCell(LAYOUT.TILES[2].from).value ?? '');

  // "Beauty - 13% full (12 of 82)" khong noi phai lam gi.
  // "48 came back with nothing" thi noi: credit dang mua ban ghi rong.
  assert.ok(gt.includes('48 came back with nothing'), `phai noi nguyen nhan: "${gt}"`);
  assert.ok(nhan.includes('Contact quality'), `nhan phai tro sang sheet chi tiet: "${nhan}"`);

  // Mot dong o font 14 trong dai F..K (~75 ky tu) - dai hon la tran sang dong
  // thu ba va bi cat.
  assert.ok(gt.length <= 75, `gia tri dai ${gt.length} ky tu, se bi cat: "${gt}"`);
  assert.ok(!gt.includes(String.fromCharCode(10)), 'khong dung newline trong o KPI font 14');
});

// ===========================================================================
// Khoi "vi sao" - nam TRONG CUNG sheet, va phai tra loi TAI SAO chu khong
// phai noi lai CAI GI.
// ===========================================================================

/** Doc het chu cua cot A tu dong `tu` den het sheet. */
function chuCotA(ws: ExcelJS.Worksheet, tu: number): string {
  let t = '';
  for (let r = tu; r <= tu + 40; r++) {
    t += String(ws.getRow(r).getCell(1).value ?? '') + String.fromCharCode(10);
  }
  return t;
}

test('khoi "vi sao" nam cung sheet, khong phai mot tab rieng', () => {
  const { wb, ws } = ve();
  assert.equal(wb.worksheets.length, 1, 'chi duoc mot sheet - hai tab cho cung mot muc dich la du');
  assert.ok(chuCotA(ws, LAYOUT.TABLE_START).includes('Why reveals come back empty'));
});

/** Cau ket luan nguyen nhan, doc tu o merge dong 22. */
function cauKetLuan(ws: ExcelJS.Worksheet): string {
  for (let r = LAYOUT.TABLE_START; r <= LAYOUT.TABLE_START + 40; r++) {
    const v = String(ws.getRow(r).getCell(1).value ?? '');
    if (/stack up|where the person sits|Not enough reveals/.test(v)) return v;
  }
  return '';
}

test('cau ket luan noi CA HAI tang, va KHONG phu dinh category', () => {
  const { ws } = ve();
  const cau = cauKetLuan(ws);
  assert.ok(cau, 'phai co cau ket luan');

  // Tang 1: category, do TRONG CUNG mot nhom vi tri. Chi nguoi o Viet Nam:
  // Beauty 15/31 = 48%, F&B 7/55 = 13%.
  assert.ok(/only people based in Vietnam/.test(cau), cau);
  assert.ok(cau.includes('Beauty') && cau.includes('48%'), cau);
  assert.ok(cau.includes('F&B') && cau.includes('13%'), cau);

  // Tang 2: noi nguoi do ngoi.
  assert.ok(cau.includes('65%') && cau.includes('30%'), cau);
  assert.ok(cau.includes('Republic of Korea') && cau.includes('33'), cau);
  assert.ok(/35 of them do have a LinkedIn/.test(cau), cau);

  // BAT BIEN: khong bao gio duoc phu dinh category. Ban truoc viet "it is
  // where the person sits, NOT the category" - mot ket luan confounded, bi
  // chinh bang cheo pha: Beauty 48% vs F&B 13% trong cung Viet Nam.
  assert.ok(!/not the category/i.test(cau),
    `khong duoc phu dinh category - bang cheo da pha ket luan do: "${cau}"`);
});

test('chi mot tang co bang chung thi chi noi tang do', () => {
  // Cac category giong nhau ve ti le rong trong VN (khong co tac dong
  // category), nhung ngoai VN thi te han han.
  const deu: CatRow[] = CATS.map((c) => ({
    ...c,
    paidVn: c.paidVn > 0 ? 40 : 0,
    paidVnEmpty: c.paidVn > 0 ? 12 : 0,
  }));
  const { ws } = ve(deu);
  const cau = cauKetLuan(ws);
  assert.ok(!/stack up/.test(cau), `khong co tac dong category thi khong duoc noi co: "${cau}"`);
  assert.ok(/where the person sits/.test(cau), cau);
});

test('khong tang nao du bang chung thi khong ket luan gi', () => {
  const it: ViTriRow[] = [
    { key: 'vn', label: 'In Vietnam', paid: 5, empty: 2, full: 2, emptyWithLinkedin: 1, topNuoc: 'Viet Nam', topNuocEmpty: 2 },
  ];
  const deu: CatRow[] = CATS.map((c) => ({ ...c, paidVn: 3, paidVnEmpty: 1 }));
  const { ws } = ve(deu, it, []);
  assert.ok(/Not enough reveals/.test(cauKetLuan(ws)));
});

test('mau hai ben qua nho thi KHONG ket luan ve vi tri', () => {
  const it: ViTriRow[] = [
    { key: 'vn', label: 'In Vietnam', paid: 4, empty: 1, full: 2, emptyWithLinkedin: 1, topNuoc: 'Viet Nam', topNuocEmpty: 1 },
    { key: 'ngoai', label: 'Outside Vietnam', paid: 3, empty: 3, full: 0, emptyWithLinkedin: 3, topNuoc: 'Japan', topNuocEmpty: 3 },
  ];
  const { ws } = ve(CATS, it, []);
  // Tang vi tri khong du bang chung (mau 4 va 3) nen phai im. Tang category
  // van du bang chung nen van duoc noi - hai tang doc lap voi nhau.
  const cau = cauKetLuan(ws);
  assert.ok(!/where the person sits/.test(cau),
    `mau 4 va 3 khong du de ket luan ve vi tri: "${cau}"`);
  assert.ok(/stack up/.test(cau), `tang category van du bang chung: "${cau}"`);
});

test('chenh lech khong du lon thi cung khong ket luan', () => {
  const gan: ViTriRow[] = [
    { key: 'vn', label: 'In Vietnam', paid: 100, empty: 30, full: 40, emptyWithLinkedin: 20, topNuoc: 'Viet Nam', topNuocEmpty: 30 },
    { key: 'ngoai', label: 'Outside Vietnam', paid: 100, empty: 36, full: 38, emptyWithLinkedin: 30, topNuoc: 'Japan', topNuocEmpty: 20 },
  ];
  const { ws } = ve(CATS, gan, []);
  assert.ok(!chuCotA(ws, LAYOUT.TABLE_START).includes('where the person sits'),
    '30% vs 36% khong phai mot nguyen nhan, chi la nhieu');
});

test('bang brand hien dich danh brand nao ganh - con so category che mat cho nay', () => {
  const { ws } = ve();
  let tu = 0;
  for (let r = LAYOUT.TABLE_START; r <= LAYOUT.TABLE_START + 40; r++) {
    if (String(ws.getRow(r).getCell(1).value ?? '') === 'Brand') { tu = r; break; }
  }
  assert.ok(tu > 0, 'phai co bang brand');
  assert.equal(ws.getRow(tu).getCell(2).value, 'Category');
  assert.equal(ws.getRow(tu).getCell(4).value, 'Empty');

  // Dong dau tien la brand ganh nhieu nhat.
  assert.equal(ws.getRow(tu + 1).getCell(1).value, 'La Roche-Posay');
  assert.equal(ws.getRow(tu + 1).getCell(2).value, 'Beauty');
  assert.equal(ws.getRow(tu + 1).getCell(4).value, 10);
  assert.equal(Math.round(Number(ws.getRow(tu + 1).getCell(5).value) * 100), 91);
});

test('khoi "vi sao" khong cham vao dai bang category', () => {
  const { ws } = ve();
  const denBang = LAYOUT.TABLE_START + CATS.length + 1;
  // Tieu de khoi phai nam duoi ca dong Total va dong ghi chu.
  let dong = 0;
  for (let r = 1; r <= 60; r++) {
    if (String(ws.getRow(r).getCell(1).value ?? '').includes('Why reveals')) { dong = r; break; }
  }
  assert.ok(dong > denBang + 1, `khoi "vi sao" o dong ${dong}, phai duoi dai bang (het o ${denBang})`);
});

test('khong co brand nao rong thi noi ra, khong de bang trong', () => {
  const { ws } = ve(CATS, VI_TRI, []);
  assert.ok(chuCotA(ws, LAYOUT.TABLE_START).includes('No reveal has come back empty yet'));
});

test('bang "where the person sits" lien mach, khong co cot trong o giua', () => {
  const { ws } = ve();
  let tu = 0;
  for (let r = LAYOUT.TABLE_START; r <= LAYOUT.TABLE_START + 40; r++) {
    if (String(ws.getRow(r).getCell(1).value ?? '') === 'Where the person sits') { tu = r; break; }
  }
  assert.ok(tu > 0);

  const nhan = [1, 2, 3, 4, 5, 6, 7].map((c) => String(ws.getRow(tu).getCell(c).value ?? ''));
  assert.deepEqual(nhan, ['Where the person sits', 'Paid', 'Empty', 'Empty rate',
    'Has LinkedIn anyway', 'Full', 'Full rate']);

  // Dong du lieu: bay cot dau phai co gia tri, khong duoc co lo o giua.
  const vn = ws.getRow(tu + 1);
  for (let c = 1; c <= 7; c++) {
    assert.notEqual(vn.getCell(c).value, null, `cot ${c} cua dong "In Vietnam" bi trong`);
    assert.notEqual(vn.getCell(c).value, '', `cot ${c} cua dong "In Vietnam" bi trong`);
  }
  assert.equal(vn.getCell(2).value, 122);
  assert.equal(vn.getCell(3).value, 36);
  assert.equal(Math.round(Number(vn.getCell(4).value) * 100), 30);
  assert.equal(vn.getCell(5).value, 28);
});

test('hai cot "Empty rate" dung CUNG mot thang data bar', () => {
  const { ws } = ve();
  const cf: any[] = (ws as any).conditionalFormattings ?? [];
  // Hai khoi cua khoi "vi sao": cot D (bang vi tri) va cot D (bang brand).
  const cuaWhy = cf.filter((k) => /^D\d+:/.test(String(k.ref)));
  assert.equal(cuaWhy.length, 2, 'phai co hai khoi data bar cho hai bang Empty rate');
  for (const k of cuaWhy) {
    assert.deepEqual(k.rules[0].cfvo, [{ type: 'num', value: 0 }, { type: 'num', value: 1 }],
      'thang phai CO DINH 0..1 o ca hai bang - hai cot cung ten voi hai thang '
      + 'khac nhau thi thanh cua chung khong so sanh duoc');
  }
});

test('ti le cua brand co mau nho hien MO - dung cai bay da sua o bang category', () => {
  const { ws } = ve();
  let tu = 0;
  for (let r = LAYOUT.TABLE_START; r <= LAYOUT.TABLE_START + 40; r++) {
    if (String(ws.getRow(r).getCell(1).value ?? '') === 'Brand') { tu = r; break; }
  }
  for (let i = 0; i < BRANDS.length; i++) {
    const b = BRANDS[i];
    const o = ws.getRow(tu + 1 + i).getCell(5);
    const mo = (o.font as any)?.italic === true;
    if (b.paid < MIN_PAID_BRAND_DE_XEP_HANG) {
      assert.ok(mo, `${b.brand} chi co ${b.paid} reveal, ti le phai hien mo`);
    } else {
      assert.ok(!mo, `${b.brand} co ${b.paid} reveal, khong duoc lam mo`);
    }
  }
});

test('nhom khong co location duoc noi ro la bi loai khoi so sanh', () => {
  const { ws } = ve();
  let thay = '';
  for (let r = LAYOUT.TABLE_START; r <= LAYOUT.TABLE_START + 40; r++) {
    const v = String(ws.getRow(r).getCell(1).value ?? '');
    if (/No location recorded/.test(v)) thay = v;
  }
  assert.ok(thay, 'phai hien nhom nay, khong duoc an di');
  assert.ok(/left out of the comparison/.test(thay),
    `phai noi ro bi loai: "${thay}" - 22 dong nay la du lieu di tru tu n8n, `
    + 'khong phai reveal cua app, va chung 0% rong nen de vao so sanh se lam lech');
});
