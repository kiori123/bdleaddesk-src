'use client';

import { useEffect, useState, useTransition } from 'react';
import { addContact } from './actions';
import Modal from './Modal';

const EMPTY = { full_name: '', job_title: '', company: '', email: '', phone: '', linkedin_url: '' };

export default function AddContactModal({
  brand, onClose,
}: { brand: { id: string; name: string } | null; onClose: () => void }) {
  const [f, setF] = useState(EMPTY);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();

  useEffect(() => { if (brand) { setF(EMPTY); setErr(''); } }, [brand]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });

  // Cung dieu kien ma server action kiem tra, chi khac la bao ngay tai cho thay
  // vi de nguoi dung bam Save roi moi bao loi.
  const hasName = f.full_name.trim().length > 0;
  const hasReach = f.email.trim().length > 0 || f.phone.trim().length > 0;
  const canSave = hasName && hasReach;

  function save() {
    if (!brand) return;
    if (!canSave) {
      setErr(!hasName ? 'Enter a name first.' : 'Add an email or a phone number.');
      return;
    }
    setErr('');
    start(async () => {
      const res = await addContact(brand.id, f);
      if (res?.error) { setErr(res.error); return; }
      onClose();
    });
  }

  return (
    <Modal open={!!brand} onClose={onClose} width={480}>
      <div className="modal-h">
        <div>
          <div className="modal-t">Add contact</div>
          <div className="modal-s">Manually add a lead to {brand?.name ?? 'this brand'}</div>
        </div>
        <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="modal-b" style={{ overflowY: 'auto' }}>
        <div className="fld">
          <div className="flabel">Full name *</div>
          <input className="finput" value={f.full_name} onChange={set('full_name')}
            placeholder="Nguyen Van A" autoComplete="off" autoFocus />
        </div>
        <div className="fld">
          <div className="flabel">Job title</div>
          <input className="finput" value={f.job_title} onChange={set('job_title')}
            placeholder="Marketing Director" autoComplete="off" />
        </div>
        <div className="fld">
          <div className="flabel">Company (as written on their LinkedIn)</div>
          <input className="finput" value={f.company} onChange={set('company')}
            placeholder="Often the same as the brand, sometimes the parent company" autoComplete="off" />
        </div>
        <div className="fld">
          <div className="flabel">Email</div>
          <input className="finput" type="email" value={f.email} onChange={set('email')}
            placeholder="name@brand.com" autoComplete="off" />
        </div>
        <div className="fld">
          <div className="flabel">Phone</div>
          <input className="finput" type="tel" value={f.phone} onChange={set('phone')}
            placeholder="0901 234 567" autoComplete="off" />
        </div>
        <p style={{ fontSize: 10.5, color: 'var(--faint)', margin: '0 0 12px' }}>
          * Name required. At least email or phone required.
        </p>
        <div className="fld">
          <div className="flabel">LinkedIn URL</div>
          <input className="finput" type="url" value={f.linkedin_url} onChange={set('linkedin_url')}
            placeholder="https://linkedin.com/in/..." autoComplete="off" />
        </div>
      </div>

      <div className="modal-f">
        <span className="merr">{err}</span>
        <button className="btn2" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={save} disabled={pending || !canSave}>
          {pending ? 'Saving' : 'Add contact'}
        </button>
      </div>
    </Modal>
  );
}
