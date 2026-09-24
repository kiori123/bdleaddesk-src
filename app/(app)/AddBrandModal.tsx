'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createBrand } from './actions';
import Modal from './Modal';

export default function AddBrandModal({
  open, cats, onClose,
}: { open: boolean; cats: { id: string; name: string }[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => { if (open) { setName(''); setCat(null); setErr(''); } }, [open]);

  function save(goTo: boolean) {
    if (!name.trim()) { setErr('Enter a brand name first.'); return; }
    setErr('');
    start(async () => {
      const res = await createBrand(name, cat);
      if (res?.error) { setErr(res.error); return; }
      onClose();
      if (goTo && res?.id) router.push(`/brand/${res.id}`);
    });
  }

  return (
    <Modal open={open} onClose={onClose} width={420}>
      <div className="modal-h">
        <div>
          <div className="modal-t">Add brand</div>
          <div className="modal-s">For a brand the scan has not picked up yet</div>
        </div>
        <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="modal-b" style={{ overflowY: 'auto' }}>
        <div className="fld">
          <div className="flabel">Brand name *</div>
          <input className="finput" value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && save(false)}
            placeholder="Chin-su" autoComplete="off" autoFocus />
        </div>

        <div className="fld">
          <div className="flabel">Category</div>
          <div className="catw">
            {cats.map((c) => (
              <button key={c.id} className={`catc${cat === c.id ? ' on' : ''}`}
                onClick={() => setCat(cat === c.id ? null : c.id)}>{c.name}</button>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 10.5, color: 'var(--faint)', margin: '10px 0 0', lineHeight: 1.5 }}>
          Without a category the brand is visible to admins only, and it draws
          on no credit budget.
        </p>
      </div>

      <div className="modal-f">
        <span className="merr">{err}</span>
        <button className="btn2" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={() => save(true)} disabled={pending || !name.trim()}>
          {pending ? 'Saving' : 'Add brand'}
        </button>
      </div>
    </Modal>
  );
}
