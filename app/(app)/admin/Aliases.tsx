'use client';

import { useMemo, useState, useTransition } from 'react';
import { saveAlias, deleteAlias } from './actions';

type Row = { alias: string; employer: string; note: string | null };

const flat = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function Aliases({ rows }: { rows: Row[] }) {
  const [alias, setAlias] = useState('');
  const [employer, setEmployer] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);
  const [pending, start] = useTransition();

  function add() {
    setMsg('');
    // Khong con can chuan hoa o day: saveAlias() dung nameKey() phia server,
    // giu nguyen dau cau, tu bo dau tieng Viet va ha chu thuong. Go sao thi
    // luu vay, khong ep chi con chu-so-khoang trang nua.
    const clean = alias.trim();
    if (!clean) { setMsg('Enter a brand name.'); return; }
    start(async () => {
      const res = await saveAlias(clean, employer, note);
      if (res?.error) { setMsg(res.error); return; }
      setAlias(''); setEmployer(''); setNote('');
    });
  }

  /**
   * 800 dong la khong ai cuon noi. Nhung 268/365 cong ty chi co dung mot nhan,
   * gom nhom cho chung thi bam ra chi thay mot dong - vo nghia.
   * Nen tach hai: cong ty nhieu nhan thi gom va thu gon, con nhan le don het
   * vao mot khoi Others.
   */
  const { groups, singles, hits } = useMemo(() => {
    const term = flat(q.trim());
    const matched = term
      ? rows.filter((r) =>
          flat(r.alias).includes(term) ||
          flat(r.employer).includes(term) ||
          flat(r.note ?? '').includes(term))
      : rows;

    const by = new Map<string, Row[]>();
    for (const r of matched) {
      const arr = by.get(r.employer) ?? [];
      arr.push(r);
      by.set(r.employer, arr);
    }
    const g: { employer: string; items: Row[] }[] = [];
    const s: Row[] = [];
    for (const [employer, items] of by) {
      if (items.length > 1) g.push({ employer, items });
      else s.push(items[0]);
    }
    g.sort((a, b) => b.items.length - a.items.length || a.employer.localeCompare(b.employer));
    s.sort((a, b) => a.alias.localeCompare(b.alias));
    return { groups: g, singles: s, hits: matched.length };
  }, [rows, q]);

  const searching = q.trim().length > 0;
  const shownGroups = searching || showAll ? groups : groups.slice(0, 25);

  const del = (a: string) => start(async () => { await deleteAlias(a); });

  const line = (r: Row) => (
    <div key={r.alias}
      className="group flex items-center gap-3 border-t border-line py-1.5 text-sm first:border-t-0">
      <span className="w-40 shrink-0 font-medium">{r.alias}</span>
      <span className="text-ink-faint">→</span>
      <span className="flex-1">{r.employer}</span>
      {r.note && <span className="hidden text-[11px] text-ink-faint lg:inline">{r.note}</span>}
      <button onClick={() => del(r.alias)}
        className="text-[11px] text-ink-faint opacity-0 transition group-hover:opacity-100 hover:text-red-deep">
        Delete
      </button>
    </div>
  );

  return (
    <section>
      <h2 className="font-display text-base uppercase text-teal-deep">Brand → company</h2>
      <p className="mt-1 text-xs leading-relaxed text-ink-faint">
        For brands whose name is not what people put on LinkedIn. Two cases: a group
        SKU (Chin-su → Masan Consumer), and a foreign brand with a Vietnamese distributor
        (Arganmidas → Lam Cosmetic). n8n uses new rows on the very next scan.
      </p>

      <div className="mt-3 rounded-xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input value={alias} onChange={(e) => setAlias(e.target.value)}
            placeholder="Brand name" autoComplete="off"
            className="h-9 w-40 rounded-lg border border-line bg-surface-sunk px-3 text-sm outline-none focus:border-teal-deep focus:bg-white" />
          <span className="text-ink-faint">→</span>
          <input value={employer} onChange={(e) => setEmployer(e.target.value)}
            placeholder="Company to search" autoComplete="off"
            className="h-9 w-52 rounded-lg border border-line bg-surface-sunk px-3 text-sm outline-none focus:border-teal-deep focus:bg-white" />
          <input value={note} onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Note (optional)" autoComplete="off"
            className="h-9 w-52 rounded-lg border border-line bg-surface-sunk px-3 text-sm outline-none focus:border-teal-deep focus:bg-white" />
          <button onClick={add} disabled={pending || !alias.trim() || !employer.trim()}
            className="h-9 rounded-lg bg-grad-teal px-4 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-40">
            {pending ? 'Saving' : 'Add'}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-ink-faint">
          Type the brand name as it normally appears. Accents and case are ignored
          automatically, so &ldquo;Chin-su&rdquo;, &ldquo;chin su&rdquo; and &ldquo;CHÍN SU&rdquo; all match
          the same alias — punctuation like the hyphen is kept, not stripped.
        </p>
        {msg && <p className="mt-2 text-[11.5px] text-red-deep">{msg}</p>}

        {/* Tim kiem moi la cach dung that: admin tra mot cai cu the chu khong
            doc ca bang 800 dong. */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search a brand or company" autoComplete="off"
            className="h-9 flex-1 min-w-[200px] rounded-lg border border-line bg-surface-sunk px-3 text-sm outline-none focus:border-teal-deep focus:bg-white" />
          <span className="text-[11px] text-ink-faint">
            {searching
              ? `${hits} of ${rows.length} rows`
              : `${rows.length} rows · ${groups.length + singles.length} companies`}
          </span>
          {searching && (
            <button onClick={() => setQ('')}
              className="text-[11px] font-semibold text-ink-dim hover:text-ink">Clear</button>
          )}
        </div>

        <div className="mt-2">
          {rows.length === 0 && (
            <p className="text-sm text-ink-faint">
              No rows yet. The built-in table in the workflow still applies; this adds to it.
            </p>
          )}

          {rows.length > 0 && hits === 0 && (
            <p className="py-3 text-sm text-ink-faint">Nothing matches that.</p>
          )}

          {/* Cong ty nhieu nhan: mot dong gap, bam moi xo */}
          {shownGroups.map((g) => {
            const isOpen = open[g.employer] ?? searching;
            return (
              <div key={g.employer} className="border-t border-line first:border-t-0">
                <button
                  onClick={() => setOpen({ ...open, [g.employer]: !isOpen })}
                  className="flex w-full items-center gap-2 py-2 text-left text-sm hover:text-teal-deep">
                  <span className={`text-[10px] text-ink-faint transition ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                  <span className="font-medium">{g.employer}</span>
                  <span className="rounded-full bg-teal-deep/10 px-2 py-0.5 text-[11px] font-semibold text-teal-deep">
                    {g.items.length}
                  </span>
                </button>
                {isOpen && (
                  <div className="mb-2 ml-5 border-l border-line pl-4">
                    {g.items.map(line)}
                  </div>
                )}
              </div>
            );
          })}

          {!searching && !showAll && groups.length > 25 && (
            <button onClick={() => setShowAll(true)}
              className="mt-2 w-full rounded-lg border border-line py-2 text-xs font-semibold text-ink-dim hover:border-teal-deep hover:text-teal-deep">
              Show {groups.length - 25} more companies
            </button>
          )}

          {/* Nhan le: 268 cong ty chi co mot nhan, gom het vao day */}
          {singles.length > 0 && (
            <div className="border-t border-line">
              <button
                onClick={() => setOpen({ ...open, __singles: !(open.__singles ?? searching) })}
                className="flex w-full items-center gap-2 py-2 text-left text-sm hover:text-teal-deep">
                <span className={`text-[10px] text-ink-faint transition ${(open.__singles ?? searching) ? 'rotate-90' : ''}`}>▶</span>
                <span className="font-medium">One-off brands</span>
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-semibold text-ink-dim">
                  {singles.length}
                </span>
                <span className="text-[11px] text-ink-faint">companies with a single brand</span>
              </button>
              {(open.__singles ?? searching) && (
                <div className="mb-2 ml-5 border-l border-line pl-4">
                  {singles.map(line)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
