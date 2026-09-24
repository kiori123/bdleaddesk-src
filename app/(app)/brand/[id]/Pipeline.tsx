'use client';

import { useState, useTransition } from 'react';
import { setStage, addNote, setCategory, type Stage } from './actions';
import { deleteBrand } from '../../actions';
import { useRouter } from 'next/navigation';
import Docs from './Docs';

const STEPS: { key: Stage; label: string }[] = [
  { key: 'first_meeting',   label: 'First meeting' },
  { key: 'internal_review', label: 'Internal review' },
  { key: 'bp_pitch',        label: 'BP pitch' },
  { key: 'negotiating',     label: 'Negotiating' },
  { key: 'live',            label: 'Live' },
];

type Props = {
  brandId: string;
  brandName: string;
  categories: { id: string; name: string }[];
  categoryId: string | null;
  folderLink: string | null;
  stage: Stage | null;
  note: string;
  noteAt: string | null;
};

export default function Pipeline({
  brandId, brandName, folderLink, stage, categories, categoryId, note, noteAt,
}: Props) {
  const [cur, setCur] = useState<Stage | null>(stage);
  const [text, setText] = useState(note);
  const [saved, setSaved] = useState(note);
  const [stamp, setStamp] = useState(noteAt);
  const [noteMsg, setNoteMsg] = useState('');
  const [cat, setCat] = useState<string | null>(categoryId);
  const [catMsg, setCatMsg] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();

  const idx = cur ? STEPS.findIndex((s) => s.key === cur) : -1;

  function pick(key: Stage) {
    start(async () => {
      const res = await setStage(brandId, key);
      if (!res?.error) setCur(res.stage ?? null);
    });
  }


  function chooseCat(id: string) {
    const next = cat === id ? null : id;
    setCatMsg('Saving');
    start(async () => {
      const res = await setCategory(brandId, next);
      if (res?.error) { setCatMsg(res.error); return; }
      setCat(next);
      const name = categories.find((c) => c.id === next)?.name;
      setCatMsg(name ? `Now under ${name}.` : 'Category cleared.');
      setTimeout(() => setCatMsg(''), 2500);
    });
  }

  function save() {
    if (text === saved) { setNoteMsg('No changes to save.'); return; }
    setNoteMsg('Saving');
    start(async () => {
      const res = await addNote(brandId, text);
      if (res?.error) { setNoteMsg(res.error); return; }
      setSaved(text);
      setStamp(new Date().toISOString());
      setNoteMsg('');
    });
  }

  const idle = saved
    ? `Last saved ${(stamp ?? '').slice(0, 10)} · Everyone with access can read this.`
    : 'Nothing saved yet.';

  return (
    <div className="tile" style={{ gridColumn: '1/-1' }}>
      <div className="chead">
        <div className="ct">Pipeline</div>
        <div className="cs">Stage, category and shared notes for this brand</div>
      </div>

      <div className="cbody" style={{ paddingTop: 6 }}>
        <div className="stgw">
          {STEPS.map((s, i) => (
            <button key={s.key} disabled={pending} onClick={() => pick(s.key)}
              className={`stg${cur === s.key ? ' now' : idx >= 0 && i < idx ? ' done' : ''}`}>
              <span className="stgb" />
              <span className="stgl">{s.label}</span>
            </button>
          ))}
        </div>
        <div className="stgn">
          {cur
            ? `At ${STEPS[idx]?.label}. Click another stage to move, or click again to stop tracking.`
            : 'Not tracked yet. Click a stage to start.'}
        </div>

        <div className="catsec">
          <div className="catlab">Category</div>
          <div className="catw">
            {categories.map((c) => (
              <button key={c.id} disabled={pending}
                className={`catc${cat === c.id ? ' on' : ''}`}
                onClick={() => chooseCat(c.id)}>{c.name}</button>
            ))}
          </div>
          <div className="catmsg">
            {catMsg || (cat
              ? 'Only people who cover this category can see the brand.'
              : 'Unclassified. Everyone can see it until a category is picked.')}
          </div>
        </div>

        <Docs brandId={brandId} folderLink={folderLink} />

        <div className="nsec">
          <div className="nlab">Notes</div>
          <textarea className="nta" rows={3} maxLength={2000} value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What the team should know before the next touchpoint" />
          <div className="nrow">
            <button className="btn2" onClick={save} disabled={pending}>Save note</button>
            <span className="nmsg">{noteMsg || idle}</span>
          </div>
        </div>

        <div className="danger">
          <span className="dangert">
            Deleting removes every contact, note and document for this brand.
            Credit already spent stays on the record.
          </span>
          <button className="delbrand" disabled={pending}
            onClick={() => {
              if (!confirm(`Delete ${brandName}? This cannot be undone.`)) return;
              start(async () => {
                const res = await deleteBrand(brandId);
                if (res?.error) { alert(res.error); return; }
                router.push('/');
              });
            }}>Delete brand</button>
        </div>
      </div>
    </div>
  );
}
