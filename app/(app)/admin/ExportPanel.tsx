'use client';

import { useEffect, useState } from 'react';
import { listRules } from './reminderActions';

const STATUS = [
  ['', 'Any status'],
  ['stuck', 'Stuck only'],
  ['in_progress', 'In progress'],
  ['waiting_brand', 'Waiting for brand'],
  ['won', 'Won'],
  ['lost', 'Lost'],
];

const field =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-teal-deep';
const label = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint';

export default function ExportPanel() {
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [people, setPeople] = useState<{ id: string; full_name: string | null }[]>([]);
  const [cat, setCat] = useState('');
  const [owner, setOwner] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Dung lai listRules: no da tra ve san danh sach category va nguoi.
  useEffect(() => {
    listRules().then((r) => { setCats(r.cats); setPeople(r.people); });
  }, []);

  const qs = new URLSearchParams();
  if (cat) qs.set('category', cat);
  if (owner) qs.set('owner', owner);
  if (status) qs.set('status', status);
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  const href = `/api/export${qs.toString() ? `?${qs}` : ''}`;
  const dirty = !!(cat || owner || status || from || to);

  return (
    <section>
      <h2 className="font-display text-base uppercase text-teal-deep">Reports &amp; Export</h2>
      <p className="mt-1 text-xs text-ink-faint">
        Excel with five sheets: Summary, Pipeline, Stuck cases, Case history,
        Credit &amp; Contacts.
      </p>

      <div className="mt-3 rounded-xl border border-line bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <span className={label}>Category</span>
            <select className={field} value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">All categories</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <span className={label}>Owner</span>
            <select className={field} value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Everyone</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name || '(no name)'}</option>
              ))}
            </select>
          </div>

          <div>
            <span className={label}>Status</span>
            <select className={field} value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div>
            <span className={label}>Updated from</span>
            <input className={field} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div>
            <span className={label}>Updated to</span>
            <input className={field} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <a href={href}
            className="rounded-lg bg-red-deep px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white no-underline hover:opacity-90">
            Download Excel
          </a>

          {dirty && (
            <button className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink-dim hover:text-ink"
              onClick={() => { setCat(''); setOwner(''); setStatus(''); setFrom(''); setTo(''); }}>
              Clear filters
            </button>
          )}

          <p className="flex-1 text-right text-[11px] leading-relaxed text-ink-faint">
            Read <b className="font-semibold text-ink-dim">Summary</b> first: one verdict per
            category, worst first. Filters apply to Pipeline and Stuck cases.
          </p>
        </div>
      </div>
    </section>
  );
}
