import { test } from 'node:test';
import assert from 'node:assert/strict';

import { docTatCa } from '../lib/pageAll';

/**
 * Gia lap mot server PostgREST co `max-rows`: no KHONG bao loi khi bi hoi
 * nhieu hon, chi lang le tra ve it hon. Day la hanh vi da kiem tren DB that
 * (scan_candidate: 18.514 dong, mot select tran tra ve dung 1000).
 */
function serverGia(tongSoDong: number, maxRows: number) {
  const bang = Array.from({ length: tongSoDong }, (_, i) => ({ id: i }));
  let soLanGoi = 0;
  return {
    get soLanGoi() { return soLanGoi; },
    truyVan(tu: number, den: number) {
      soLanGoi++;
      const xin = den - tu + 1;
      const lay = Math.min(xin, maxRows);
      return Promise.resolve({ data: bang.slice(tu, tu + lay), error: null });
    },
  };
}

test('doc het mot bang lon hon mot trang', async () => {
  const s = serverGia(2500, 1000);
  const ra = await docTatCa((tu, den) => s.truyVan(tu, den), 1000);
  assert.equal(ra.length, 2500);
  assert.deepEqual(ra.map((r: any) => r.id).slice(0, 3), [0, 1, 2]);
  assert.equal((ra[2499] as any).id, 2499);
});

test('server cat THAP HON kich thuoc trang van phai doc du', async () => {
  // Day la loi ban dau cua chinh ham nay: no cong `tu += lo` roi dung lai khi
  // `phan.length < lo`. Voi lo = 1000 ma server cat o 200, vong dau nhan ve
  // 200 < 1000, ham tuong da het bang va tra ve 200 trong khi co 1000 dong.
  // Dung y het cai loi 1000-dong no sinh ra de chong, chi khac la do chinh no
  // gay ra.
  const s = serverGia(1000, 200);
  const ra = await docTatCa((tu, den) => s.truyVan(tu, den), 1000);
  assert.equal(ra.length, 1000, 'phai doc du 1000 dong du server cat o 200 moi lan');
  assert.deepEqual([...new Set(ra.map((r: any) => r.id))].length, 1000, 'khong duoc trung dong nao');
});

test('so dong chia het cho kich thuoc trang: khong mat dong, khong lap vo han', async () => {
  const s = serverGia(2000, 1000);
  const ra = await docTatCa((tu, den) => s.truyVan(tu, den), 1000);
  assert.equal(ra.length, 2000);
  // 2 trang day + 1 trang rong de biet da het.
  assert.equal(s.soLanGoi, 3);
});

test('bang rong tra ve mang rong sau dung mot lan goi', async () => {
  const s = serverGia(0, 1000);
  const ra = await docTatCa((tu, den) => s.truyVan(tu, den), 1000);
  assert.deepEqual(ra, []);
  assert.equal(s.soLanGoi, 1);
});

test('bang nho hon mot trang: doc du, ton them dung mot request rong', async () => {
  // 993 la so dong that cua bang contact hom nay.
  //
  // Gia cua cach dung-khi-trang-rong: mot lan goi them tra ve 0 dong. KHONG
  // duoc "toi uu" bang cach dung lai khi `phan.length < lo` - do chinh la ban
  // cu, va no bo mat du lieu khi server cat thap hon kich thuoc trang (xem
  // test ben tren). Mot request rong re hon mot con so dem thieu khong ai
  // phat hien ra.
  const s = serverGia(993, 1000);
  const ra = await docTatCa((tu, den) => s.truyVan(tu, den), 1000);
  assert.equal(ra.length, 993);
  assert.equal(s.soLanGoi, 2);
});

test('data null duoc coi la het bang, khong nem loi', async () => {
  const ra = await docTatCa(() => Promise.resolve({ data: null, error: null }));
  assert.deepEqual(ra, []);
});

test('loi tu PostgREST phai nem ra, khong duoc tra ve mang thieu', async () => {
  // Nuot loi o day la tra ve mot phep dem thieu ma khong co gi bao - dung
  // kieu hong ca lan ra soat nay di don.
  await assert.rejects(
    () => docTatCa(() => Promise.resolve({ data: null, error: { message: 'JWT expired' } })),
    /JWT expired/,
  );
});

test('loi o trang thu hai cung phai nem, khong tra ve nua chung', async () => {
  let n = 0;
  await assert.rejects(
    () => docTatCa((tu, den) => {
      n++;
      if (n === 1) return Promise.resolve({ data: Array.from({ length: 500 }, (_, i) => ({ id: i })), error: null });
      return Promise.resolve({ data: null, error: { message: 'connection reset' } });
    }, 500),
    /connection reset/,
  );
});

test('kich thuoc trang vo nghia bi tu choi ngay, khong lap vo han', async () => {
  await assert.rejects(() => docTatCa(() => Promise.resolve({ data: [], error: null }), 0), /lo phai la so nguyen duong/);
  await assert.rejects(() => docTatCa(() => Promise.resolve({ data: [], error: null }), -5), /lo phai la so nguyen duong/);
});

test('khoang (tu, den) truyen vao dung la mot khoang dong, lien tiep', async () => {
  const khoang: Array<[number, number]> = [];
  await docTatCa((tu, den) => {
    khoang.push([tu, den]);
    const con = khoang.length === 1 ? 500 : 0;
    return Promise.resolve({ data: Array.from({ length: con }, (_, i) => ({ id: i })), error: null });
  }, 500);
  assert.deepEqual(khoang, [[0, 499], [500, 999]]);
});
