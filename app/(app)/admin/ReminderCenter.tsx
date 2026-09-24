'use client';

import { useEffect, useState, useTransition } from 'react';
import Modal from '../Modal';
import {
  listRules, saveRule, toggleRule, deleteRule, runNow, previewRule,
  type Rule,
} from './reminderActions';

// Khong lay tu reminderActions: file do la 'use server', chi export duoc ham
// async, hang so se den tay client duoi dang proxy chu khong phai mang.
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

const EMPTY: Partial<Rule> = {
  name: '', active: true, day_of_week: 5, time_of_day: '09:00',
  stale_days: 5, escalate_after_h: 48, target_stage: null,
  target_category_id: null, target_profile_id: null,
};

const ESCALATE = [
  { v: 0, label: 'Never' },
  { v: 24, label: '1 day after the reminder' },
  { v: 48, label: '2 days after the reminder' },
  { v: 72, label: '3 days after the reminder' },
  { v: 120, label: '5 days after the reminder' },
  { v: 168, label: '1 week after the reminder' },
  { v: 240, label: '10 days after the reminder' },
  { v: 336, label: '2 weeks after the reminder' },
];

// Moi buoc co nhip rieng: first_meeting im mot tuan la co van de, con
// internal_review hay bp_pitch von ngon ca tuan la binh thuong.
const STAGES = [
  { v: '', label: 'Any stage' },
  { v: 'first_meeting', label: 'First meeting' },
  { v: 'internal_review', label: 'Internal review' },
  { v: 'bp_pitch', label: 'BP pitch' },
  { v: 'negotiating', label: 'Negotiating' },
  { v: 'live', label: 'Live' },
];

const field =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none ' +
  'focus:border-teal-deep';
const label = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint';

export default function ReminderCenter() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [people, setPeople] = useState<{ id: string; full_name: string | null }[]>([]);
  const [edit, setEdit] = useState<Partial<Rule> | null>(null);
  const [preview, setPreview] = useState<{ brand: string; owner_name: string | null; days_since_update: number }[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [, start] = useTransition();

  async function load() {
    const r = await listRules();
    setRules(r.rules); setCats(r.cats); setPeople(r.people);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!edit) return;
    previewRule(edit.stale_days ?? 5, edit.target_category_id ?? null, edit.target_profile_id ?? null)
      .then(setPreview);
  }, [edit?.stale_days, edit?.target_category_id, edit?.target_profile_id, edit]);

  function save() {
    if (!edit) return;
    setErr('');
    start(async () => {
      const res = await saveRule(edit);
      if (res?.error) { setErr(res.error); return; }
      setEdit(null); load();
    });
  }

  const set = (k: keyof Rule, v: any) => setEdit((e) => ({ ...(e ?? {}), [k]: v }));

  return (
    <section>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h2 className="font-display text-base uppercase text-teal-deep">Reminder Center</h2>
          <p className="mt-1 text-xs text-ink-faint">
            Nudges land in the PIC&apos;s notification bell. Nothing is emailed.
          </p>
        </div>
        <button
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold hover:border-teal-deep hover:text-teal-deep"
          onClick={() => start(async () => {
            const r = await runNow();
            setMsg(r?.error ? r.error
              : `Sent ${r.made} reminder${r.made === 1 ? '' : 's'}`
                + (r.escalated ? ` and ${r.escalated} escalation${r.escalated === 1 ? '' : 's'}` : '')
                + '.');
            setTimeout(() => setMsg(''), 4000);
            load();
          })}>Run now</button>
        <button
          className="rounded-lg bg-teal-deep px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          onClick={() => { setEdit({ ...EMPTY }); setErr(''); }}>New rule</button>
      </div>

      {msg && <p className="mt-2 text-xs text-teal-deep">{msg}</p>}

      <div className="mt-3 overflow-hidden rounded-xl border border-line bg-white">
        {rules.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-ink-faint">
            No rules yet. Add one and PICs get nudged automatically.
          </p>
        )}

        {rules.map((r) => (
          <div key={r.id}
            className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 text-sm last:border-0">
            <div className="min-w-[200px] flex-1">
              <div className="font-semibold">{r.name}</div>
              <div className="mt-0.5 text-xs text-ink-faint">
                {r.day_of_week === null ? 'Every day' : DAYS[r.day_of_week]}
                {' at '}{r.time_of_day.slice(0, 5)}
                {' · no update for '}{r.stale_days}+ days
                {r.target_category_id && ` · ${cats.find((c) => c.id === r.target_category_id)?.name ?? 'one category'}`}
                {r.target_profile_id && ` · ${people.find((p) => p.id === r.target_profile_id)?.full_name ?? 'one person'}`}
                {r.target_stage && ` · ${STAGES.find((x) => x.v === r.target_stage)?.label ?? r.target_stage}`}
                {r.escalate_after_h
                  ? ` · escalates after ${Math.round(r.escalate_after_h / 24)}d`
                  : ' · no escalation'}
                {r.last_run_at && ` · last run ${r.last_run_at.slice(0, 10)}`}
              </div>
            </div>

            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
              r.active ? 'bg-teal-deep/10 text-teal-deep' : 'bg-black/5 text-ink-faint'}`}>
              {r.active ? 'On' : 'Off'}
            </span>

            <button className="text-xs font-semibold text-ink-dim hover:text-ink"
              onClick={() => start(async () => { await toggleRule(r.id, !r.active); load(); })}>
              {r.active ? 'Turn off' : 'Turn on'}
            </button>

            <button className="text-xs font-semibold text-ink-dim hover:text-teal-deep"
              onClick={() => { setEdit(r); setErr(''); }}>Edit</button>

            <button className="text-xs font-semibold text-ink-faint hover:text-red-deep"
              onClick={() => {
                if (!confirm(`Delete "${r.name}"?`)) return;
                start(async () => { await deleteRule(r.id); load(); });
              }}>Delete</button>
          </div>
        ))}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} width={470}>
        <div className="border-b border-line px-5 py-4">
          <h3 className="font-display text-base uppercase">{edit?.id ? 'Edit rule' : 'New rule'}</h3>
          <p className="mt-0.5 text-xs text-ink-faint">Who gets nudged, and when</p>
        </div>

        <div className="max-h-[62vh] overflow-y-auto px-5 py-4">
          <div className="mb-4">
            <span className={label}>Rule name</span>
            <input className={field} value={edit?.name ?? ''} autoFocus
              onChange={(e) => set('name', e.target.value)} placeholder="Friday status sweep" />
          </div>

          <div className="mb-4">
            <span className={label}>Runs on</span>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => set('day_of_week', null)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                  edit?.day_of_week === null
                    ? 'border-teal-deep bg-teal-deep text-white'
                    : 'border-line bg-white text-ink-dim hover:border-teal-deep'}`}>Every day</button>
              {DAYS.map((d, i) => (
                <button key={d} onClick={() => set('day_of_week', i)}
                  className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                    edit?.day_of_week === i
                      ? 'border-teal-deep bg-teal-deep text-white'
                      : 'border-line bg-white text-ink-dim hover:border-teal-deep'}`}>{d.slice(0, 3)}</button>
              ))}
            </div>
          </div>

          <div className="mb-4 flex gap-3">
            <div className="flex-1">
              <span className={label}>Time</span>
              <input className={field} type="time" value={(edit?.time_of_day ?? '09:00').slice(0, 5)}
                onChange={(e) => set('time_of_day', e.target.value)} />
            </div>
            <div className="flex-1">
              <span className={label}>No update for (days)</span>
              <input className={field} type="number" min={1} max={90} value={edit?.stale_days ?? 5}
                onChange={(e) => set('stale_days', Number(e.target.value))} />
            </div>
          </div>

          <div className="mb-4">
            <span className={label}>Only cases at this stage</span>
            <select className={field} value={edit?.target_stage ?? ''}
              onChange={(e) => set('target_stage', e.target.value || null)}>
              {STAGES.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
              Make one rule per stage when the pace differs. Internal review and BP
              pitch normally take a week on their own, so a rule that fits First
              meeting will nag the wrong people there.
            </p>
          </div>

          <div className="mb-4">
            <span className={label}>Tell an admin if still not updated</span>
            <select className={field} value={edit?.escalate_after_h ?? 48}
              onChange={(e) => set('escalate_after_h', Number(e.target.value))}>
              {ESCALATE.map((o) => (
                <option key={o.v} value={o.v}>{o.label}</option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
              Counted on top of the days above, and only if the case really has had
              no update since the reminder went out. Opening the notification is not
              enough.
            </p>
          </div>

          <div className="mb-4">
            <span className={label}>Only this category</span>
            <select className={field} value={edit?.target_category_id ?? ''}
              onChange={(e) => set('target_category_id', e.target.value || null)}>
              <option value="">All categories</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="mb-4">
            <span className={label}>Only this person</span>
            <select className={field} value={edit?.target_profile_id ?? ''}
              onChange={(e) => set('target_profile_id', e.target.value || null)}>
              <option value="">Everyone</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.full_name || '(no name)'}</option>)}
            </select>
          </div>

          <div className="rounded-lg border border-line bg-black/[.02] px-3 py-3">
            <span className={label}>
              Right now this would nudge {preview.length} case{preview.length === 1 ? '' : 's'}
            </span>
            {preview.length === 0 ? (
              <p className="text-xs text-ink-faint">
                Nothing is that stale yet. The rule still runs on schedule.
              </p>
            ) : (
              <ul className="space-y-0.5 text-xs text-ink-dim">
                {preview.slice(0, 6).map((p) => (
                  <li key={p.brand}>
                    {p.brand} · {p.owner_name ?? 'no owner'} · {p.days_since_update}d
                  </li>
                ))}
                {preview.length > 6 && <li>and {preview.length - 6} more</li>}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-line px-5 py-3.5">
          <span className="flex-1 text-xs text-red-deep">{err}</span>
          <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold"
            onClick={() => setEdit(null)}>Cancel</button>
          <button disabled={!edit?.name?.trim()}
            className="rounded-lg bg-teal-deep px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            onClick={save}>Save rule</button>
        </div>
      </Modal>
    </section>
  );
}
