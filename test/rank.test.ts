import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  scoreCandidate, extractTerms, khopVung, vungCoChiaDuoc, xepTrongVungLenTruoc,
  type Candidate, type Prefs,
} from '../lib/rank';

const base: Candidate = {
  external_uid: 'u1',
  full_name: 'Nguyen Van A',
  job_title: 'Manager',
  company: 'Some Company',
  location: null,
  years_in_role: null,
  open_to_work: false,
  skills: null,
  experience: [],
};

test('extractTerms splits on OR/AND/parentheses and strips quotes', () => {
  assert.deepEqual(extractTerms('ecommerce OR "e-commerce"'), ['ecommerce', 'e-commerce']);
  assert.deepEqual(extractTerms('(Marketing OR Sales) AND Director'), ['Marketing', 'Sales', 'Director']);
  assert.deepEqual(extractTerms(''), []);
  assert.deepEqual(extractTerms(null), []);
});

// --- B3: candidate whose experience mentions the searched brand ranks above an unrelated person ---

test('a candidate whose employer differs from the brand but whose experience mentions it ranks above an unrelated person', () => {
  // Nguoi that: lam o Masan Consumer (cong ty da mapped cua brand Chin-su),
  // chuc danh nhac ten Chin-su. scan/route.ts them ten brand vao keywordTerms
  // cho MOI brand - mo phong dieu do o day.
  const relevant: Candidate = {
    ...base,
    external_uid: 'relevant',
    full_name: 'Tran Thi B',
    job_title: 'Financial Planning - Seasoning (Nam Ngu, Chin-su, Tam Thai Tu)',
    company: 'Masan Consumer',
    experience: [
      { company: 'Masan Consumer', title: 'Financial Planning - Seasoning (Nam Ngu, Chin-su, Tam Thai Tu)' },
    ],
  };

  const unrelated: Candidate = {
    ...base,
    external_uid: 'unrelated',
    full_name: 'Le Van C',
    job_title: 'Manager',
    company: 'Some Other Company',
    experience: [{ company: 'Some Other Company', title: 'Manager' }],
  };

  const prefs: Prefs = { keywordTerms: ['Chin-su'] };

  const relevantScore = scoreCandidate(relevant, prefs);
  const unrelatedScore = scoreCandidate(unrelated, prefs);

  assert.ok(
    relevantScore.score > unrelatedScore.score,
    `expected ${relevantScore.score} > ${unrelatedScore.score}`,
  );
  assert.ok(relevantScore.reasons.some((r) => r.includes('Chin-su')));
});

// --- SHEGLAM item 4: Function ticks must score against job_title, not the
// --- never-populated c.department field -------------------------------

test('a Function tick (department) scores against job_title text, clearing "fair" for a real example', () => {
  // Vi du that tu bao cao SHEGLAM: "Head of Marketing, US" voi Marketing
  // duoc tick. DIR seniority (+12) + Function match (+20) = 32 -> fair (>=20).
  const c: Candidate = { ...base, job_title: 'Head of Marketing, US' };
  const { score, reasons } = scoreCandidate(c, { departments: ['Marketing'] });
  assert.ok(score >= 20, `expected >= 20 (fair), got ${score}`);
  assert.ok(reasons.some((r) => r.startsWith('Function:')));
});

test('a Function tick does not fire on a title that never mentions it (c.department is never read)', () => {
  const c: Candidate = { ...base, job_title: 'Founder & E-commerce manager' };
  const { reasons } = scoreCandidate(c, { departments: ['Marketing', 'Sales'] });
  assert.equal(reasons.some((r) => r.startsWith('Function:')), false);
});

test('a title word and a Function tick matching the SAME term in the title do not double-count', () => {
  const c: Candidate = { ...base, job_title: 'Head of Marketing, US' };
  const withBoth = scoreCandidate(c, { titleWords: ['marketing'], departments: ['Marketing'] });
  const withTitleWordOnly = scoreCandidate(c, { titleWords: ['marketing'] });
  // Cung mot bang chung (chu "marketing" trong title) - diem phai bang nhau,
  // khong duoc cong ca hai lan.
  assert.equal(withBoth.score, withTitleWordOnly.score);
  assert.equal(withBoth.reasons.some((r) => r.startsWith('Function:')), false);
});

test('a compound Function label ("X and Y") matches a title containing just one part', () => {
  // Vi du that tu bao cao SHEGLAM: "Founder & E-commerce manager" tick
  // "E-commerce and digital" (nhan tu dat, khong bao gio xuat hien nguyen van
  // trong mot job_title that). EXEC (+15) + Function (+20) = 35 -> fair.
  const c: Candidate = { ...base, job_title: 'Founder & E-commerce manager' };
  const { score, reasons } = scoreCandidate(c, { departments: ['E-commerce and digital'] });
  assert.ok(score >= 20, `expected >= 20 (fair), got ${score}`);
  assert.ok(reasons.some((r) => r === 'Function: E-commerce and digital'));
});

test('"Export and international" matches a title containing just "Export"', () => {
  const c: Candidate = { ...base, job_title: 'Export Sales Executive' };
  const { reasons } = scoreCandidate(c, { departments: ['Export and international'] });
  assert.ok(reasons.some((r) => r.startsWith('Function:')));
});

test('the "and" connector itself is dropped, so it does not spuriously match every title containing "and"', () => {
  const c: Candidate = { ...base, job_title: 'Sales and Distribution Clerk' };
  // "E-commerce and digital" tach thanh ["E-commerce", "digital"] - "and" bi
  // bo, khong duoc coi la mot cum de tu khop chu "and" trong title nay.
  const { reasons } = scoreCandidate(c, { departments: ['E-commerce and digital'] });
  assert.equal(reasons.some((r) => r.startsWith('Function:')), false);
});

test('a Function term matching what the PIC also typed in Keywords does not double-count', () => {
  const c: Candidate = { ...base, job_title: 'Founder & E-commerce manager' };
  const withBoth = scoreCandidate(c, {
    departments: ['E-commerce and digital'], keywordTerms: ['E-commerce'],
  });
  const keywordOnly = scoreCandidate(c, { keywordTerms: ['E-commerce'] });
  // keywordTerms khop qua skills/experience, khong qua job_title, nen o day
  // khong co gi de khop (c.skills/c.experience rong) - nhung Function PHAI
  // van bi loai vi "e-commerce" da nam trong keywordTerms cua chinh PIC.
  assert.equal(withBoth.score, keywordOnly.score);
  assert.equal(withBoth.reasons.some((r) => r.startsWith('Function:')), false);
});

test('a title word and a Function tick matching DIFFERENT terms in the title both count', () => {
  const c: Candidate = { ...base, job_title: 'Head of Marketing and Ecommerce' };
  const { score, reasons } = scoreCandidate(c, { titleWords: ['ecommerce'], departments: ['Marketing'] });
  const titleOnly = scoreCandidate(c, { titleWords: ['ecommerce'] });
  assert.ok(score > titleOnly.score, 'Function bonus should add on top of a different title-word match');
  assert.ok(reasons.some((r) => r.startsWith('Matches')));
  assert.ok(reasons.some((r) => r.startsWith('Function:')));
});

test('skills[] matching a keyword earns a bonus and a reason', () => {
  // norm() bo dau nhung KHONG bo dau gach ngang - "e-commerce" va "ecommerce"
  // la hai chuoi con khac nhau that su (chinh vi vay bo goi y trong
  // SearchForm.tsx liet ke ca hai cach viet rieng). Dung dung mot cach viet o
  // ca hai phia de test nay kiem dung co che khop chuoi con, khong phai kiem
  // chuan hoa dau gach ngang (chua tung duoc yeu cau).
  const c: Candidate = { ...base, skills: ['Ecommerce strategy', 'Negotiation'] };
  const { score, reasons } = scoreCandidate(c, { keywordTerms: ['ecommerce'] });
  assert.ok(score > 0);
  assert.ok(reasons.some((r) => r.startsWith('Skill:')));
});

test('location matching the selected region earns a bonus, never a filter', () => {
  const inRegion: Candidate = { ...base, location: 'Ho Chi Minh City, Vietnam' };
  const outOfRegion: Candidate = { ...base, location: 'Shanghai, China' };
  const prefs: Prefs = { region: 'Vietnam only' };

  const a = scoreCandidate(inRegion, prefs);
  const b = scoreCandidate(outOfRegion, prefs);
  assert.ok(a.score > b.score);
  assert.ok(a.reasons.some((r) => r.startsWith('Works in')));
  // Khong khop vung KHONG duoc tru diem hay bi loai - chi la khong co bonus.
  assert.equal(b.reasons.some((r) => r.startsWith('Works in')), false);
});

test('Global/Group headquarters region (no country list) never scores a location bonus', () => {
  const c: Candidate = { ...base, location: 'Shanghai, China' };
  const { reasons } = scoreCandidate(c, { region: 'Global' });
  assert.equal(reasons.some((r) => r.startsWith('Works in')), false);
});

// --- B3 invariant: scoring never reduces the candidate count ---

test('scoring never reduces the candidate count', () => {
  const candidates: Candidate[] = [
    { ...base, external_uid: 'a', job_title: 'CEO' },
    { ...base, external_uid: 'b', job_title: 'Intern', open_to_work: true },
    { ...base, external_uid: 'c', job_title: null, skills: null, experience: [] },
    { ...base, external_uid: 'd', location: 'Nowhere relevant' },
  ];
  const prefs: Prefs = { titleWords: ['ceo'], keywordTerms: ['nothing-matches-anything'], region: 'Vietnam only' };

  const scored = candidates.map((c) => ({ ...c, ...scoreCandidate(c, prefs) }));
  assert.equal(scored.length, candidates.length);
  assert.deepEqual(scored.map((c) => c.external_uid).sort(), candidates.map((c) => c.external_uid).sort());
});


// --- so khop vung voi chuoi location THAT cua SignalHire -------------------
//
// Cac chuoi duoi day copy nguyen tu scan_candidate dang co trong DB, khong
// phai bia ra: neu SignalHire doi cach ghi thi day la cho vo dau tien.

test('khopVung nhan dung moi cach SignalHire ghi dia diem Viet Nam', () => {
  for (const loc of [
    'Viet Nam',
    'Ho Chi Minh City, Viet Nam',
    'Ho Chi Minh City Metropolitan Area, Viet Nam',
    'Hanoi, Hanoi, Viet Nam',
    'Hanoi Capital Region, Viet Nam',
    'District 7, Ho Chi Minh City, Viet Nam',
    'Binh Duong, Viet Nam',
    'Vietnam, Viet Nam',
  ]) {
    assert.equal(khopVung(loc, 'Vietnam only'), 'Vietnam', `phai khop: ${loc}`);
  }
});

test('khopVung khong nhan nguoi ngoai vung - day dung la loi da bao cao', () => {
  for (const loc of [
    'Singapore',
    'Thailand',
    'London, England, United Kingdom',
    'Spanaway, Washington, United States',
    'Hong Kong SAR',
    'Mumbai, Maharashtra, India',
  ]) {
    assert.equal(khopVung(loc, 'Vietnam only'), null, `khong duoc khop: ${loc}`);
  }

  // Cung mot nguoi do, nhung PIC chon rong hon thi phai khop.
  assert.equal(khopVung('Singapore', 'Vietnam and Southeast Asia'), 'Vietnam and Southeast Asia');
  assert.equal(khopVung('Thailand', 'Vietnam and Southeast Asia'), 'Vietnam and Southeast Asia');
});

test('vung khong co danh sach nuoc thi khong chia nhom duoc', () => {
  // Global va Group headquarters CO Y khong loc dia diem. Chia nhom o do la
  // dan nhan "Outside ..." cho ca danh sach, tuc noi sai.
  assert.equal(vungCoChiaDuoc('Global'), false);
  assert.equal(vungCoChiaDuoc('Group headquarters'), false);
  assert.equal(vungCoChiaDuoc(null), false);
  assert.equal(vungCoChiaDuoc('Vietnam only'), true);
  assert.equal(vungCoChiaDuoc('Greater China'), true);
});

// --- thu tu hien thi ------------------------------------------------------

test('nguoi trong vung len truoc, va thu tu diem ben trong nhom KHONG bi xao tron', () => {
  // Dung tinh huong that: Director o Singapore diem cao hon Executive o TP HCM
  // vi dia diem chi duoc 15 diem con chuc danh duoc 30. Truoc day danh sach
  // hien theo dung thu tu nay, nen PIC chon "Vietnam" van doc mot danh sach mo
  // dau bang nguoi Singapore.
  const ds = [
    { ten: 'SG Director',  score: 78, inRegion: false },
    { ten: 'UK Manager',   score: 63, inRegion: false },
    { ten: 'HCM Director', score: 60, inRegion: true },
    { ten: 'HN Manager',   score: 45, inRegion: true },
    { ten: 'US Manager',   score: 40, inRegion: false },
  ];

  const xep = xepTrongVungLenTruoc(ds);

  assert.deepEqual(xep.map((c) => c.ten),
    ['HCM Director', 'HN Manager', 'SG Director', 'UK Manager', 'US Manager']);

  // Ben trong tung nhom, diem phai van giam dan - ham nay chi chia nhom, khong
  // duoc pha thu tu diem da co.
  const trong = xep.filter((c) => c.inRegion).map((c) => c.score);
  const ngoai = xep.filter((c) => !c.inRegion).map((c) => c.score);
  assert.deepEqual(trong, [...trong].sort((a, b) => b - a));
  assert.deepEqual(ngoai, [...ngoai].sort((a, b) => b - a));

  // KHONG duoc mat ai. Day la bat bien cua ca he thong: xep lai thu tu, khong loc.
  assert.equal(xep.length, ds.length);
});

test('vung khong chia duoc thi thu tu giu nguyen y nhu cu', () => {
  const ds = [
    { ten: 'a', inRegion: null },
    { ten: 'b', inRegion: null },
    { ten: 'c', inRegion: null },
  ];
  assert.deepEqual(xepTrongVungLenTruoc(ds).map((c) => c.ten), ['a', 'b', 'c']);
});
