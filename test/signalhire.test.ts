import { test } from 'node:test';
import assert from 'node:assert/strict';

import { revealUids, searchBrand, gomAliasTheoUuTien } from '../lib/signalhire';
import { nameKey } from '../lib/nameKey';

// --- 1a: mot loi mang trong revealUids khong duoc nem ra ngoai -------------
//
// app/api/reveal/route.ts chi giai phong duoc credit_ledger dang 'reserved'
// (releaseCredit) khi doc duoc out.ok === false. Neu fetch() nem loi thang ra,
// route khong co try/catch bao ngoai va dong ledger ket lai vinh vien. Test
// nay giu cho revealUids LUON tra ve, khong bao gio nem.

test('revealUids: a network throw is caught and reported as ok:false, not propagated', async () => {
  const real = global.fetch;
  global.fetch = (async () => { throw new Error('ECONNRESET'); }) as any;
  try {
    const out = await revealUids('fake-key', ['uid1']);
    assert.equal(out.ok, false);
    assert.equal(out.status, 0);
    assert.match(out.message, /ECONNRESET/);
    assert.deepEqual(out.people, []);
  } finally {
    global.fetch = real;
  }
});

test('revealUids: an error body using SignalHire\'s real "error" key is parsed, not left as a raw JSON blob', async () => {
  const real = global.fetch;
  global.fetch = (async () => ({
    ok: false, status: 500,
    text: async () => JSON.stringify({ error: 'Only three requests are allowed at the same time' }),
  } as any)) as any;

  try {
    const out = await revealUids('fake-key', ['uid1']);
    assert.equal(out.ok, false);
    assert.equal(out.status, 500);
    assert.equal(out.message, 'Only three requests are allowed at the same time');
  } finally {
    global.fetch = real;
  }
});

// --- Gate dong thoi: SignalHire chi cho 3 request cung luc (xac minh tu loi
// --- that trong DB), va gioi han do phai dung CHUNG giua search va reveal --

test('goiSignalHire gate: never more than 3 SignalHire calls in flight at once, across 8 parallel brands', async () => {
  let dangChay = 0;
  let dinhCaoQuanSatDuoc = 0;
  const real = global.fetch;
  global.fetch = (async () => {
    dangChay += 1;
    dinhCaoQuanSatDuoc = Math.max(dinhCaoQuanSatDuoc, dangChay);
    await new Promise((r) => setTimeout(r, 15));
    dangChay -= 1;
    return { ok: true, json: async () => ({ total: 1, profiles: [] }) } as any;
  }) as any;

  try {
    await Promise.all(Array.from({ length: 8 }, (_, i) => searchBrand({
      apikey: 'k', brand: `Brand ${i}`, tier: 1, aliases: new Map(),
      region: 'Vietnam only', roles: [], keywords: '',
    })));
    assert.ok(dinhCaoQuanSatDuoc <= 3, `dinh cao dong thoi la ${dinhCaoQuanSatDuoc}, phai <= 3`);
    assert.ok(dinhCaoQuanSatDuoc > 1, 'gate khong duoc chan het thanh tuan tu 1-1 khi con cho');
  } finally {
    global.fetch = real;
  }
});

test('goiSignalHire gate: shared between search and reveal, not one budget of 3 each', async () => {
  // Neu moi ham tu dem rieng 3 cua no, mot lan reveal 3-uid chay dung luc 3
  // brand dang quet se cho ra dinh 6 dong thoi that su - dung dieu can tranh,
  // vi ca hai duong dung CHUNG mot khoa API va CHUNG mot gioi han that.
  let dangChay = 0;
  let dinhCaoQuanSatDuoc = 0;
  const real = global.fetch;
  global.fetch = (async () => {
    dangChay += 1;
    dinhCaoQuanSatDuoc = Math.max(dinhCaoQuanSatDuoc, dangChay);
    await new Promise((r) => setTimeout(r, 15));
    dangChay -= 1;
    return { ok: true, json: async () => ({ total: 1, profiles: [] }) } as any;
  }) as any;

  try {
    await Promise.all([
      ...Array.from({ length: 3 }, (_, i) => searchBrand({
        apikey: 'k', brand: `Brand ${i}`, tier: 1, aliases: new Map(),
        region: 'Vietnam only', roles: [], keywords: '',
      })),
      revealUids('k', ['u1', 'u2', 'u3']),
    ]);
    assert.ok(dinhCaoQuanSatDuoc <= 3, `dinh cao dong thoi la ${dinhCaoQuanSatDuoc}, phai <= 3 (dung chung gate)`);
  } finally {
    global.fetch = real;
  }
});

// --- SHEGLAM: mot loi lan thu hep khong duoc bien mat chi vi lan kham pha
// --- da co san candidate de fallback ----------------------------------------

test('a narrow-call failure still surfaces as .problem even though discovery-fallback candidates are shown', async () => {
  const real = global.fetch;
  let n = 0;
  global.fetch = (async (_url: string, init: any) => {
    n += 1;
    const body = JSON.parse(init.body);
    if (!('currentTitle' in body)) {
      // Lan kham pha: thanh cong, total > 100 nen se co lan thu hep.
      return { ok: true, json: async () => ({ total: 150, profiles: mockProfiles(20) }) } as any;
    }
    // Lan thu hep: SignalHire tra loi 500, khoa `error` (dung dinh dang that).
    return {
      ok: false, status: 500,
      text: async () => JSON.stringify({ error: 'Only three requests are allowed at the same time' }),
    } as any;
  }) as any;

  try {
    const result = await searchBrand({
      apikey: 'k', brand: 'SHEGLAM', tier: 1, aliases: new Map(),
      region: 'Global', roles: ['Marketing', 'Sales'], keywords: '',
    });

    // Ca hai phai dung mot luc: van co candidate (fallback ve ket qua kham
    // pha, khong tra tay khong) VA problem khong duoc am tham bien mat -
    // scan/route.ts dua vao problem de dua brand nay vao job.error/thong bao.
    assert.equal(result.candidates.length, 20);
    assert.ok(result.problem, 'problem khong duoc la null khi lan thu hep that bai');
    assert.equal(result.problem?.status, 500);
    assert.equal(result.problem?.message, 'Only three requests are allowed at the same time');
    assert.equal(n, 2);
  } finally {
    global.fetch = real;
  }
});

test('error body using SignalHire\'s real "error" key is parsed, not left as a raw JSON blob', async () => {
  const real = global.fetch;
  global.fetch = (async () => ({
    ok: false, status: 500,
    text: async () => JSON.stringify({ error: 'Only three requests are allowed at the same time' }),
  } as any)) as any;

  try {
    // total <= 100 se chi can MOT lan goi (kham pha) - du la lan nao that bai,
    // dinh dang loi phai duoc doc dung.
    const result = await searchBrand({
      apikey: 'k', brand: 'Solo Co', tier: 1, aliases: new Map(),
      region: 'Vietnam only', roles: [], keywords: '',
    });
    assert.equal(result.outcome, 'error');
    assert.equal(
      result.problem?.message,
      'Only three requests are allowed at the same time',
      'phai doc duoc cau chu tu khoa "error", khong phai nguyen khoi JSON tho',
    );
  } finally {
    global.fetch = real;
  }
});

// --- 1b: mot alias nhap tay (priority 0) phai luon la "cong ty chinh", ke ca
// --- khi cung khoa co mot dong tu hoc (priority 1/2) ------------------------

test('gomAliasTheoUuTien: a manual alias stays primary even with an auto-learned row for the same alias', () => {
  // Rows da o dung thu tu ma loadSettings() doc ve: priority asc, updated_at
  // desc. priority 0 = nhap tay, priority 1 = tu hoc qua duong tim lai.
  const rows = [
    { alias: 'Dior', employer: 'Parfums Christian Dior' }, // priority 0, nhap tay
    { alias: 'Dior', employer: 'LVMH Vietnam' }, // priority 1, tu hoc (fallback)
  ];
  const aliases = gomAliasTheoUuTien(rows);
  assert.deepEqual(aliases.get(nameKey('Dior')), ['Parfums Christian Dior', 'LVMH Vietnam']);
});

test('gomAliasTheoUuTien: reversed input order (auto-learned row sorted first) still keeps both, order as given', () => {
  // gomAliasTheoUuTien tin tuong THU TU DA SAP CUA DAU VAO (do la viec cua
  // cau truy van trong loadSettings). No khong tu sap lai theo priority.
  const rows = [
    { alias: 'Dior', employer: 'LVMH Vietnam' },
    { alias: 'Dior', employer: 'Parfums Christian Dior' },
  ];
  const aliases = gomAliasTheoUuTien(rows);
  assert.deepEqual(aliases.get(nameKey('Dior')), ['LVMH Vietnam', 'Parfums Christian Dior']);
});

test('gomAliasTheoUuTien: duplicate (alias, employer) rows do not repeat in the list', () => {
  const rows = [
    { alias: 'Dior', employer: 'Parfums Christian Dior' },
    { alias: 'Dior', employer: 'Parfums Christian Dior' },
  ];
  const aliases = gomAliasTheoUuTien(rows);
  assert.deepEqual(aliases.get(nameKey('Dior')), ['Parfums Christian Dior']);
});

// --- 1c: mot brand anh xa toi NHIEU cong ty phai tim CA HAI -----------------

test('searchBrand: a brand mapped to two employers queries both and merges results', async () => {
  const calls: string[] = [];
  const real = global.fetch;
  global.fetch = (async (_url: string, init: any) => {
    const body = JSON.parse(init.body);
    calls.push(body.currentCompany);
    const profiles = body.currentCompany === 'Company A'
      ? [{ uid: 'u1', fullName: 'Nguyen A', experience: [{ company: 'Company A', title: 'CEO' }] }]
      : [{ uid: 'u2', fullName: 'Nguyen B', experience: [{ company: 'Company B', title: 'CFO' }] }];
    return { ok: true, json: async () => ({ profiles }) } as any;
  }) as any;

  try {
    const aliases = new Map<string, string[]>([[nameKey('Brand X'), ['Company A', 'Company B']]]);
    const result = await searchBrand({
      apikey: 'k', brand: 'Brand X', tier: 1, aliases,
      region: 'Vietnam only', roles: [], keywords: '',
    });

    assert.deepEqual(calls, ['Company A', 'Company B']);
    assert.equal(result.calls, 2);
    assert.equal(result.candidates.length, 2);
    assert.deepEqual(result.candidates.map((c) => c.external_uid).sort(), ['u1', 'u2']);
    assert.equal(result.mapped, true);
    assert.equal(result.fellBack, false);
  } finally {
    global.fetch = real;
  }
});

// --- B2: two-call design driven by total ------------------------------------

function mockProfiles(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    uid: `u${i}`, fullName: `Person ${i}`, experience: [{ company: 'ACME', title: 'Manager' }],
  }));
}

test('total 0 -> no second call, not-found outcome recorded', async () => {
  const calls: any[] = [];
  const real = global.fetch;
  global.fetch = (async (_url: string, init: any) => {
    calls.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ total: 0, profiles: [] }) } as any;
  }) as any;

  try {
    // Brand KHONG co alias, de dam bao "khong goi lan hai" khong bi lan voi
    // co che thu lai bang ten brand (dieu do chi ap dung khi mapped === true).
    const result = await searchBrand({
      apikey: 'k', brand: 'Nonexistent Co', tier: 1, aliases: new Map(),
      region: 'Vietnam only', roles: [], keywords: '',
    });

    assert.equal(calls.length, 1);
    assert.equal(result.calls, 1);
    assert.equal(result.total, 0);
    assert.equal(result.outcome, 'not_found');
    assert.equal(result.candidates.length, 0);
  } finally {
    global.fetch = real;
  }
});

test('total <= 100 -> exactly one call, no filters sent, everyone kept regardless of title or region', async () => {
  const calls: any[] = [];
  const real = global.fetch;
  global.fetch = (async (_url: string, init: any) => {
    calls.push(JSON.parse(init.body));
    return { ok: true, json: async () => ({ total: 5, profiles: mockProfiles(5) }) } as any;
  }) as any;

  try {
    const result = await searchBrand({
      apikey: 'k', brand: 'Small Co', tier: 1, aliases: new Map(),
      region: 'Vietnam only', roles: ['Marketing'], keywords: 'ecommerce',
    });

    assert.equal(calls.length, 1);
    assert.equal(result.calls, 1);
    assert.equal(result.outcome, 'all_shown');
    assert.equal(result.candidates.length, 5);

    // Lan goi DUY NHAT phai la lan kham pha: khong currentTitle, khong
    // location, khong department, khong keywords - chi currentCompany/size/
    // excludeRevealed. Bo loc chi xuat hien khi total > 100.
    const q = calls[0];
    assert.equal(q.currentCompany, 'Small Co');
    assert.equal('currentTitle' in q, false);
    assert.equal('location' in q, false);
    assert.equal('department' in q, false);
    assert.equal('keywords' in q, false);
    assert.equal(q.excludeRevealed, true);
  } finally {
    global.fetch = real;
  }
});

test('total > 100 -> two calls, filters on the second', async () => {
  const calls: any[] = [];
  const real = global.fetch;
  global.fetch = (async (_url: string, init: any) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    // Lan dau (kham pha) khong co currentTitle; lan hai (thu hep) co.
    if (!('currentTitle' in body)) {
      return { ok: true, json: async () => ({ total: 250, profiles: mockProfiles(100) }) } as any;
    }
    return { ok: true, json: async () => ({ total: 250, profiles: mockProfiles(28) }) } as any;
  }) as any;

  try {
    const result = await searchBrand({
      apikey: 'k', brand: 'Big Co', tier: 1, aliases: new Map(),
      region: 'Vietnam only', roles: ['Marketing'], keywords: 'ecommerce OR e-commerce',
    });

    assert.equal(calls.length, 2);
    assert.equal(result.calls, 2);
    assert.equal(result.outcome, 'narrowed');
    assert.equal(result.total, 250);
    assert.equal(result.candidates.length, 28);

    const kham = calls[0];
    assert.equal('currentTitle' in kham, false);

    const hep = calls[1];
    assert.ok(typeof hep.currentTitle === 'string' && hep.currentTitle.includes('CEO'));
    assert.equal(hep.keywords, 'ecommerce OR e-commerce');
    assert.deepEqual(hep.location, ['Viet Nam', 'Vietnam']);

    // `department` KHONG duoc co mat, du PIC da tick Function. Nhan trong
    // DEPARTMENTS cua SearchForm.tsx la nhan tu dat cua app, va SignalHire tra
    // 422 "Department is not recognized" khi gap mot gia tri ngoai danh muc cua
    // ho - lam chet CA lan goi, keo theo location va currentTitle. Do la ly do
    // moi lan quet cong ty lon deu ra nguoi khap the gioi du PIC chon
    // "Vietnam only". Function gio chi la dau vao xep hang (lib/rank.ts).
    assert.equal('department' in hep, false);
    assert.equal(result.filterSkipped, false);
  } finally {
    global.fetch = real;
  }
});

test('a failed narrowing call is reported as NOT filtered, not as "narrowed at the source"', async () => {
  // Chuyen da that su xay ra: lan thu hep tra 422 nen ket qua tra ve la 100
  // nguoi cua lan KHAM PHA - khong loc dia diem, khong loc cap bac. Truoc day
  // outcome van la 'narrowed' va khong co gi phan biet, nen man ket qua khoe
  // "narrowed at the source because the company is large" cho mot danh sach
  // nguoi o khap the gioi. Giu nguyen ung vien (khong duoc lam mat ai), nhung
  // PHAI danh dau filtered: false.
  const real = global.fetch;
  global.fetch = (async (_url: string, init: any) => {
    const body = JSON.parse(init.body);
    if (!('currentTitle' in body)) {
      return { ok: true, json: async () => ({ total: 224, profiles: mockProfiles(100) }) } as any;
    }
    return {
      ok: false, status: 422,
      text: async () => JSON.stringify({ error: 'Department is not recognized' }),
    } as any;
  }) as any;

  try {
    const result = await searchBrand({
      apikey: 'k', brand: "L'Oreal Paris", tier: 1, aliases: new Map(),
      region: 'Vietnam only', roles: ['Marketing', 'E-commerce and digital'], keywords: '',
    });

    assert.equal(result.outcome, 'narrowed');
    assert.equal(result.candidates.length, 100);
    assert.equal(result.filterSkipped, true);
    assert.equal(result.problem?.status, 422);
    // KHONG goi lan thu ba de chua chay: moi lan goi an mot luot trong tran
    // 300 brand/ngay, va CALLS_PER_COMPANY_WORST_CASE uoc luong toi da 2.
    assert.equal(result.calls, 2);
  } finally {
    global.fetch = real;
  }
});

test('a company small enough to show in full never reports a skipped filter', async () => {
  const real = global.fetch;
  global.fetch = (async () => (
    { ok: true, json: async () => ({ total: 5, profiles: mockProfiles(5) }) } as any
  )) as any;

  try {
    const result = await searchBrand({
      apikey: 'k', brand: 'Small Co', tier: 1, aliases: new Map(),
      region: 'Vietnam only', roles: [], keywords: '',
    });
    assert.equal(result.outcome, 'all_shown');
    // CO Y khong loc, khong phai bo qua mot buoc loc da hua - khong duoc canh bao.
    assert.equal(result.filterSkipped, false);
  } finally {
    global.fetch = real;
  }
});

test('alias retry keys off total === 0 from the discovery call, not an empty profiles array', async () => {
  // Cong ty da mapped tra ve total > 0 (nen KHONG duoc coi la "khong co that")
  // nhung profiles rong o LAN NAY (vi du SignalHire tra ve mang rong that su
  // dong thoi voi total > 0 - truong hop hiem nhung phai xu ly dung: dua theo
  // total, khong dua theo do dai profiles).
  const calls: string[] = [];
  const real = global.fetch;
  global.fetch = (async (_url: string, init: any) => {
    const body = JSON.parse(init.body);
    calls.push(body.currentCompany);
    return { ok: true, json: async () => ({ total: 3, profiles: [] }) } as any;
  }) as any;

  try {
    const aliases = new Map<string, string[]>([[nameKey('Brand Y'), ['Mapped Co']]]);
    const result = await searchBrand({
      apikey: 'k', brand: 'Brand Y', tier: 1, aliases,
      region: 'Vietnam only', roles: [], keywords: '',
    });

    // total (3) > 0 nen KHONG duoc thu lai bang ten brand - chi mot cong ty
    // duoc goi (mapped co the goi them lan hai vi total <= 100 khong can, nen
    // van la 1 lan), khong co lan goi nao mang ten "Brand Y".
    assert.equal(calls.includes('Brand Y'), false);
    assert.equal(result.outcome, 'all_shown');
  } finally {
    global.fetch = real;
  }
});

test('searchBrand: the same person returned by two mapped employers is not duplicated', async () => {
  const real = global.fetch;
  global.fetch = (async () => ({
    ok: true,
    json: async () => ({
      profiles: [{ uid: 'same-uid', fullName: 'Nguyen A', experience: [{ company: 'A', title: 'CEO' }] }],
    }),
  } as any)) as any;

  try {
    const aliases = new Map<string, string[]>([[nameKey('Brand X'), ['Company A', 'Company B']]]);
    const result = await searchBrand({
      apikey: 'k', brand: 'Brand X', tier: 1, aliases,
      region: 'Vietnam only', roles: [], keywords: '',
    });
    assert.equal(result.calls, 2);
    assert.equal(result.candidates.length, 1);
  } finally {
    global.fetch = real;
  }
});
