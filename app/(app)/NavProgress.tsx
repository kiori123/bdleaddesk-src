'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Vach chay tren dinh trang trong luc chuyen trang.
 *
 * VAN DE: moi trang trong app deu render tai may chu va goi Supabase vai lan.
 * Bam vao mot brand roi phai doi mot hai giay MA MAN HINH KHONG DOI GI CA:
 * van trang cu, van con tro cu. PIC khong biet la may nhan chua nen bam lai
 * lan hai, lan ba, va cang bam cang cham.
 *
 * Khong dung useLinkStatus cua Next vi no chi biet mot the Link cu the. Cai can
 * la mot dau hieu chung cho MOI duong dan trong app, ke ca the <a> thuong.
 *
 * Cach lam: nghe su kien bam o cap tai lieu. Bam vao mot duong dan noi bo thi
 * bat vach chay, va tat khi duong dan tren thanh dia chi doi that su.
 */
export default function NavProgress() {
  const path = usePathname();
  const [dangDi, setDangDi] = useState(false);

  // Duong dan doi tuc la trang moi da den. Tat vach.
  useEffect(() => { setDangDi(false); }, [path]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      // Bam giu Ctrl, Cmd, Shift hoac bam nut giua la mo tab moi: trang hien
      // tai khong di dau ca, bat vach la sai.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey
        || e.shiftKey || e.altKey) return;

      const a = (e.target as HTMLElement)?.closest?.('a');
      if (!a) return;

      const href = a.getAttribute('href') ?? '';
      const target = a.getAttribute('target');
      if (!href || target === '_blank' || a.hasAttribute('download')) return;
      // Chi duong dan noi bo. Link ra LinkedIn hay Outlook mo tab khac, trang
      // nay dung yen.
      if (!href.startsWith('/') || href.startsWith('//')) return;

      // Bam lai dung trang dang dung thi khong co gi de doi.
      const dich = href.split('#')[0].split('?')[0];
      if (dich === path) return;

      setDangDi(true);
    }

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [path]);

  // Chot chan. Neu vi ly do nao do duong dan khong bao gio doi (bi middleware
  // chan, mang rot), vach phai tu tat chu khong duoc chay mai mai.
  useEffect(() => {
    if (!dangDi) return;
    const t = setTimeout(() => setDangDi(false), 15_000);
    return () => clearTimeout(t);
  }, [dangDi]);

  if (!dangDi) return null;
  return <div className="navprog" aria-hidden />;
}
