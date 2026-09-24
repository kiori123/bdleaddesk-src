'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { myNotifications, markRead, markAllRead, type Notif } from './notifActions';

function ago(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3.6e6);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d}d ago`;
}

export default function Bell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const unread = items.filter((n) => !n.read_at).length;

  async function load() { setItems(await myNotifications()); }

  useEffect(() => {
    load();
    // Nhac viec chay 06:15, khong phai realtime. Hoi lai moi 5 phut la du va
    // re hon nhieu so voi mo mot ket noi realtime chi de cho mot dong.
    const t = setInterval(load, 5 * 60_000);
    // Bam nut nap lai tren header thi doc lai luon, khoi cho het 5 phut.
    window.addEventListener('bdlh:napLai', load);
    return () => {
      clearInterval(t);
      window.removeEventListener('bdlh:napLai', load);
    };
  }, []);

  // dong khi bam ra ngoai
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function go(n: Notif) {
    start(async () => {
      if (!n.read_at) { await markRead(n.id); }
      setOpen(false);
      await load();
      if (n.link) router.push(n.link);
    });
  }

  /**
   * Vi tri cua bang thong bao.
   *
   * Truoc day bang nay dung position:absolute voi right:0 va rong 320px, neo
   * vao cai nut rong 32px. Tren dien thoai, header xuong hai hang va cai nut
   * nam gan mep TRAI, nen 320px do do ra ngoai man hinh ben trai: chu bi cat
   * mat dau, doc thanh "...ung need attention".
   *
   * Nay do toa do that cua nut roi dat bang bang position:fixed, VA chan hai
   * dau. Chi thu hep be ngang thoi thi CHUA du: nut nam o x=166 tren may 412px
   * nen neo mep phai vao nut la day bang lui 320px ve trai, thanh left = -159.
   * Do dung la cai anh chup duoc. Nen `right` con bi keo ve toi da
   * innerWidth - rong - 8, tuc la trai cung cach mep 8px.
   */
  const BE = 8;      // chua le hai ben man hinh
  const RONG = 320;  // be ngang mong muon tren man hinh rong

  const [oDau, setODau] = useState<{ top: number; right: number; rong: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const do_ = () => {
      const r = box.current?.getBoundingClientRect();
      if (!r) return;
      const mh = window.innerWidth;
      const rong = Math.min(RONG, mh - BE * 2);
      // Neo theo nut, nhung khong duoc de mep trai am.
      const right = Math.min(Math.max(BE, mh - r.right), mh - rong - BE);
      setODau({ top: r.bottom + 8, right, rong });
    };
    do_();
    // Header dinh tren cung nen cuon khong lam nut xe dich, chi can nghe doi
    // kich thuoc va xoay may.
    window.addEventListener('resize', do_);
    return () => window.removeEventListener('resize', do_);
  }, [open]);

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`hico${unread > 0 ? ' ok' : ''}`}
        title={unread ? `${unread} unread` : 'Notifications'}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        {/* Truoc day cho o day mot ky tu &#9673; (hinh tron long tron). Khong ai
            nhin ra do la thong bao. Ve han hinh cai chuong, va co thu thi cho no
            nghieng mot chut cho de nhan ra la co viec moi. */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden
          style={unread > 0 ? { transform: 'rotate(-11deg)' } : undefined}>
          <path d="M18 8.5a6 6 0 1 0-12 0c0 5.2-2 6.7-2 6.7h16s-2-1.5-2-6.7" />
          <path d="M13.7 19a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5, minWidth: 17, height: 17,
            padding: '0 4px', borderRadius: 9, background: 'var(--acc)', color: '#fff',
            fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center',
            justifyContent: 'center', border: '2px solid #fff',
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          top: oDau?.top ?? 56,
          right: oDau?.right ?? BE,
          // Do xong moi biet rong bao nhieu, nen giu min() lam gia tri tam cho
          // mot khung hinh dau tien.
          width: oDau ? oDau.rong : 'min(320px, calc(100vw - 16px))',
          zIndex: 60,
          background: '#fff', border: '1px solid var(--bd)', borderRadius: 12,
          boxShadow: '0 10px 34px rgba(14,34,40,.18)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '11px 14px', borderBottom: '1px solid var(--bd)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <b style={{ fontSize: 12.5, flex: 1 }}>Notifications</b>
            {unread > 0 && (
              <button className="mini"
                onClick={() => start(async () => { await markAllRead(); await load(); })}>
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 340, overflowY: 'auto' }}>
            {items.length === 0 && (
              <div style={{ padding: '22px 14px', textAlign: 'center', fontSize: 12, color: 'var(--faint)' }}>
                Nothing yet. Reminders land here when a case goes stale.
              </div>
            )}

            {items.map((n) => (
              <button key={n.id} onClick={() => go(n)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                  padding: '11px 14px', border: 0, borderBottom: '1px solid var(--bd)',
                  background: n.read_at ? '#fff' : 'var(--tlt)', font: 'inherit',
                }}>
                <div style={{
                  fontSize: 12.5, fontWeight: n.read_at ? 500 : 700, marginBottom: 3,
                }}>{n.title}</div>
                {n.body && (
                  <div style={{ fontSize: 11.5, color: 'var(--dim)', lineHeight: 1.45 }}>{n.body}</div>
                )}
                <div style={{ fontSize: 10.5, color: 'var(--faint)', marginTop: 4 }}>{ago(n.created_at)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
