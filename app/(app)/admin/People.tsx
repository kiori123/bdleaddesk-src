'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  listPeople, toggleCategory, setName, setRole, setActive, type Person,
} from './peopleActions';

export default function People() {
  const [people, setPeople] = useState<Person[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [, start] = useTransition();

  async function load() {
    const r = await listPeople();
    setPeople(r.people); setCats(r.cats);
  }
  useEffect(() => { load(); }, []);

  function flash(res: any) {
    if (res?.error) { setErr(res.error); setTimeout(() => setErr(''), 5000); return false; }
    if (res?.warn) { setMsg(res.warn); setTimeout(() => setMsg(''), 6000); }
    return true;
  }

  return (
    <section>
      <h2 className="font-display text-base uppercase text-teal-deep">People</h2>
      <p className="mt-1 text-xs leading-relaxed text-ink-faint">
        Categories decide what a person can see. Someone with none sees an empty
        board, so assign at least one when an account is created.
      </p>

      {err && <p className="mt-2 text-xs text-red-deep">{err}</p>}
      {msg && <p className="mt-2 text-xs text-ink-dim">{msg}</p>}

      <div className="mt-3 overflow-hidden rounded-xl border border-line bg-white">
        {people.map((p) => {
          const noCat = p.category_ids.length === 0 && p.role !== 'admin';
          return (
            <div key={p.id} className="border-b border-line px-4 py-3 last:border-0">
              <div className="flex flex-wrap items-center gap-3">
                {editing === p.id ? (
                  <input
                    className="w-40 rounded-lg border border-line px-2 py-1 text-sm outline-none focus:border-teal-deep"
                    value={draft} autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setEditing(null);
                      if (e.key === 'Enter') start(async () => {
                        if (flash(await setName(p.id, draft))) { setEditing(null); load(); }
                      });
                    }}
                    onBlur={() => setEditing(null)}
                  />
                ) : (
                  <button
                    className={`text-sm font-semibold ${p.full_name ? '' : 'text-ink-faint italic'}`}
                    title="Click to rename"
                    onClick={() => { setEditing(p.id); setDraft(p.full_name ?? ''); }}>
                    {p.full_name || 'no name yet'}
                  </button>
                )}

                <span className="text-xs text-ink-faint">{p.email}</span>

                {p.brands_owned > 0 && (
                  <span className="rounded-full bg-teal-deep/10 px-2 py-0.5 text-[11px] font-semibold text-teal-deep">
                    owns {p.brands_owned}
                  </span>
                )}

                {noCat && (
                  <span className="rounded-full bg-red-deep/10 px-2 py-0.5 text-[11px] font-semibold text-red-deep">
                    sees nothing
                  </span>
                )}

                <div className="ml-auto flex items-center gap-2">
                  <select
                    className="rounded-lg border border-line bg-white px-2 py-1 text-xs outline-none focus:border-teal-deep"
                    value={p.role}
                    onChange={(e) => start(async () => {
                      if (flash(await setRole(p.id, e.target.value as 'admin' | 'pic'))) load();
                      else load();
                    })}>
                    <option value="pic">PIC</option>
                    <option value="admin">Admin</option>
                  </select>

                  <button
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                      p.active
                        ? 'border-line text-ink-dim hover:border-red-deep hover:text-red-deep'
                        : 'border-red-deep/40 bg-red-deep/5 text-red-deep'}`}
                    onClick={() => start(async () => {
                      if (flash(await setActive(p.id, !p.active))) load();
                    })}>
                    {p.active ? 'Active' : 'Disabled'}
                  </button>
                </div>
              </div>

              {/* Admin thay het theo RLS, khong phu thuoc bang nay */}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {p.role === 'admin' ? (
                  <span className="text-[11px] text-ink-faint">
                    Admin sees every category regardless of what is ticked here.
                  </span>
                ) : (
                  cats.map((c) => {
                    const on = p.category_ids.includes(c.id);
                    return (
                      <button key={c.id}
                        onClick={() => start(async () => {
                          if (flash(await toggleCategory(p.id, c.id, !on))) load();
                        })}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                          on
                            ? 'border-teal-deep bg-teal-deep text-white'
                            : 'border-line bg-white text-ink-dim hover:border-teal-deep'}`}>
                        {c.name}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
