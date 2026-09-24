'use client';

import { useState, useTransition } from 'react';
import { setBudget } from './actions';

type Props = {
  categoryId: string;
  name: string;
  granted: number;
  used: number;
  remaining: number;
};

export default function BudgetCard({ categoryId, name, granted, used, remaining }: Props) {
  const [value, setValue] = useState(String(granted));
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();

  const pct = granted > 0 ? Math.min(100, (used / granted) * 100) : 0;
  const dirty = value !== String(granted);

  function save() {
    setMsg('');
    start(async () => {
      const res = await setBudget(categoryId, Number(value));
      if (res?.error) { setMsg(res.error); setValue(String(granted)); }
    });
  }

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">{name}</span>
        <span className="text-xs text-ink-faint">{used} used</span>
      </div>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunk">
        <div className="h-full bg-grad-teal transition-all" style={{ width: `${pct}%` }} />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="number" min={0} value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && dirty && save()}
          className="h-9 w-24 rounded-lg border border-line bg-surface-sunk px-2.5 text-sm outline-none focus:border-teal-deep focus:bg-white"
        />
        <button
          onClick={save} disabled={!dirty || pending}
          className="h-9 rounded-lg bg-grad-teal px-3.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-40"
        >
          {pending ? 'Saving' : 'Save'}
        </button>
        <span className="text-xs text-ink-dim">
          {granted === 0 ? 'no budget yet' : `${remaining} left`}
        </span>
      </div>

      {msg && <p className="mt-2 text-[11.5px] leading-snug text-red-deep">{msg}</p>}
    </div>
  );
}
