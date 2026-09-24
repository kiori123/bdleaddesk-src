'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Duoi mot nguoi cu the. Hai duong, va chung KHAC NHAU o cho ton tien:
 *
 *   Bang ten + cong ty  -> chay mot lan quet binh thuong (mien phi, an vao tran
 *                          ngay), roi tu chon nguoi do trong man ket qua.
 *   Bang link LinkedIn  -> di thang sang reveal, 1 credit, khong dung tran ngay.
 *
 * Duong link nhanh hon va khong dung tran, nhung tru credit ngay ca khi ho go
 * nham link. Nen mac dinh la duong ten + cong ty: sai thi khong mat gi.
 */

type Cat = { id: string; name: string };

export default function PersonForm({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tab, setTab] = useState<'name' | 'link'>('name');
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');

  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [company, setCompany] = useState('');
  const [person, setPerson] = useState('');
  const [link, setLink] = useState('');

  const label = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint';
  const input =
    'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-teal-deep';

  function tabCls(on: boolean) {
    return `border-b-2 px-1 pb-2 text-[13px] font-semibold transition ${
      on ? 'border-teal-deep text-teal-deep' : 'border-transparent text-ink-faint hover:text-ink-dim'
    }`;
  }

  function chayTheoTen() {
    setErr(''); setDone('');
    if (!company.trim()) { setErr('Type the company or brand they work at.'); return; }
    if (!categoryId) { setErr('Pick the category this belongs to.'); return; }

    start(async () => {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId,
          brands: [{ name: company.trim(), tier: 1 }],
          location: 'Vietnam and Southeast Asia',
          role: 'Decision makers, all functions',
          // Ten nguoi di kem de man ket qua day ho len dau. KHONG gui sang
          // SignalHire lam dieu kien: ten viet sai mot dau la mat hut ca nguoi.
          prefs: { titleWords: [], chasing: person.trim() || null },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(body.error ?? 'Could not start the search.'); return; }
      router.push(`/scan/results/${body.jobId}`);
    });
  }

  function chayTheoLink() {
    setErr(''); setDone('');
    const url = link.trim();
    if (!/^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\//i.test(url)) {
      setErr('That does not look like a LinkedIn profile link. It should start with linkedin.com/in/');
      return;
    }
    // KHONG bat go brand o duong nay nua. Da co link cua chinh nguoi do thi cong
    // ty nam san trong ket qua reveal, bat go lai la bat lam ho may mot viec no
    // tu lam duoc. Go vao thi van dung, va de len cai may doan ra.
    if (!categoryId) { setErr('Pick the category this belongs to.'); return; }

    start(async () => {
      const res = await fetch('/api/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId,
          brandId: null,
          brandName: company.trim() || null,
          uids: [url],
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(body.error ?? 'Could not start the lookup.'); return; }
      setDone(
        company.trim()
          ? 'Asked for it. 1 credit is held and only charged if the lookup finds them. '
            + 'The contact appears on the brand page.'
          : 'Asked for it. 1 credit is held and only charged if the lookup finds them. '
            + 'The brand is taken from whatever company they list, so check the brand board '
            + 'afterwards in case it lands somewhere you did not expect.',
      );
      setLink('');
    });
  }

  return (
    <div className="tile" style={{ flex: 1, padding: '16px 18px 18px' }}>
      {err && (
        <p className="mb-4 rounded-lg border border-red-deep/30 bg-white px-4 py-3 text-[13px] text-red-deep">{err}</p>
      )}
      {done && (
        <p className="mb-4 rounded-lg border border-teal-deep/40 bg-white px-4 py-3 text-[13px] text-teal-deep">{done}</p>
      )}

      <div className="mb-6 flex gap-5 border-b border-line">
        <button type="button" className={tabCls(tab === 'name')} onClick={() => { setTab('name'); setErr(''); }}>
          By name and company
        </button>
        <button type="button" className={tabCls(tab === 'link')} onClick={() => { setTab('link'); setErr(''); }}>
          By LinkedIn link
        </button>
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="co">
            Brand or company
            {tab === 'link' && <span className="normal-case text-ink-faint"> optional</span>}
          </label>
          <input
            id="co" className={input} value={company} autoFocus
            placeholder={tab === 'link' ? 'Leave blank to use their own company' : 'Nutifood'}
            onChange={(e) => setCompany(e.target.value)}
          />
          {tab === 'link' && !company.trim() && (
            <p className="mt-1.5 max-w-[62ch] text-[11.5px] leading-snug text-ink-faint">
              Left blank, the contact is filed under whatever company they list on their own
              profile. Fill it in only when you want them filed under a different brand.
            </p>
          )}
        </div>
        <div>
          <label className={label} htmlFor="cat">Category</label>
          <select id="cat" className={input} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {tab === 'name' ? (
        <>
          <div className="mb-5">
            <label className={label} htmlFor="pn">
              Their name <span className="normal-case text-ink-faint">optional</span>
            </label>
            <input
              id="pn" className={input} value={person}
              placeholder="Nguyen Van A" onChange={(e) => setPerson(e.target.value)}
            />
            <p className="mt-1.5 max-w-[62ch] text-[11.5px] text-ink-faint">
              Used only to push them to the top of the results, never to filter. A name spelled
              slightly differently would otherwise lose the person entirely.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={chayTheoTen} disabled={pending || !company.trim()}
              className="rounded-lg bg-grad-teal px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-40"
            >
              {pending ? 'Searching' : 'Search'}
            </button>
            {pending ? (
              <span className="progrow" style={{ flex: 1, minWidth: 220 }}>
                <span className="prog" />
                <span className="progtxt">Searching, up to a minute</span>
              </span>
            ) : (
              <span className="text-[12.5px] text-ink-dim">
                Free. You pick who to pay for on the next screen.
              </span>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="mb-5">
            <label className={label} htmlFor="li">LinkedIn profile link</label>
            <input
              id="li" className={input} value={link}
              placeholder="https://www.linkedin.com/in/..."
              onChange={(e) => setLink(e.target.value)}
            />
            <p className="mt-1.5 max-w-[62ch] text-[11.5px] text-ink-faint">
              Skips the search entirely, so it does not use the daily limit. It does spend a
              credit, and a wrong link spends it too.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={chayTheoLink} disabled={pending || !link.trim()}
              className="rounded-lg bg-grad-red px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-40"
            >
              {pending ? 'Working' : 'Get contact · 1 credit'}
            </button>
            {pending ? (
              <span className="progrow" style={{ flex: 1, minWidth: 200 }}>
                <span className="prog" />
                <span className="progtxt">Looking them up</span>
              </span>
            ) : (
              <span className="text-[12.5px] text-ink-dim">Charged only if it finds them.</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
