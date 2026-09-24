'use client';

import { useEffect, useState } from 'react';

/**
 * Bao cho PIC biet co ban moi, va cho ho bam mot nut de nap lai.
 *
 * VAN DE THAT: app cai len desktop chay trong mot cua so rieng, PIC mo ra roi
 * de do ca ngay. Deploy xong thi may chu da co ban moi, nhung cua so dang mo
 * van giu nguyen doan JavaScript tai tu sang. Chuyen giua cac trang trong app
 * la dieu huong phia trinh duyet, khong tai lai trang, nen no khong bao gio
 * thay ban moi. Ket qua: sua xong bao anh "da len roi" ma PIC van thay y het cu.
 *
 * KHONG PHAI LOI SERVICE WORKER. Ban service worker cua minh khong cache gi,
 * xem public/sw.js. Them cache vao do chi lam chuyen nay te hon.
 *
 * Cach lam: ma so build duoc nhet thang vao code luc build (next.config.js).
 * Cua so dang mo mang ma so cu; /api/version do ban vua deploy phuc vu nen tra
 * ve ma so moi. Lech nhau la hien thanh bao.
 *
 * KHONG tu dong nap lai. PIC co the dang go do dang giua mot bieu mau, giat
 * trang duoi tay ho la mat cong go. De ho tu bam.
 */

const HOI_MOI = 90_000; // 90 giay

export default function UpdateBanner() {
  const [coBanMoi, setCoBanMoi] = useState(false);

  useEffect(() => {
    const cuaMinh = process.env.APP_BUILD_ID;
    // Chay `next dev` thi khong co ma so, bo qua han cho khoi phien nhieu.
    if (!cuaMinh || cuaMinh === 'dev') return;

    let da_thoat = false;

    async function kiem() {
      if (da_thoat || document.hidden) return;
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const { id } = await res.json();
        if (id && id !== cuaMinh) setCoBanMoi(true);
      } catch {
        // Mat mang thi im lang. Day la tien ich phu, khong duoc phep bao loi.
      }
    }

    const dinhKy = setInterval(kiem, HOI_MOI);
    // Quay lai cua so la luc dang de y nhat, va cung la luc hay co ban moi
    // nhat vi ho vua di dau do ve.
    window.addEventListener('focus', kiem);
    document.addEventListener('visibilitychange', kiem);
    kiem();

    return () => {
      da_thoat = true;
      clearInterval(dinhKy);
      window.removeEventListener('focus', kiem);
      document.removeEventListener('visibilitychange', kiem);
    };
  }, []);

  if (!coBanMoi) return null;

  return (
    <div className="updbar">
      <span className="updtxt">
        <b>A new version is ready.</b> This window is still running the old one.
      </span>
      <button
        type="button" className="updbtn"
        onClick={() => {
          // reload() thuong doc lai tu bo nho dem cua trinh duyet. Gan them mot
          // tham so vo hai buoc no phai di ra mang lay ban moi.
          const u = new URL(window.location.href);
          u.searchParams.set('v', String(Date.now()));
          window.location.replace(u.toString());
        }}
      >
        Reload now
      </button>
    </div>
  );
}
