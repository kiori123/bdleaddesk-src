'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { deleteBrand, trackBrand, untrackBrand } from './actions';
import AddContactModal from './AddContactModal';
import AddBrandModal from './AddBrandModal';
import Modal from './Modal';
import { CONTACT_SOURCES, SOURCE_LABEL, type ContactSource } from '@/lib/contactOrigin';

export type Row = {
  id: string; name: string; stage: string | null; stageAt: string | null;
  tier: number; category: string | null; contacts: number; full: number;
  withInfo: number;
  status: string | null; stuckReason: string | null;
  owner: string | null; lastUpdate: string | null;
  sources: string[];
};
export type Cat = { id: string; name: string };
export type Credit = {
  category_id: string; category_name: string;
  granted: number; used: number; remaining: number;
};

const STAGES = ['first_meeting', 'internal_review', 'bp_pitch', 'negotiating', 'live'];
const STAGE_LABEL: Record<string, string> = {
  first_meeting: 'First meeting', internal_review: 'Internal review',
  bp_pitch: 'BP pitch', negotiating: 'Negotiating', live: 'Live',
};

type Sort = 'az' | 'za' | 'most' | 'new' | 'tier' | 'stale';

const flat = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd').toLowerCase();
const when = (d: string | null) => (d ? d.slice(0, 10) : 'n/a');

const STATUS_LABEL: Record<string, string> = {
  in_progress: 'In progress', waiting_brand: 'Waiting', stuck: 'Stuck',
  won: 'Won', lost: 'Lost',
};
const REASON_LABEL: Record<string, string> = {
  no_response: 'No response', waiting_bdm: 'Waiting for BDM',
  waiting_brand: 'Waiting for brand', contact_not_relevant: 'Contact not relevant',
  need_more_info: 'Need more info', negotiation: 'Negotiation',
  internal_approval: 'Internal approval', other: 'Other',
};

/** Bac trong so do to chuc. Cung nguong voi TIERS ben BrandView. */
const tierOfRank = (r: number) =>
  (r <= 20 ? 'Executive' : r <= 38 ? 'Head / Director' : r <= 50 ? 'Manager' : 'Team');

const staleDays = (d: string | null) =>
  d === null ? 999 : Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

/** "3 days ago" doc nhanh hon dau thoi gian, va mau noi ngay muc do bo be. */
function Stale({ at }: { at: string | null }) {
  const d = staleDays(at);
  const label = at === null ? 'never updated'
    : d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
  const color = d >= 7 ? 'var(--acc)' : d >= 3 ? '#B9791F' : 'var(--faint)';
  return (
    <span className="rupd" style={{ color, fontSize: 11, whiteSpace: 'nowrap' }}
          title={at ? `Last update ${when(at)}` : 'No update on record'}>
      {d >= 7 && '\u25CF '}{label}
    </span>
  );
}

export default function BrandBoard({
  rows, cats, scanUrl, adminEmail,
}: { rows: Row[]; cats: Cat[]; scanUrl: string; adminEmail: string }) {
  const [q, setQ] = useState('');
  const [f, setF] = useState('all');
  const [catF, setCatF] = useState('all');
  const [srcF, setSrcF] = useState('all');

  // Thong bao nhac viec tro toi /?filter=stale. Doc mot lan luc mo trang de
  // PIC bam vao la thay ngay dung may case dang bi hoi, khong phai tu loc.
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('filter');
    if (v === 'stale' || v === 'stuck') setF(v);
  }, []);
  const [sort, setSort] = useState<Sort>('az');
  const [dangXuat, setDangXuat] = useState(false);
  const [shut, setShut] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [addFor, setAddFor] = useState<{ id: string; name: string } | null>(null);
  const [pickFor, setPickFor] = useState<Row | null>(null);
  const [addBrand, setAddBrand] = useState(false);
  const [, start] = useTransition();

  // Track brand chua co category thi phai chon truoc, vi brand khong category
  // khong tinh vao han muc credit nao va chi admin nhin thay.
  function track(r: Row, categoryId?: string) {
    setBusy(r.id);
    start(async () => {
      const res = await trackBrand(r.id, categoryId ?? null);
      setBusy(null);
      if ((res as any)?.needCategory) { setPickFor(r); return; }
      setPickFor(null);
    });
  }

  function untrack(r: Row) {
    if (!confirm(`Stop tracking ${r.name}?`)) return;
    setBusy(r.id);
    start(async () => { await untrackBrand(r.id); setBusy(null); });
  }

  const isEmpty = rows.length === 0;
  const totalPeople = rows.reduce((n, r) => n + r.contacts, 0);
  const totalFull = rows.reduce((n, r) => n + r.full, 0);
  const partial = totalPeople - totalFull;
  const pct = totalPeople ? Math.round((totalFull / totalPeople) * 100) : 0;
  const fullPct = totalPeople ? (totalFull / totalPeople) * 100 : 0;
  const withContacts = rows.filter((r) => r.contacts > 0).length;
  const avgPer = withContacts ? totalPeople / withContacts : 0;

  const tiers = useMemo(
    () => [...new Set(rows.map((r) => String(r.tier)))].sort(), [rows]);

  // Chi hien cac category/source THAT SU dang co brand nao do, thay vi liet ke
  // toan bo he thong - chon mot muc khong ai co thi danh sach chi con "No
  // match", vo ich.
  const catOptions = useMemo(
    () => [...new Set(rows.map((r) => r.category ?? 'Uncategorised'))].sort(), [rows]);
  const srcOptions = useMemo(() => {
    const co = new Set(rows.flatMap((r) => r.sources));
    return CONTACT_SOURCES.filter((s) => co.has(s));
  }, [rows]);

  const tierSegs = useMemo(() => {
    const shades = ['#0093A3', '#2F7A85', '#0C3D47', '#5D8F98', '#8AA3A9'];
    return tiers.map((t, i) => ({
      w: (rows.filter((r) => String(r.tier) === t).length * 100) / (rows.length || 1),
      c: shades[i % 5], t,
    }));
  }, [rows, tiers]);

  const tracked = rows.filter((r) => r.stage);
  const projects = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of tracked) {
      const k = r.category ?? 'Uncategorised';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const shown = useMemo(() => {
    const s = flat(q.trim());
    const out = rows.filter((r) => {
      if (s && !flat(r.name).includes(s)) return false;
      if (catF !== 'all' && (r.category ?? 'Uncategorised') !== catF) return false;
      if (srcF !== 'all' && !r.sources.includes(srcF)) return false;
      if (f === 'full')    return r.full > 0;
      if (f === 'partial') return r.full === 0;
      if (f === 'stuck')   return r.status === 'stuck';
      if (f === 'stale')   return staleDays(r.lastUpdate) >= 3;
      if (f[0] === 't')    return String(r.tier) === f.slice(1);
      return true;
    });
    const by: Record<Sort, (a: Row, b: Row) => number> = {
      az:   (a, b) => a.name.localeCompare(b.name),
      za:   (a, b) => b.name.localeCompare(a.name),
      most: (a, b) => b.contacts - a.contacts,
      new:  (a, b) => (b.stageAt ?? '').localeCompare(a.stageAt ?? ''),
      stale: (a, b) => staleDays(b.lastUpdate) - staleDays(a.lastUpdate),
      tier: (a, b) => a.tier - b.tier || a.name.localeCompare(b.name),
    };
    return [...out].sort(by[sort]);
  }, [rows, q, f, catF, srcF, sort]);

  /**
   * Xuat file danh ba.
   *
   * Goi xuong may chu de dung file .xlsx that, khong tu ghep CSV o day nua.
   * Ly do duy nhat: Excel doc CSV thi tu doan kieu du lieu, va no doan sai dung
   * cot quan trong nhat. 0355832588 mat so 0 dau, 84983579285 thanh
   * 8.49836E+10. So dien thoai hong la ca dong contact do vo dung.
   */
  async function exportCsv() {
    setDangXuat(true);
    try {
      const res = await fetch('/api/contacts-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandIds: shown.map((r) => r.id) }),
      });
      if (!res.ok) {
        alert(`Could not build the file. ${await res.text().catch(() => '')}`.trim());
        return;
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `bd-lead-hub-contacts-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setDangXuat(false);
    }
  }

  const mailto = `mailto:${adminEmail}?subject=${encodeURIComponent('BD Lead Hub - request')}`;

  return (
    <>
      <div className="phead">
        <h1 className="h1">BD Lead Hub</h1>
        <span className="h1s">Find the decision makers at any brand, in any category, then reach them.</span>
      </div>

      <div className="bento">
        <div className="tile k1 hl">
          <div className="kv2">{rows.length}</div>
          <div className="kl">Brands researched</div>
          <div className="kwrap">
            <div className="ktrack">
              {tierSegs.length === 0
                ? <div className="kseg b" style={{ width: '100%' }} />
                : tierSegs.map((s) => (
                    <div className="kseg" key={s.t} style={{ width: `${s.w}%`, background: s.c }} />
                  ))}
            </div>
            <div className="ksub">
              {tiers.length
                ? tiers.map((t) => `T${t}: ${rows.filter((r) => String(r.tier) === t).length}`).join(' · ')
                : 'Nothing scanned yet'}
            </div>
          </div>
        </div>

        <div className="tile k1 tl">
          <div className="kv2">{totalPeople}</div>
          <div className="kl">Contacts revealed</div>
          <div className="kwrap">
            <div className="ktrack">
              <div className="kseg a" style={{ width: `${rows.length ? (withContacts / rows.length) * 100 : 0}%` }} />
              <div className="kseg b" style={{ width: `${rows.length ? 100 - (withContacts / rows.length) * 100 : 100}%` }} />
            </div>
            <div className="ksub">
              Across {withContacts} brand{withContacts === 1 ? '' : 's'}
              {withContacts ? ` · ${avgPer.toFixed(1)} each on average` : ''}
            </div>
          </div>
        </div>

        <div className="tile k1 tk">
          <div className="kv2">{pct}%</div>
          <div className="kl">With email and phone</div>
          <div className="kwrap">
            <div className="ktrack">
              <div className="kseg a" style={{ width: `${fullPct}%` }} />
              <div className="kseg b" style={{ width: `${100 - fullPct}%` }} />
            </div>
            <div className="ksub">{totalFull} complete, {partial} missing something</div>
          </div>
        </div>

        {scanUrl ? (
          <Link className="tile cta" href={scanUrl}>
            <div className="ctar"><span className="ctat">New scan</span><span className="ctag">→</span></div>
            <div className="ctas">Pick what you are looking for, then type the brands. Looking is free.</div>
          </Link>
        ) : (
          <div className="tile k1">
            <div className="kl" style={{ marginTop: 0, fontWeight: 700, color: 'var(--tx)' }}>
              Scanning is offline
            </div>
            <div className="ksub" style={{ marginTop: 6 }}>
              The lookup service is being moved. Everything else on this page still works.
            </div>
          </div>
        )}

        {/* Current projects ------------------------------------------- */}
        <div className="tile g-proj">
          <div className="chead">
            <div>
              <div className="ct">Current projects<span className="badge">{tracked.length}</span></div>
              <div className="cs">Brands you are actively working, grouped by category</div>
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="proj-empty">
              Nothing tracked yet. Open a brand and pick a stage to see it here.
            </div>
          ) : projects.map(([cat, list]) => {
            const open = !shut[cat];
            return (
              <div className={`cat-sec${open ? ' open' : ''}`} key={cat}>
                <button className="cat-hd" onClick={() => setShut({ ...shut, [cat]: open })}>
                  <span className="cat-hd-name">{cat}</span>
                  <span className="cat-badge">{list.length}</span>
                  <span className="cat-chev">›</span>
                </button>
                <div className="cat-body">
                  <div className="pjw">
                    {list.map((r) => {
                      const at = STAGES.indexOf(r.stage!);
                      return (
                        <Link className="pj" key={r.id} href={`/brand/${r.id}`}>
                          <span className="pjn">{r.name}</span>
                          <span className="pjt">
                            {STAGES.map((_, i) => (
                              <span key={i} className={`pjs${i < at ? ' done' : i === at ? ' now' : ''}`} />
                            ))}
                          </span>
                          <span className="pjm">
                            <span className="pjl">{STAGE_LABEL[r.stage!]}</span>
                            <span className="pjd">{at + 1} of {STAGES.length}</span>
                          </span>
                          <button className="pjx" title="Untrack"
                            onClick={(e) => {
                              e.preventDefault();
                              untrack(r);
                            }}>×</button>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Researched brands ------------------------------------------ */}
        <div className="tile g-list">
          <div className="chead">
            <div>
              <div className="ct">Researched brands<span className="badge">{rows.length}</span></div>
              <div className="cs">Filter, sort or export</div>
            </div>
          </div>

          <div className="toolbar">
            <input className="srch" type="search" autoComplete="off" spellCheck={false}
              disabled={isEmpty} value={q} onChange={(e) => setQ(e.target.value)}
              placeholder={isEmpty ? 'No brands yet' : 'Search brands'} />

            <div className="frow">
              <button className={`chipf${f === 'all' ? ' on' : ''}${isEmpty ? ' off' : ''}`}
                onClick={() => setF('all')}>All</button>
              {tiers.map((t) => (
                <button key={t} className={`chipf${f === 't' + t ? ' on' : ''}`}
                  onClick={() => setF('t' + t)}>Tier {t}</button>
              ))}
              <button className={`chipf${f === 'full' ? ' on' : ''}${isEmpty ? ' off' : ''}`}
                onClick={() => setF('full')}>Full contact</button>
              <button className={`chipf${f === 'partial' ? ' on' : ''}${isEmpty ? ' off' : ''}`}
                onClick={() => setF('partial')}>Missing</button>
              <button className={`chipf${f === 'stuck' ? ' on' : ''}${isEmpty ? ' off' : ''}`}
                onClick={() => setF('stuck')}>Stuck</button>
              <button className={`chipf${f === 'stale' ? ' on' : ''}${isEmpty ? ' off' : ''}`}
                onClick={() => setF('stale')}>Needs update</button>
            </div>

            <select className="sel" disabled={isEmpty || catOptions.length === 0} value={catF}
              onChange={(e) => setCatF(e.target.value)}>
              <option value="all">All categories</option>
              {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <select className="sel" disabled={isEmpty || srcOptions.length === 0} value={srcF}
              onChange={(e) => setSrcF(e.target.value)}>
              <option value="all">All sources</option>
              {srcOptions.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s as ContactSource]}</option>)}
            </select>

            <select className="sel" disabled={isEmpty} value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="az">Name A to Z</option>
              <option value="za">Name Z to A</option>
              <option value="most">Most contacts</option>
              <option value="new">Recently updated</option>
              <option value="tier">Tier</option>
              <option value="stale">Longest without update</option>
            </select>

            <button className="mini" onClick={() => setAddBrand(true)}>+ Add brand</button>
            <button
              className={`mini${isEmpty || dangXuat ? ' off' : ''}`}
              onClick={exportCsv} disabled={dangXuat}
            >
              {dangXuat ? 'Building the file…' : 'Export contacts'}
            </button>
            <span className="cnt">{shown.length} of {rows.length}</span>
          </div>

          <div className="list">
            {shown.length === 0 && (
              <div className="empty">
                <b>{isEmpty ? 'No brands yet' : 'No match'}</b>
                <div>{isEmpty
                  ? 'Run a scan and results appear here.'
                  : 'Nothing matches that search or filter.'}</div>
              </div>
            )}

            {(() => {
              /*
               * Chia lam hai nhom, moi nhom mot tam giac dong mo giong khu
               * Tracked o tren.
               *
               * Vi sao khong dung mot nut loc: PIC muon GIAU nhom da tim cho
               * khuat mat, chu khong muon no bien mat khoi danh sach. Loc di thi
               * so dem doi theo va khong con biet tong cong bao nhieu.
               */
              const daTim = shown.filter((r) => r.contacts > 0);
              const chuaTim = shown.filter((r) => r.contacts === 0);

              const veHang = (r: Row) => {
              const at = r.stage ? STAGES.indexOf(r.stage) : -1;
              return (
                // Luoi 3 cot, dinh nghia trong globals.css chu khong phai
                // inline style: inline style khong mang duoc media query, ma
                // tren dien thoai luoi nay bat buoc phai xep thanh mot cot.
                <div className="row brow" key={r.id}>

                  {/* Ten brand + meta. Truoc day cum nay bi co lai vi ca hang co
                      toi 10 phan tu khong cho xuong dong, nen "Tier 1 · 2
                      contacts · 2026-08-24" bi cat con "Tier ...". Cho phep
                      xuong dong va bo ellipsis. */}
                  <Link href={`/brand/${r.id}`} className="rw"
                    style={{ minWidth: 0, overflow: 'visible' }}>
                    <span className="rname" style={{ whiteSpace: 'normal' }}>{r.name}</span>
                    {/* Owner va category la thuoc tinh cua brand, khong phai
                        trang thai - de chung o day thay vi lam pill ben phai.
                        Truoc day sau cai pill cung hinh dang nen mat khong
                        phan biet duoc cai nao quan trong. */}
                    <div className="rmeta"
                      style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip' }}>
                      Tier {r.tier} · {r.contacts} contact{r.contacts === 1 ? '' : 's'}
                      {r.category ? ` · ${r.category}` : ''}
                      {r.owner ? ` · ${r.owner}` : ' · no owner'}
                    </div>
                  </Link>

                  {/* Cum nhan: tu xuong dong khi het cho, thay vi de nen len nhau */}
                  <div className="brow-tags">
                    {/* Full = it nhat mot nguoi co ca email lan phone. Partial =
                        khong ai day du nhung co nguoi co it nhat mot thu. Con lai
                        (co nguoi nhung khong ai co email/phone gi ca) la "No
                        contact" - truoc day gop chung voi Partial nen mot brand
                        reveal ra ten suong cung hien nhu con thieu chut it. */}
                    {r.contacts > 0 && (
                      r.full > 0
                        ? <span className="pill ok"><span className="dot" />Full</span>
                        : r.withInfo > 0
                        ? <span className="pill no">Partial</span>
                        : <span className="pill no">No contact</span>
                    )}

                    {r.stage && (
                      <span className="rstg" style={{ color: 'var(--dim)' }}>
                        {STAGE_LABEL[r.stage]}
                        <span className="rstgb">
                          {STAGES.map((_, i) => (
                            <span key={i} className={`rstgs${i <= at ? ' on' : ''}`} />
                          ))}
                        </span>
                      </span>
                    )}

                    {r.status && r.status !== 'in_progress' && (
                      <span className={`pill${r.status === 'stuck' ? ' no' : ''}`}
                        title={r.stuckReason ? REASON_LABEL[r.stuckReason] : undefined}
                        style={r.status === 'stuck'
                          ? { background: 'rgba(212,58,56,.09)', color: 'var(--acc)' }
                          : undefined}>
                        {STATUS_LABEL[r.status] ?? r.status}
                        {r.status === 'stuck' && r.stuckReason ? ` · ${REASON_LABEL[r.stuckReason]}` : ''}
                      </span>
                    )}

                    <Stale at={r.lastUpdate} />
                  </div>

                  {/* Nut hanh dong: luon dinh ben phai, khong bi day xuong lan
                      voi nhan */}
                  <div className="brow-act">
                  <button className="trk" title="Add a contact by hand"
                    onClick={() => setAddFor({ id: r.id, name: r.name })}>+ Contact</button>

                  <button className={`trk${r.stage ? ' on' : ''}`} disabled={busy === r.id}
                    onClick={() => (r.stage ? untrack(r) : track(r))}>
                    {busy === r.id ? '…' : r.stage ? 'Untrack' : 'Track'}
                  </button>

                  <Link href={`/brand/${r.id}`} className="chev">›</Link>

                  <button className="rowx" title="Delete brand" disabled={busy === r.id}
                    onClick={() => {
                      if (!confirm(`Delete ${r.name}? Every contact, note and document goes with it.`)) return;
                      setBusy(r.id);
                      start(async () => {
                        const res = await deleteBrand(r.id);
                        setBusy(null);
                        if (res?.error) alert(res.error);
                      });
                    }}>×</button>
                  </div>
                </div>
              );
              };

              const nhom = (khoa: string, nhan: string, ds: Row[], phu: string) => {
                if (!ds.length) return null;
                const mo = !shut[khoa];
                return (
                  <div className={`cat-sec${mo ? ' open' : ''}`} key={khoa}>
                    <button className="cat-hd" onClick={() => setShut({ ...shut, [khoa]: mo })}>
                      <span className="cat-hd-name">{nhan}</span>
                      <span className="cat-badge">{ds.length}</span>
                      <span className="cat-hd-sub">{phu}</span>
                      <span className="cat-chev">›</span>
                    </button>
                    <div className="cat-body">{ds.map(veHang)}</div>
                  </div>
                );
              };

              return (
                <>
                  {nhom('chua-tim', 'Not researched yet', chuaTim, 'nobody looked these up')}
                  {nhom('da-tim', 'Researched', daTim, 'contacts already on file')}
                </>
              );
            })()}
          </div>
        </div>

        {/* What costs what -------------------------------------------- */}
        <div className="tile g-side">
          <div className="chead">
            <div className="ct">What costs what</div>
            <div className="cs">Credits are spent only when you say so</div>
          </div>
          <div className="cbody">
            <div className="crow">
              <div className="cwhat"><b>Searching</b>Any number of brands</div>
              <span className="ctag2 free">Free</span>
            </div>
            <div className="crow">
              <div className="cwhat"><b>Revealing</b>Only when data comes back</div>
              <span className="ctag2 paid">1 credit</span>
            </div>
            <div className="crow">
              <div className="cwhat"><b>Bios and charts</b>For whoever you revealed</div>
              <span className="ctag2 free">Included</span>
            </div>

            <div className="hint">
              A reveal that finds nothing is not charged, and revealing the same person
              again later is free. One credit unlocks every detail on file for that person.
            </div>

          </div>
        </div>

        {/* How it works ------------------------------------------------ */}
        <div className="tile g-how">
          <div className="chead"><div className="ct">How it works</div></div>
          <div className="how3">
            <div className="st"><span className="sn">1</span>
              <span>Type brands or upload any spreadsheet. The column can be named anything.</span></div>
            <div className="st"><span className="sn">2</span>
              <span>The scan finds people at manager level and above, and you tick who to reveal.</span></div>
            <div className="st"><span className="sn">3</span>
              <span>Bios and org charts are written for the people you picked.</span></div>
          </div>
        </div>

        <div className="tile foot g-how">
          <div>
            <div className="ft">Found a bug or need a new feature?</div>
            <div className="fd">The assistant answers questions about the tool. For anything it cannot do, reach the admin.</div>
          </div>
          <a className="btn2" href={mailto}>Contact admin</a>
        </div>
      </div>

      <div className="made">Made by <b>Khoa</b> · BD Team</div>

      <AddContactModal brand={addFor} onClose={() => setAddFor(null)} />
      <AddBrandModal open={addBrand} cats={cats} onClose={() => setAddBrand(false)} />

      {/* Chon category truoc khi bat dau theo doi */}
      <Modal open={!!pickFor} onClose={() => setPickFor(null)} width={400}>
          <div className="modal-h">
            <div>
              <div className="modal-t">Pick a category</div>
              <div className="modal-s">{pickFor?.name} has no category yet</div>
            </div>
            <button className="modal-x" onClick={() => setPickFor(null)}>×</button>
          </div>
          <div className="modal-b">
            <div className="catw">
              {cats.map((c) => (
                <button key={c.id} className="catc"
                  onClick={() => pickFor && track(pickFor, c.id)}>{c.name}</button>
              ))}
            </div>
            <p style={{ fontSize: 10.5, color: 'var(--faint)', margin: '12px 0 0' }}>
              Category decides who can see this brand and which credit budget it draws from.
            </p>
          </div>
      </Modal>
    </>
  );
}
