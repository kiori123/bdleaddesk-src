'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ALL_COLUMNS, COLUMN_LABEL, contactsToTsv, loadColumnOrder, saveColumnOrder,
  type ColKey, type ContactRow,
} from '@/lib/contactColumns';

export default function CopyContactsButton({ rows }: { rows: ContactRow[] }) {
  const [order, setOrder] = useState<ColKey[]>(ALL_COLUMNS);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { setOrder(loadColumnOrder()); }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  function update(next: ColKey[]) { setOrder(next); saveColumnOrder(next); }

  function toggle(k: ColKey) {
    update(order.includes(k) ? order.filter((x) => x !== k) : [...order, k]);
  }

  function move(k: ColKey, dir: -1 | 1) {
    const i = order.indexOf(k);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  }

  async function copy() {
    await navigator.clipboard.writeText(contactsToTsv(order, rows));
    setCopied(true);
    setTimeout(() => setCopied(false), 1300);
  }

  const disabled = rows.length === 0 || order.length === 0;

  return (
    <div ref={box} style={{ position: 'relative', display: 'flex', gap: 6 }}>
      <button className="mini" onClick={() => setOpen((v) => !v)}>Columns</button>
      <button className={`mini${copied ? ' ok' : ''}${disabled ? ' off' : ''}`} disabled={disabled} onClick={copy}>
        {copied ? 'Copied' : 'Copy contacts'}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6,
          width: 220, zIndex: 30, background: '#fff', border: '1px solid var(--bd)',
          borderRadius: 10, boxShadow: '0 10px 34px rgba(14,34,40,.18)', padding: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', marginBottom: 8 }}>
            Columns, in paste order
          </div>
          {ALL_COLUMNS.map((k) => {
            const idx = order.indexOf(k);
            const on = idx !== -1;
            return (
              <div key={k} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 12.5,
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, cursor: 'pointer' }}>
                  <input type="checkbox" checked={on} onChange={() => toggle(k)} />
                  {COLUMN_LABEL[k]}
                </label>
                {on && (
                  <>
                    <button className="mini" style={{ height: 20, padding: '0 6px' }}
                      onClick={() => move(k, -1)} disabled={idx === 0}>↑</button>
                    <button className="mini" style={{ height: 20, padding: '0 6px' }}
                      onClick={() => move(k, 1)} disabled={idx === order.length - 1}>↓</button>
                  </>
                )}
              </div>
            );
          })}
          <button className="mini" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
            onClick={() => setOpen(false)}>Done</button>
        </div>
      )}
    </div>
  );
}
