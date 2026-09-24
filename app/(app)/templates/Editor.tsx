'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import {
  TRUONG, dienMau, choTrongTrongMau, nguonTuContact, TRAN_DUONG_DAN,
} from '@/lib/template';
import { themMau, luuMau, datMacDinh, xoaMau, type Mau } from './actions';
import Files from './Files';
import { fileCuaMau } from './fileActions';

/**
 * Soan mau thu outreach.
 *
 * Ba thu man nay bat buoc phai co, va deu vi cung mot ly do: thu nay di thang
 * ra hop thu cua khach hang that.
 *
 *   1. Nut chen cho trong. Go tay "{{fist_name}}" sai mot ky tu thi luc gui no
 *      nam nguyen trong thu.
 *   2. Xem thu voi nguoi that. Doc mau tho khong ai thay duoc cau van se ra sao.
 *   3. Ke ten cho trong con thieu. Day la ly do chinh: "I noticed you {{bio}}"
 *      ma bio rong thi thu di ra mot lo hong giua dong.
 */

type NguoiThu = {
  full_name: string; job_title: string | null; location: string | null;
  bio: string | null; brand: string; email: string | null;
};

export default function Editor({
  dsMau, toi, nguoiThu,
}: {
  dsMau: Mau[];
  toi: { name: string; email: string };
  nguoiThu: NguoiThu | null;
}) {
  const [chonId, setChonId] = useState<string | null>(dsMau[0]?.id ?? null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');
  const [tin, setTin] = useState('');

  const mau = dsMau.find((m) => m.id === chonId) ?? null;

  const [ten, setTen] = useState(mau?.name ?? '');
  const [tieuDe, setTieuDe] = useState(mau?.subject ?? '');
  const [than, setThan] = useState(mau?.body ?? '');
  const [cc, setCc] = useState(mau?.cc ?? '');
  // File da bat chia se cua mau dang chon, chi de xem thu {{files}}.
  const [fileChiaSe, setFileChiaSe] = useState<{ name: string; url: string }[]>([]);

  async function napFile(id: string | null) {
    if (!id) { setFileChiaSe([]); return; }
    const ds = await fileCuaMau(id).catch(() => []);
    setFileChiaSe(ds.filter((f) => f.share_url).map((f) => ({ name: f.name, url: f.share_url! })));
  }

  const oThan = useRef<HTMLTextAreaElement>(null);
  const oTieuDe = useRef<HTMLInputElement>(null);
  // O nao vua go, de nut chen biet nhet vao dau.
  const [oCuoi, setOCuoi] = useState<'subject' | 'body'>('body');

  // Doi mau dang chon thi nap lai ba o. Bo dong nay la sua mau A xong bam sang
  // mau B van thay noi dung cua A.
  useEffect(() => {
    setTen(mau?.name ?? '');
    setTieuDe(mau?.subject ?? '');
    setThan(mau?.body ?? '');
    setCc(mau?.cc ?? '');
    setErr(''); setTin('');
    napFile(chonId);
  }, [chonId]); // eslint-disable-line react-hooks/exhaustive-deps

  const banDau = mau && (ten !== mau.name || tieuDe !== mau.subject || than !== mau.body || cc !== mau.cc);

  // Dung CHUNG nguonTuContact voi nut Email o trang brand. Tu viet lai o day
  // thi man xem thu hien mot dang con thu that di mot dang khac, ma khong co gi
  // bao. Da suyt dinh: ban dau cho nay tu lay tu cuoi lam ten goi, nen
  // "Tien Tran (Millie)" xem thu ra "(Millie)" con thu that ra "Tien".
  const nguon = nguoiThu
    ? nguonTuContact({
      full_name: nguoiThu.full_name, job_title: nguoiThu.job_title,
      location: nguoiThu.location, bio: nguoiThu.bio, brand: nguoiThu.brand,
      senderName: toi.name, senderEmail: toi.email, files: fileChiaSe,
    })
    : nguonTuContact({
      full_name: 'Nguyễn Thị Ngọc Anh', job_title: 'Marketing Director',
      location: 'Ho Chi Minh City, Viet Nam', brand: 'Nutifood',
      bio: 'leads brand and trade marketing across modern trade',
      senderName: toi.name, senderEmail: toi.email, files: fileChiaSe,
    });

  const xemTieuDe = dienMau(tieuDe, nguon);
  const xemThan = dienMau(than, nguon);
  const thieu = [...new Set([...xemTieuDe.thieu, ...xemThan.thieu])];

  const dungKhong = choTrongTrongMau(`${tieuDe} ${than}`)
    .filter((k) => !TRUONG.some((t) => t.key === k));

  const daiEncode = encodeURIComponent(xemThan.text).length;

  function chen(key: string) {
    const the = `{{${key}}}`;
    if (oCuoi === 'subject') {
      const el = oTieuDe.current;
      const i = el?.selectionStart ?? tieuDe.length;
      setTieuDe(tieuDe.slice(0, i) + the + tieuDe.slice(i));
      requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(i + the.length, i + the.length); });
    } else {
      const el = oThan.current;
      const i = el?.selectionStart ?? than.length;
      setThan(than.slice(0, i) + the + than.slice(i));
      requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(i + the.length, i + the.length); });
    }
  }

  function chay(fn: () => Promise<any>, xong?: string) {
    setErr(''); setTin('');
    start(async () => {
      const r = await fn();
      if (r?.error) { setErr(r.error); return; }
      if (xong) setTin(xong);
    });
  }

  const label = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint';
  const input =
    'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-teal-deep';

  return (
    <div className="bento" style={{ flex: 1, alignItems: 'stretch' }}>
      {/* Khoi SOAN phai dung truoc trong DOM du no hien ben trai.
          .g-list chiem cot 1-4 con .g-side chiem cot 4-5. Dat g-side truoc thi
          luoi xep no vao hang 1 cot 4, con g-list khong con du cho o hang 1 nen
          bi day xuong hang 2, de lai mot mang trong to o goc tren ben trai. */}
      {/* ---------- soan ---------- */}
      <div className="tile g-list" style={{ padding: '16px 18px 18px' }}>
        {err && (
          <p className="mb-4 rounded-lg border border-red-deep/30 bg-white px-4 py-3 text-[13px] text-red-deep">{err}</p>
        )}
        {tin && (
          <p className="mb-4 rounded-lg border border-teal-deep/40 bg-white px-4 py-3 text-[13px] text-teal-deep">{tin}</p>
        )}

        {!mau ? (
          <p className="note">Pick a template on the right, or add one.</p>
        ) : (
          <>
            <div className="mb-4">
              <label className={label} htmlFor="tname">Template name</label>
              <input id="tname" className={input} value={ten} onChange={(e) => setTen(e.target.value)} />
            </div>

            <div className="mb-4">
              <label className={label} htmlFor="tsub">Subject</label>
              <input
                id="tsub" ref={oTieuDe} className={input} value={tieuDe}
                onFocus={() => setOCuoi('subject')}
                onChange={(e) => setTieuDe(e.target.value)}
              />
            </div>

            <div className="mb-4">
              <label className={label} htmlFor="tcc">
                CC <span className="normal-case text-ink-faint">optional, separate with commas</span>
              </label>
              <input
                id="tcc" className={input} value={cc}
                placeholder="sep@onpoint.vn, bd-team@onpoint.vn"
                onChange={(e) => setCc(e.target.value)}
              />
              <p className="mt-1.5 max-w-[62ch] text-[11.5px] leading-snug text-ink-faint">
                Cung mot danh sach cho moi thu gui bang mau nay. Outlook thinh thoang khong
                dien san o CC, nhat la khi phien dang nhap vua het han, nen kiem lai truoc
                khi bam Send.
              </p>
            </div>

            <div className="mb-4">
              <label className={label} htmlFor="tbody">Body</label>
              <textarea
                id="tbody" ref={oThan} className={`${input} min-h-[240px] font-mono text-[12.5px] leading-relaxed`}
                value={than}
                onFocus={() => setOCuoi('body')}
                onChange={(e) => setThan(e.target.value)}
              />
            </div>

            {/* ---------- file gui kem ---------- */}
            <Files templateId={mau.id} khiDoi={() => napFile(mau.id)} />

            {/* ---------- chen cho trong ---------- */}
            <div className="mb-4">
              <span className={label}>
                Insert a field <span className="normal-case text-ink-faint">goes into whichever box you last touched</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {TRUONG.map((t) => (
                  <button key={t.key} type="button" className="mini" onClick={() => chen(t.key)}>
                    {t.nhan}
                    {t.hayRong && <span className="ml-1.5 font-normal opacity-60">hay rỗng</span>}
                  </button>
                ))}
              </div>
            </div>

            {dungKhong.length > 0 && (
              <div className="mb-4 rounded-lg border-l-[3px] border-red-deep bg-surface-sunk px-4 py-3 text-[12.5px] leading-relaxed text-ink-dim">
                <b className="text-ink">These are not real fields: </b>
                {dungKhong.map((k) => `{{${k}}}`).join(', ')}. They will go out exactly like that,
                braces and all. Use the buttons above instead of typing them.
              </div>
            )}

            {/* ---------- xem thu ---------- */}
            <div className="mb-3 mt-7 flex items-baseline gap-2.5 border-b-2 border-line pb-1.5">
              <span className="font-display text-sm uppercase tracking-wide text-ink-dim">Preview</span>
              <span className="text-[11px] font-semibold text-ink-faint">
                {nguoiThu ? `using ${nguoiThu.full_name} at ${nguoiThu.brand}` : 'using a made up person'}
              </span>
            </div>

            {thieu.length > 0 && (
              <div className="mb-3 rounded-lg border-l-[3px] border-red-deep bg-surface-sunk px-4 py-3 text-[12.5px] leading-relaxed text-ink-dim">
                <b className="text-ink">
                  {thieu.map((k) => `{{${k}}}`).join(', ')} {thieu.length === 1 ? 'is' : 'are'} empty for this person.
                </b>{' '}
                The app will not let you send with a hole in the sentence. Either put that field
                on a line you can drop, or write around it.
              </div>
            )}

            <div className="rounded-lg border border-line bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Subject</div>
              <div className="mb-3 text-[13.5px] font-semibold">{xemTieuDe.text || <span className="text-ink-faint">empty</span>}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Body</div>
              <div className="whitespace-pre-wrap text-[13px] leading-relaxed">
                {xemThan.text || <span className="text-ink-faint">empty</span>}
              </div>
            </div>

            <p className="mt-2 text-[11.5px] text-ink-faint">
              {daiEncode > TRAN_DUONG_DAN
                ? `Too long: ${daiEncode} characters once encoded, and some corporate mail proxies cut the link at ${TRAN_DUONG_DAN}. Shorten it, or the end of the email quietly goes missing.`
                : `${daiEncode} of ${TRAN_DUONG_DAN} characters used. Plain text only, Outlook adds your own signature.`}
            </p>

            {/* ---------- nut ---------- */}
            <div
              className="mt-6 flex flex-wrap items-center gap-3"
              style={{ marginLeft: -18, marginRight: -18, padding: '15px 18px 0', borderTop: '1px solid var(--bd)' }}
            >
              <button
                className="btn" disabled={pending || !banDau}
                onClick={() => chay(() => luuMau(mau.id, { name: ten, subject: tieuDe, body: than, cc }), 'Saved.')}
              >
                {pending ? 'Working' : banDau ? 'Save' : 'Saved'}
              </button>

              {!mau.is_default && (
                <button className="btn2" disabled={pending}
                  onClick={() => chay(() => datMacDinh(mau.id), 'This is your default now.')}>
                  Make it my default
                </button>
              )}

              <button
                className="btn dg" disabled={pending}
                onClick={() => {
                  if (!confirm(`Delete "${mau.name}"?`)) return;
                  chay(async () => {
                    const r = await xoaMau(mau.id);
                    if (!r?.error) setChonId(dsMau.find((m) => m.id !== mau.id)?.id ?? null);
                    return r;
                  }, 'Deleted.');
                }}
              >
                Delete
              </button>

              {pending ? (
                <span className="progrow" style={{ flex: 1, minWidth: 160 }}>
                  <span className="prog" />
                  <span className="progtxt">Saving</span>
                </span>
              ) : (
                banDau && <span className="text-[12.5px] text-ink-faint">Unsaved changes</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* ---------- danh sach mau ---------- */}
      <div className="tile g-side" style={{ alignSelf: 'stretch' }}>
        <div className="chead">
          <div>
            <div className="ct">Your templates</div>
            <div className="cs">Only you can see these</div>
          </div>
        </div>

        <div className="cbody" style={{ paddingTop: 12 }}>
          {dsMau.length === 0 && (
            <p className="note" style={{ marginBottom: 12 }}>
              You have none yet. Start from the standard one and change what you want.
            </p>
          )}

          <div className="grid gap-1.5">
            {dsMau.map((m) => (
              <button
                key={m.id} type="button"
                onClick={() => setChonId(m.id)}
                className={`rounded-lg border px-3 py-2.5 text-left transition ${
                  m.id === chonId ? 'border-teal-deep bg-surface-sunk' : 'border-line bg-white hover:border-teal-deep'
                }`}
              >
                <span className="flex items-center gap-2">
                  <b className="truncate text-[13px]">{m.name}</b>
                  {m.is_default && (
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-teal-deep">
                      Default
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[11.5px] text-ink-faint">
                  {m.subject || 'No subject yet'}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn2" disabled={pending}
              onClick={() => chay(() => themMau(true), 'Added the standard template.')}>
              Add standard
            </button>
            <button className="btn2" disabled={pending}
              onClick={() => chay(() => themMau(false), 'Added a blank template.')}>
              Add blank
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
