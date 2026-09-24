'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Khung modal ve thang vao document.body.
 *
 * Hai lop ngoai cung CO Y KHONG mang class nao. Truoc day chung mang
 * .modal-bg / .modal, va globals.css dat !important len do nen style inline bi
 * de bep: khung bi bo hep lai, cat mat phan dau va cum nut o duoi. Khong class
 * thi khong rule nao voi toi duoc, nen kich thuoc va vi tri o day la thu cuoi
 * cung quyet dinh.
 *
 * Cac class ben trong (.modal-h, .modal-b, .modal-f, .fld, .finput...) van giu
 * nguyen, chung chi to mau chu khong dinh vi.
 */
export default function Modal({
  open, onClose, width = 480, children,
}: {
  open: boolean;
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        margin: 0,
        background: 'rgba(14, 34, 40, .45)',
        boxSizing: 'border-box',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'relative',
          width: `min(${width}px, calc(100vw - 32px))`,
          maxWidth: 'none',
          minWidth: 0,
          height: 'auto',
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          margin: 0,
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 10px 40px rgba(14,34,40,.22)',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
