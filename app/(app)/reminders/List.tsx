'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { themNhac, xongNhac, xoaNhac, dongNhac, aiDaXong, type Nhac } from './actions';

/**
 * Nhac viec cua ca team.
 *
 * Chi ADMIN duoc them, va den han thi moi PIC deu nhan chuong. Nguoi thuong vao
 * day chi doc va tich xong phan cua minh, nen o soan thao khong hien voi ho:
 * hien mot cai o ma bam vao bao "khong co quyen" thi te hon la khong hien.
 *
 * Bao theo NGAY, khong theo gio: nhac viec cua BD la chuyen cua ngay hom do,
 * them gio chi sinh ra lech mui gio ma khong ai duoc loi.
 */

const hnay = () => new Date().toISOString().slice(0, 10);

function themNgay(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function List({
  dsNhac, brands, admin,
}: { dsNhac: Nhac[]; brands: { id: string; name: string }[]; admin: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');

  const [ten, setTen] = useState('');
  const [ghiChu, setGhiChu] = useState('');
  const [ngay, setNgay] = useState(themNgay(7));
  const [brandId, setBrandId] = useState('');

  // id -> danh sach ai xong / ai chua, chi admin xem
  const [ai, setAi] = useState<Record<string, { xong: string[]; chua: string[] }>>({});

  const dangChay = dsNhac.filter((n) => !n.closed_at);
  const daDong = dsNhac.filter((n) => n.closed_at);

  function chay(fn: () => Promise<any>, sau?: () => void) {
    setErr('');
    start(async () => {
      const r = await fn();
      if (r?.error) { setErr(r.error); return; }
      sau?.();
    });
  }

  const label = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint';
  const input =
    'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-teal-deep';

  function Dong({ n }: { n: Nhac }) {
    const tre = !n.closed_at && !n.toiDaXong && n.due_on < hnay();
    const homNay = !n.closed_at && !n.toiDaXong && n.due_on === hnay();
    const soAi = ai[n.id];

    return (
      <div className={`flex flex-wrap items-start gap-3 rounded-lg border bg-white px-3.5 py-3 ${
        tre ? 'border-red-deep' : homNay ? 'border-teal-deep' : 'border-line'
      }`}>
        <input
          type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-teal-deep"
          checked={n.toiDaXong} disabled={pending}
          title="Tick it off for yourself"
          onChange={(e) => chay(() => xongNhac(n.id, e.target.checked))}
        />
        <span className="min-w-0 flex-1">
          <b className={`block text-[13.5px] ${n.toiDaXong || n.closed_at ? 'text-ink-faint line-through' : ''}`}>
            {n.title}
          </b>
          <span className="mt-0.5 block text-[11.5px] text-ink-faint">
            {n.closed_at ? <b>Closed</b>
              : tre ? <b className="text-red-deep">Overdue, was due {n.due_on}</b>
                : homNay ? <b className="text-teal-deep">Due today</b>
                  : `Due ${n.due_on}`}
            {n.nguoiVietTen && <span> · from {n.nguoiVietTen}</span>}
            {n.brand && (
              <>
                <span> · </span>
                <Link href={`/brand/${n.brand_id}`} className="font-semibold text-teal-deep hover:underline">
                  {n.brand.name}
                </Link>
              </>
            )}
            {!n.toiDaXong && !n.closed_at && n.notified_at && <span> · already in your bell</span>}
          </span>
          {n.note && <span className="mt-1 block text-[12px] text-ink-dim">{n.note}</span>}

          {soAi && (
            <span className="mt-2 block text-[11.5px] leading-relaxed text-ink-dim">
              <b className="text-teal-deep">Ticked off ({soAi.xong.length}):</b>{' '}
              {soAi.xong.length ? soAi.xong.join(', ') : 'nobody yet'}
              <br />
              <b className="text-red-deep">Still open ({soAi.chua.length}):</b>{' '}
              {soAi.chua.length ? soAi.chua.join(', ') : 'nobody'}
            </span>
          )}
        </span>

        {admin && (
          <span className="flex shrink-0 flex-wrap gap-1.5">
            <button
              type="button" className="mini" disabled={pending}
              onClick={() => {
                if (soAi) { setAi((s) => { const c = { ...s }; delete c[n.id]; return c; }); return; }
                start(async () => {
                  const r: any = await aiDaXong(n.id);
                  if (r?.error) { setErr(r.error); return; }
                  setAi((s) => ({ ...s, [n.id]: r }));
                });
              }}
            >
              {soAi ? 'Hide who' : 'Who is done'}
            </button>
            <button
              type="button" className="mini" disabled={pending}
              onClick={() => chay(() => dongNhac(n.id, !n.closed_at))}
            >
              {n.closed_at ? 'Reopen' : 'Close'}
            </button>
            <button
              type="button" className="mini" disabled={pending}
              onClick={() => { if (confirm(`Delete "${n.title}" for the whole team?`)) chay(() => xoaNhac(n.id)); }}
            >
              Delete
            </button>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bento" style={{ flex: 1, alignItems: 'stretch' }}>
      <div className="tile g-list" style={{ padding: '16px 18px 18px' }}>
        {err && (
          <p className="mb-4 rounded-lg border border-red-deep/30 bg-white px-4 py-3 text-[13px] text-red-deep">{err}</p>
        )}

        {dangChay.length === 0 ? (
          <p className="note">
            {admin ? 'Nothing running. Add one on the right.' : 'Nothing from the admins right now.'}
          </p>
        ) : (
          <>
            <div className="mb-4 flex items-baseline gap-2.5 border-b-2 border-teal-deep pb-1.5">
              <span className="font-display text-sm uppercase tracking-wide text-teal-deep">Team reminders</span>
              <span className="text-[11px] font-semibold text-ink-faint">{dangChay.length}</span>
            </div>
            <div className="grid gap-2">
              {dangChay.map((n) => <Dong key={n.id} n={n} />)}
            </div>
          </>
        )}

        {daDong.length > 0 && (
          <>
            <div className="mb-3 mt-7 flex items-baseline gap-2.5 border-b-2 border-line pb-1.5">
              <span className="font-display text-sm uppercase tracking-wide text-ink-dim">Closed</span>
              <span className="text-[11px] font-semibold text-ink-faint">{daDong.length}</span>
            </div>
            <div className="grid gap-2">
              {daDong.slice(0, 20).map((n) => <Dong key={n.id} n={n} />)}
            </div>
          </>
        )}
      </div>

      {admin ? (
        <div className="tile g-side" style={{ alignSelf: 'stretch' }}>
          <div className="chead">
            <div>
              <div className="ct">New team reminder</div>
              <div className="cs">Everyone gets it</div>
            </div>
          </div>

          <div className="cbody" style={{ paddingTop: 12 }}>
            <div className="mb-3">
              <label className={label} htmlFor="rt">What</label>
              <input id="rt" className={input} value={ten}
                placeholder="Update your pipeline before the Friday review"
                onChange={(e) => setTen(e.target.value)} />
            </div>

            <div className="mb-3">
              <label className={label} htmlFor="rd">When</label>
              <input id="rd" type="date" className={input} value={ngay}
                min={hnay()} onChange={(e) => setNgay(e.target.value)} />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <button type="button" className="mini" onClick={() => setNgay(themNgay(1))}>Tomorrow</button>
                <button type="button" className="mini" onClick={() => setNgay(themNgay(7))}>In a week</button>
                <button type="button" className="mini" onClick={() => setNgay(themNgay(30))}>In a month</button>
              </div>
            </div>

            <div className="mb-3">
              <label className={label} htmlFor="rb">
                Brand <span className="normal-case text-ink-faint">optional</span>
              </label>
              <select id="rb" className={input} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                <option value="">Not about a brand</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">
                The brand name shows in the reminder, but only PICs who cover that category can
                open it.
              </p>
            </div>

            <div className="mb-4">
              <label className={label} htmlFor="rn">
                Note <span className="normal-case text-ink-faint">optional</span>
              </label>
              <textarea id="rn" className={`${input} min-h-[70px]`} value={ghiChu}
                onChange={(e) => setGhiChu(e.target.value)} />
            </div>

            {pending && (
              <span className="progrow" style={{ marginBottom: 10 }}>
                <span className="prog" />
                <span className="progtxt">Saving</span>
              </span>
            )}

            <button
              className="btn" disabled={pending || !ten.trim()}
              onClick={() => chay(
                () => themNhac({ title: ten, note: ghiChu, due_on: ngay, brand_id: brandId || null }),
                () => { setTen(''); setGhiChu(''); setBrandId(''); setNgay(themNgay(7)); },
              )}
            >
              {pending ? 'Saving' : 'Send to the team'}
            </button>

            <p className="mt-3 text-[11.5px] leading-snug text-ink-faint">
              It lands in every active PIC’s bell on the morning of that day, and skips anyone who
              already ticked it off. Past the date and still not ticked, it shows as overdue.
            </p>
          </div>
        </div>
      ) : (
        <div className="tile g-side" style={{ alignSelf: 'stretch' }}>
          <div className="chead">
            <div>
              <div className="ct">Set by admins</div>
              <div className="cs">Read only for you</div>
            </div>
          </div>
          <div className="cbody" style={{ paddingTop: 12 }}>
            <p className="note">
              These are reminders for the whole team, so only an admin can add or remove one.
              Tick a reminder off once you have done it and it stops chasing you, without
              touching anyone else’s list.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
