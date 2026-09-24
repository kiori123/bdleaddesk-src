'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Nut nap lai du lieu tren header.
 *
 * VI SAO CAN. App cai len may chay trong cua so rieng: khong co thanh dia chi,
 * nen KHONG co nut nap lai cua trinh duyet. PIC mo app tu sang, den chieu quet
 * xong mot brand o may khac hoac cron chay xong reminder thi man hinh dang mo
 * van la du lieu cu, ma ho khong co cach nao bat no doc lai. Truoc gio ho phai
 * bam qua trang khac roi bam ve.
 *
 * KHONG dung location.reload(). Cai do nem ca trang di tai lai tu dau: mat vi
 * tri dang cuon, mat o dang go do dang, va tren 3G thi cho vai giay nhin trang
 * trang. router.refresh() chi hoi lai may chu phan du lieu roi ve lai cho cu.
 *
 * Ban JavaScript cu thi day KHONG phai viec cua nut nay: do la UpdateBanner,
 * no bat duoc ma so build lech va moi nap lai that su.
 *
 * Bam xong phai THAY CAI GI DO. Du lieu khong doi thi man hinh y het truoc, PIC
 * tuong nut hong. Nen: dang chay thi bieu tuong quay, xong thi nut sang len mot
 * nhip roi tat.
 */

const SANG = 1100; // giu trang thai "xong" bao lau, mili giay

export default function Reload() {
  const router = useRouter();
  const [dangChay, batDau] = useTransition();
  const [xong, setXong] = useState(false);
  const hen = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Doi cua so bi dong giua chung thi khong con setState vao thu da go bo.
  useEffect(() => () => { if (hen.current) clearTimeout(hen.current); }, []);

  function nap() {
    if (dangChay) return;
    setXong(false);
    if (hen.current) clearTimeout(hen.current);
    // Chuong nap thong bao bang JavaScript phia trinh duyet nen router.refresh()
    // khong cham toi no. Bao rieng mot tieng de no doc lai cung luc, khong thi
    // nap lai xong ma so tren chuong van la so cu.
    window.dispatchEvent(new Event('bdlh:napLai'));
    batDau(() => {
      router.refresh();
    });
  }

  // useTransition bao xong bang cach chuyen dangChay ve false.
  const truoc = useRef(false);
  useEffect(() => {
    if (truoc.current && !dangChay) {
      setXong(true);
      hen.current = setTimeout(() => setXong(false), SANG);
    }
    truoc.current = dangChay;
  }, [dangChay]);

  return (
    <button
      type="button"
      onClick={nap}
      disabled={dangChay}
      className={`hico${xong ? ' ok' : ''}`}
      title={dangChay ? 'Refreshing' : 'Refresh this page'}
      aria-label="Refresh"
    >
      {xong ? (
        // Dau tich: bao la da xong that, khong phai bam hut.
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
          className={dangChay ? 'spinq' : undefined}>
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      )}
    </button>
  );
}
