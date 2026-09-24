'use client';

import { useEffect, useState, useTransition } from 'react';
import Modal from '../../Modal';
import { getCase, listPeople, updateCase, setOwner } from '../../caseActions';
import {
  CASE_STATUS, STATUS_LABEL, STUCK_REASON, REASON_LABEL,
  type CaseState, type CaseStatus, type StuckReason,
} from '../../caseLabels';

/** "3 days ago" doc nhanh hon mot cai dau thoi gian ISO. */
function ago(iso: string | null) {
  if (!iso) return 'never';
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3.6e6);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** Mau canh bao theo do cu, de admin liec mot cai la thay case bi bo quen. */
function staleColor(days: number) {
  if (days >= 7) return 'var(--acc)';
  if (days >= 3) return '#B9791F';
  return 'var(--faint)';
}

export default function CasePanel({ brandId }: { brandId: string }) {
  const [c, setC] = useState<CaseState | null>(null);
  const [people, setPeople] = useState<{ id: string; full_name: string | null; role: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const [, start] = useTransition();

  const [status, setStatus] = useState<CaseStatus>('in_progress');
  const [reason, setReason] = useState<StuckReason | null>(null);
  const [note, setNote] = useState('');
  const [action, setAction] = useState('');
  const [due, setDue] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const r = await getCase(brandId);
    if (r.case) {
      setC(r.case);
      setStatus(r.case.status);
      setReason(r.case.stuck_reason);
      setAction(r.case.next_action ?? '');
      setDue(r.case.next_follow_up ?? '');
    }
  }

  useEffect(() => { load(); listPeople().then(setPeople); }, [brandId]);

  function save() {
    setErr(''); setSaving(true);
    start(async () => {
      const res = await updateCase(brandId, {
        status, stuck_reason: reason, note, next_action: action, next_follow_up: due,
      });
      setSaving(false);
      if (res?.error) { setErr(res.error); return; }
      setNote(''); setOpen(false); load();
    });
  }

  function owner(id: string | null) {
    start(async () => { await setOwner(brandId, id); load(); });
  }

  if (!c) return null;

  const stale = c.days_since_update;

  return (
    <div className="tile" style={{ gridColumn: '1 / -1', marginBottom: 12 }}>
      <div className="chead" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div className="ct">Case status</div>
          <div className="cs">What management sees for this brand</div>
        </div>
        <button className="btn" onClick={() => setOpen(true)}>Update</button>
      </div>

      <div className="cbody" style={{ paddingTop: 12, display: 'flex', flexWrap: 'wrap', gap: 22 }}>
        <div>
          <div className="k">Status</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 3 }}>
            {STATUS_LABEL[c.status]}
            {c.status === 'stuck' && c.stuck_reason && (
              <span style={{ color: 'var(--acc)', fontWeight: 500 }}>
                {' · '}{REASON_LABEL[c.stuck_reason]}
              </span>
            )}
          </div>
        </div>

        <div>
          <div className="k">Last updated</div>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 3, color: staleColor(stale) }}>
            {ago(c.last_update_at)}
            {stale >= 7 && ' \u25CF'}
          </div>
        </div>

        <div>
          <div className="k">Owner</div>
          <select className="sel" style={{ marginTop: 3 }}
            value={c.owner_id ?? ''}
            onChange={(e) => owner(e.target.value || null)}>
            <option value="">Nobody yet</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name || p.role}</option>
            ))}
          </select>
        </div>

        {c.next_action && (
          <div style={{ minWidth: 180 }}>
            <div className="k">Next action</div>
            <div style={{ fontSize: 12.5, marginTop: 3 }}>
              {c.next_action}
              {c.next_follow_up && (
                <span style={{
                  color: new Date(c.next_follow_up) < new Date() ? 'var(--acc)' : 'var(--faint)',
                }}>{' · due '}{c.next_follow_up}</span>
              )}
            </div>
          </div>
        )}

        {c.last_note && (
          <div style={{ flex: '1 1 240px', minWidth: 0 }}>
            <div className="k">Latest note</div>
            <div style={{ fontSize: 12.5, marginTop: 3, color: 'var(--dim)' }}>{c.last_note}</div>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} width={480}>
        <div className="modal-h">
          <div>
            <div className="modal-t">Update case</div>
            <div className="modal-s">Goes straight into the pipeline report</div>
          </div>
          <button className="modal-x" onClick={() => setOpen(false)} aria-label="Close">×</button>
        </div>

        <div className="modal-b" style={{ overflowY: 'auto' }}>
          <div className="fld">
            <div className="flabel">Status *</div>
            <div className="catw">
              {CASE_STATUS.map((s) => (
                <button key={s} className={`catc${status === s ? ' on' : ''}`}
                  onClick={() => { setStatus(s); if (s !== 'stuck') setReason(null); }}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {status === 'stuck' && (
            <div className="fld">
              <div className="flabel">Why is it stuck? *</div>
              <div className="catw">
                {STUCK_REASON.map((r) => (
                  <button key={r} className={`catc${reason === r ? ' on' : ''}`}
                    onClick={() => setReason(r)}>{REASON_LABEL[r]}</button>
                ))}
              </div>
            </div>
          )}

          <div className="fld">
            <div className="flabel">What happened *</div>
            <textarea className="finput" style={{ height: 62, padding: '8px 11px', resize: 'vertical' }}
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Sent the BP, waiting on their marketing lead." />
          </div>

          <div className="fld">
            <div className="flabel">Next action</div>
            <input className="finput" value={action} onChange={(e) => setAction(e.target.value)}
              placeholder="Follow up by phone" autoComplete="off" />
          </div>

          <div className="fld">
            <div className="flabel">Next follow-up</div>
            <input className="finput" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>

        <div className="modal-f">
          <span className="merr">{err}</span>
          <button className="btn2" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn" onClick={save}
            disabled={saving || !note.trim() || (status === 'stuck' && !reason)}>
            {saving ? 'Saving' : 'Save update'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
