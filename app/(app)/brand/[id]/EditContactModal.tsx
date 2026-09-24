'use client';

import { useEffect, useState, useTransition } from 'react';
import { updateContact } from './actions';
import { CONTACT_SOURCES, SOURCE_LABEL } from '@/lib/contactOrigin';
import Modal from '../../Modal';

type ContactFields = {
  full_name: string; job_title: string; company: string; email: string; phone: string; linkedin_url: string;
};

export default function EditContactModal({
  brandId, contact, isAdmin, onClose,
}: {
  brandId: string;
  contact: { id: string; full_name: string; job_title: string | null; company: string | null; email: string | null; phone: string | null; linkedin_url: string | null; source?: string | null } | null;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const [f, setF] = useState<ContactFields>({ full_name: '', job_title: '', company: '', email: '', phone: '', linkedin_url: '' });
  const [source, setSource] = useState('manual');
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!contact) return;
    setF({
      full_name: contact.full_name ?? '',
      job_title: contact.job_title ?? '',
      company: contact.company ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      linkedin_url: contact.linkedin_url ?? '',
    });
    setSource(contact.source ?? 'manual');
    setErr('');
  }, [contact]);

  const set = (k: keyof ContactFields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });

  const hasName = f.full_name.trim().length > 0;
  const hasReach = f.email.trim().length > 0 || f.phone.trim().length > 0;
  const canSave = hasName && hasReach;

  function save() {
    if (!contact) return;
    if (!canSave) {
      setErr(!hasName ? 'Enter a name first.' : 'Add an email or a phone number.');
      return;
    }
    setErr('');
    start(async () => {
      const changedSource = isAdmin && source !== (contact.source ?? 'manual');
      const res = await updateContact(contact.id, brandId, changedSource ? { ...f, source } : f);
      if (res?.error) { setErr(res.error); return; }
      onClose();
    });
  }

  return (
    <Modal open={!!contact} onClose={onClose} width={480}>
      <div className="modal-h">
        <div>
          <div className="modal-t">Edit contact</div>
          <div className="modal-s">Update the details on file for {contact?.full_name ?? 'this person'}</div>
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

        {/* Admin-only: source dinh nghia ca Origin badge lan credit-usage
            trong UsagePanel.tsx, nen chi nguoi chiu trach nhiem so lieu do
            moi sua duoc - xem updateContact() trong actions.ts. */}
        {isAdmin && (
          <div className="fld">
            <div className="flabel">Origin (admin only)</div>
            <select className="finput" value={source} onChange={(e) => setSource(e.target.value)}>
              {CONTACT_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
            </select>
            <p style={{ fontSize: 10.5, color: 'var(--faint)', margin: '4px 0 0' }}>
              Feeds the credit-usage report under Admin. Change this only to correct a mistake.
            </p>
          </div>
        )}
      </div>

      <div className="modal-f">
        <span className="merr">{err}</span>
        <button className="btn2" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={save} disabled={pending || !canSave}>
          {pending ? 'Saving' : 'Save changes'}
        </button>
      </div>
    </Modal>
  );
}
