'use client';

import { useState, useTransition } from 'react';
import { addCategory } from './actions';

export default function AddCategory() {
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();

  function add() {
    if (!name.trim()) return;
    setMsg('');
    start(async () => {
      const res = await addCategory(name);
      if (res?.error) setMsg(res.error);
      else setName('');
    });
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="New category name"
          className="h-9 w-56 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-teal-deep"
        />
        <button
          onClick={add} disabled={pending || !name.trim()}
          className="h-9 rounded-lg border border-line px-3.5 text-xs font-semibold uppercase tracking-wide text-ink-dim transition hover:bg-white disabled:opacity-40"
        >
          {pending ? 'Adding' : 'Add'}
        </button>
      </div>
      {msg && <p className="mt-2 text-[11.5px] text-red-deep">{msg}</p>}
    </div>
  );
}
