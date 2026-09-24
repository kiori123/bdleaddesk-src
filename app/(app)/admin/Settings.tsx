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
      setMsg('Saved. n8n picks up the new key on the next scan.');
      setTimeout(() => setMsg(''), 4000);
    });
  }

  return (
    <section>
      <h2 className="font-display text-base uppercase text-teal-deep">SignalHire API key</h2>
      <p className="mt-1 text-xs text-ink-faint">
        n8n asks the app for this key on every scan. Change it here, not in n8n.
      </p>

      <div className="mt-3 rounded-xl border border-line bg-white p-4">
        <div className="text-xs text-ink-dim">
          {ok
            ? `Key is set${updatedAt ? ` · updated ${updatedAt.slice(0, 10)}` : ''}`
            : 'No key yet. n8n falls back to the one stored in its own data table.'}
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
          A saved key cannot be read back, only overwritten. If the app is unreachable,
          n8n falls back to the key in its own data table, so one app outage does not
          stop scanning.
        </p>
      </div>
    </section>
  );
}
