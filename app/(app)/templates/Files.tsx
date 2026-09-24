'use client';

import { useEffect, useState, useTransition } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import {
  fileCuaMau, ghiFile, linkTaiVe, doiChiaSe, xoaFile, type FileMau,
} from './fileActions';

/**
 * File gui kem mot mau thu: ho so nang luc, bang gia, bo anh.
 *
 * PHAI NOI RO NGAY TU DAU: khong co cach nao dinh file thang vao thu qua nut
 * Email. Trinh duyet khong duoc phep gan file vao thu ho nguoi dung, do la chan
 * ve bao mat chu khong phai thieu tinh nang. Nen o day co hai duong, va man
 * hinh phai lam ro dang dung duong nao:
 *
 *   Tai ve  - PIC bam tai, roi tu dinh trong Outlook. File van kin.
 *   Chia se - sinh mot duong dan de chen vao thu. Ai co duong dan deu tai duoc.
 */

const TRAN = 25 * 1024 * 1024;

function co(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export default function Files(
  { templateId, khiDoi }: { templateId: string; khiDoi?: () => void },
) {
  const db = supabaseBrowser();
  const [ds, setDs] = useState<FileMau[]>([]);
  const [pending, start] = useTransition();
  const [tai, setTai] = useState(false);
  const [msg, setMsg] = useState('');

  async function nap() {
    setDs(await fileCuaMau(templateId).catch(() => []));
    // Bao cho man soan biet de xem thu ve lai: {{files}} phai doi ngay khi bat
    // hay tat chia se, khong thi PIC tuong nut khong an.
    khiDoi?.();
  }

  useEffect(() => { nap(); /* eslint-disable-next-line */ }, [templateId]);

  async function len(f: File | null) {
    if (!f) return;
    setMsg('');
    if (f.size > TRAN) {
      setMsg(`That file is ${co(f.size)}, over the 25 MB limit.`);
      return;
    }

    setTai(true);
    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { setMsg('Your session expired. Reload the page.'); return; }

      // Ten goc co the trung nhau giua cac mau, va co the chua ky tu lam hong
      // duong dan. Dat mot ma ngau nhien o dau va don ten lai.
      const sach = f.name.replace(/[\\/\r\n]+/g, ' ').trim().slice(0, 120);
      const path = `${user.id}/${crypto.randomUUID()}-${sach}`;

      const { error } = await db.storage.from('outreach-files').upload(path, f);
      if (error) { setMsg(error.message); return; }

      const r = await ghiFile(templateId, path, sach, f.size);
      if (r?.error) { setMsg(r.error); return; }
      await nap();
    } finally {
      setTai(false);
    }
  }

  function chay(fn: () => Promise<any>) {
    setMsg('');
    start(async () => {
      const r = await fn();
      if (r?.error) { setMsg(r.error); return; }
      await nap();
    });
  }

  async function moFile(id: string) {
    setMsg('');
    const r = await linkTaiVe(id);
    if (r?.error || !r?.url) { setMsg(r?.error ?? 'Could not open that file.'); return; }
    window.open(r.url, '_blank', 'noopener');
  }

  const coChiaSe = ds.some((f) => f.share_url);

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          Files
        </span>
        <label className="mini" style={{ cursor: tai ? 'default' : 'pointer' }}>
          {tai ? 'Uploading…' : 'Upload a file'}
          <input type="file" className="hidden" disabled={tai}
            onChange={(e) => { len(e.target.files?.[0] ?? null); e.target.value = ''; }} />
        </label>
      </div>

      {msg && (
        <p className="mb-2 rounded-lg border border-red-deep/30 bg-white px-3 py-2 text-[12px] text-red-deep">
          {msg}
        </p>
      )}

      {(tai || pending) && (
        <span className="progrow" style={{ marginBottom: 8 }}>
          <span className="prog" />
          <span className="progtxt">{tai ? 'Uploading, do not close the tab' : 'Working'}</span>
        </span>
      )}

      {ds.length === 0 ? (
        <p className="max-w-[62ch] text-[11.5px] leading-snug text-ink-faint">
          Nothing here yet. Upload the company profile or a price list once, and it is ready
          on every brand page.
        </p>
      ) : (
        <div className="grid gap-1.5">
          {ds.map((f) => (
            <div key={f.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white px-3 py-2">
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[12.5px]">{f.name}</b>
                <span className="text-[11px] text-ink-faint">
                  {co(f.size)}
                  {f.share_url && <span className="text-teal-deep"> · link in the email</span>}
                </span>
              </span>

              <button type="button" className="mini" onClick={() => moFile(f.id)}>
                Download
              </button>

              <button
                type="button" className={`mini${f.share_url ? ' ok' : ''}`} disabled={pending}
                onClick={() => chay(() => doiChiaSe(f.id, !f.share_url))}
              >
                {f.share_url ? 'Sharing on' : 'Share by link'}
              </button>

              <button
                type="button" className="mini" disabled={pending}
                onClick={() => {
                  if (!confirm(`Delete ${f.name}?`)) return;
                  chay(() => xoaFile(f.id));
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Doan nay TRUOC DAY la chu xam 11.5px lan giua cac dong khac, PIC luot
          qua khong doc. Ma no la thu quan trong nhat o day: no giai thich vi sao
          khong co nut dinh kem, va khac nhau giua hai duong Tai ve va Chia se.
          Doc nham la gui link cong khai ra ngoai ma tuong la file rieng. */}
      <div className="mt-3 rounded-lg border border-line bg-surface-sunk p-3.5">
        <b className="block text-[13px] text-ink">The Email button cannot attach a file</b>
        <p className="mt-1 max-w-[64ch] text-[12.5px] leading-relaxed text-ink-dim">
          No browser is allowed to attach a file to an email on your behalf. That is a
          security rule, not a missing feature, so these two are what exist:
        </p>

        <div className="mt-2.5 grid gap-2">
          <div className="rounded-lg border-l-[3px] border-teal-deep bg-white px-3 py-2.5">
            <b className="text-[12.5px] text-ink">Download</b>
            <span className="ml-1.5 text-[11px] font-semibold uppercase tracking-wide text-teal-deep">
              stays private
            </span>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-dim">
              Gets you the file so you attach it yourself in Outlook. Nobody outside the app
              can open it.
            </p>
          </div>

          <div className="rounded-lg border-l-[3px] border-red-deep bg-white px-3 py-2.5">
            <b className="text-[12.5px] text-ink">Share by link</b>
            <span className="ml-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-deep">
              anyone with the link
            </span>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-dim">
              Puts a download link in the email instead. Whoever holds that link can fetch the
              file, including anyone it gets forwarded to. Turning sharing off renames the file
              so the old links stop working.
              {coChiaSe && (
                <> Put <b className="text-ink">{'{{files}}'}</b> in the body where you want the
                  links to appear.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
