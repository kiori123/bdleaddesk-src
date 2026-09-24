/*
 * Service worker toi thieu, CO Y KHONG CACHE GI CA.
 *
 * Chrome doi mot service worker co bat su kien fetch thi moi coi trang la cai
 * duoc va hien nut Install. Day la ly do duy nhat file nay ton tai.
 *
 * Khong cache vi app doc du lieu song tu Supabase: credit con lai, han muc ngay,
 * trang thai job. Cache mot man hinh cu roi tra lai cho PIC la dua ho di quyet
 * dinh tren so lieu sai, tệ hơn nhiều so voi viec mo cham vai tram mili giay.
 * Ngoai ra ban da tung mat cong go tim vi bản cu con nam lai; them mot lop cache
 * nua chi lam chuyen do kho lan ra hon.
 *
 * skipWaiting + clients.claim: ban service worker moi thay ban cu ngay, khong
 * doi dong het cua so. Neu khong, sua xong deploy roi ma may PIC van chay ban cu
 * cho toi khi ho tat het cua so app.
 */

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      // Don sach neu tung co ban nao cache. Khong co thi vong nay chay rong.
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

// Di thang ra mang, khong xen vao giua.
self.addEventListener('fetch', () => {});
