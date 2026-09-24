'use client';

import { useEffect } from 'react';

/**
 * Dang ky service worker. Chrome doi mot service worker co bat fetch thi moi
 * coi trang la cai duoc va hien nut Install tren thanh dia chi.
 *
 * Ban service worker cua minh khong cache gi, xem public/sw.js.
 */
export default function RegisterSW() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Dang ky sau khi trang tai xong, de khong tranh bang thong voi nhung thu
    // nguoi dung dang cho nhin thay.
    const dangKy = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Cai app la tien ich them, khong phai chuc nang chinh. Hong thi im
        // lang, khong lam phien PIC bang mot loi ho khong the tu xu.
      });
    };

    if (document.readyState === 'complete') dangKy();
    else {
      window.addEventListener('load', dangKy);
      return () => window.removeEventListener('load', dangKy);
    }
  }, []);

  return null;
}
