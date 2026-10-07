'use client';

import { useState, useTransition } from 'react';
import { setSignalhireKey } from './actions';

export default function Settings({ hasKey, updatedAt }: { hasKey: boolean; updatedAt: string | null }) {
  const [value, setValue] = useState('');
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(hasKey);
  const [pending, start] = useTransition();

  function save() {
    if (!value.trim()) { setMsg('Enter a key first.'); return; }
    setMsg('');
    start(async () => {
      const res = await setSignalhireKey(value);
      if (res?.error) { setMsg(res.error); return; }
      setValue(''); setOk(true);
      const balance = res.unlimited ? 'unlimited credits' : `${res.credits} credit${res.credits === 1 ? '' : 's'}`;
      setMsg(`Saved and confirmed with SignalHire — ${balance} available. The app uses this key on the next scan or reveal.`);
      setTimeout(() => setMsg(''), 6000);
    });
  }

  return (
    <section>
      <h2 className="font-display text-base uppercase text-teal-deep">SignalHire API key</h2>
      <p className="mt-1 text-xs text-ink-faint">
        The app calls SignalHire directly with this key (search, reveal, credit balance). n8n is not involved.
      </p>

      <div className="mt-3 rounded-xl border border-line bg-white p-4">
        <div className="text-xs text-ink-dim">
          {ok
            ? `Key is set${updatedAt ? ` · updated ${updatedAt.slice(0, 10)}` : ''}`
            : 'No key yet. Scan, reveal, and the credit balance above will not work until one is saved.'}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="password" value={value} onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder={ok ? 'Paste a new key to replace it' : 'Paste the SignalHire API key'}
            autoComplete="off" spellCheck={false}
            className="h-9 min-w-[260px] flex-1 rounded-lg border border-line bg-surface-sunk px-3 font-mono text-xs outline-none focus:border-teal-deep focus:bg-white"
          />
          <button
            onClick={save} disabled={pending || !value.trim()}
            className="h-9 rounded-lg bg-grad-teal px-4 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-40"
          >
            {pending ? 'Saving' : 'Save key'}
          </button>
        </div>

        {msg && <p className="mt-2 text-[11.5px] text-ink-dim">{msg}</p>}

        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
          A saved key cannot be read back, only overwritten. There is no fallback key
          anywhere else &mdash; this is the only copy the app uses.
        </p>
      </div>
    </section>
  );
}
