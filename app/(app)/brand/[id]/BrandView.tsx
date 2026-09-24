'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import AddContactModal from '../../AddContactModal';
import EditContactModal from './EditContactModal';
import CasePanel from './CasePanel';
import CopyContactsButton from './CopyContactsButton';
import { deleteContact } from './actions';
import { dienMau, nguonTuContact, duongDanOutlook, banDeChep } from '@/lib/template';
import { linkTaiVe } from '../../templates/fileActions';
import { originLabel } from '@/lib/contactOrigin';
import type { ContactRow } from '@/lib/contactColumns';

export type Contact = {
  id: string; full_name: string; job_title: string | null; company: string | null;
  email: string | null; phone: string | null; linkedin_url: string | null;
  location: string | null; org_rank: number | null; bio: string | null;
  source: string | null;
};

const TIERS = [
  { max: 20,  cls: '',   label: 'Executive',      hint: 'Runs the company' },
  { max: 38,  cls: 't2', label: 'Head / Director', hint: 'Owns a function or a market' },
  { max: 50,  cls: 't3', label: 'Manager',        hint: 'Runs the day to day' },
  { max: 999, cls: 't4', label: 'Team',           hint: 'Individual contributor' },
];
const tierOf = (r: number | null) => TIERS.find((t) => (r ?? 60) <= t.max)!;

const initials = (n: string) =>
  n.trim().split(/\s+/).slice(-2).map((w) => w[0]).join('').toUpperCase();

/** So Viet Nam ve dang 0xxxxxxxxx de mo duoc Zalo. */
function zaloNumber(raw: string | null) {
  let d = String(raw || '').replace(/[^0-9]/g, '');
  if (!d) return '';
  if (d.indexOf('0084') === 0) d = '0' + d.slice(4);
  else if (d.indexOf('84') === 0 && d.length >= 10) d = '0' + d.slice(2);
  if (d.length < 9 || d.length > 11) return '';
  return d;
}

function Mini({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className={`mini${done ? ' ok' : ''}`}
      onClick={() => navigator.clipboard?.writeText(text).finally(() => {
        setDone(true); setTimeout(() => setDone(false), 1300);
      })}>{done ? 'Copied' : label}</button>
  );
}

/**
 * Mot file gui kem cua mau thu.
 *
 * Nut Email KHONG dinh file vao thu duoc, nen day la duong de PIC lay file ve
 * roi tu dinh trong Outlook. Duong dan ky ten song 5 phut, xin ngay luc bam
 * chu khong dung san trong trang: de san thi no het han truoc khi ai kip bam.
 */
function FileGuiKem({ f }: { f: { id: string; name: string; share_url: string | null } }) {
  const [dang, setDang] = useState(false);
  return (
    <button
      className="mini" disabled={dang}
      onClick={async () => {
        setDang(true);
        try {
          const r = await linkTaiVe(f.id);
          if (r?.url) window.open(r.url, '_blank', 'noopener');
        } finally { setDang(false); }
      }}
    >
      {dang ? 'Opening…' : f.name}
    </button>
  );
}

export default function BrandView({
  brandId, brandName, contacts, mau, toi, files, isAdmin,
}: {
  brandId: string; brandName: string; contacts: Contact[];
  mau: { subject: string; body: string; cc: string } | null;
  toi: { name: string; email: string };
  files: { id: string; name: string; size: number; share_url: string | null }[];
  isAdmin: boolean;
}) {
  const [selId, setSelId] = useState<string | null>(contacts[0]?.id ?? null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [, start] = useTransition();
  const sel = contacts.find((c) => c.id === selId) ?? null;

  // Gui hang loat: chon nhieu nguoi, roi mo tung thu rieng mot qua Outlook.
  // Khong gop chung mot thu cho ca nhom, vi mau con ca nhan hoa theo tung
  // nguoi ({{first_name}}, {{job_title}}, {{bio}}) — ghep chung se sai het.
  const [bulkIds, setBulkIds] = useState<Set<string>>(new Set());
  const [bulkPanel, setBulkPanel] = useState<'individual' | 'group' | null>(null);
  const [bulkIdx, setBulkIdx] = useState(0);
  const toggleBulk = (id: string) => setBulkIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const groups = TIERS
    .map((t) => ({ t, people: contacts.filter((c) => tierOf(c.org_rank) === t) }))
    .filter((g) => g.people.length > 0);

  const copyRows: ContactRow[] = contacts.map((c) => ({
    full_name: c.full_name,
    job_title: c.job_title,
    email: c.email,
    phone: c.phone,
    linkedin_url: c.linkedin_url,
    location: c.location,
    level: tierOf(c.org_rank).label,
    brand: brandName,
    source: originLabel(c.source),
  }));

  /**
   * Thu da dien san, mo bang Outlook.
   *
   * Team dung Microsoft 365 chu khong phai Google. Truoc day cho nay tro sang
   * mail.google.com, tuc mo mot hop thu ma khong ai o day dang nhap.
   *
   * Noi dung lay tu mau mac dinh cua chinh nguoi dang xem. Chua co mau nao thi
   * chi dien nguoi nhan va mot tieu de toi thieu, con hon la khong mo duoc gi.
   *
   * `thieu` la danh sach cho trong khong dien duoc voi nguoi nay. Con thieu thi
   * KHONG cho bam gui: "I noticed you {{bio}}" ma bio rong se di thang ra hop
   * thu khach hang voi mot lo hong giua cau.
   */
  // Nhu tren nhung dung duoc cho bat ky contact nao, khong chi `sel`. Dung
  // chung cho ca panel chi tiet lan hang cho gui hang loat ben duoi, de
  // khong co ban logic thu hai phai sua theo ban dau.
  const layThuChoContact = (c: Contact) => {
    if (!c.email) return null;

    const nguon = nguonTuContact({
      full_name: c.full_name, job_title: c.job_title, company: c.company, location: c.location,
      bio: c.bio, brand: brandName, senderName: toi.name, senderEmail: toi.email,
      files: files.filter((f) => f.share_url).map((f) => ({ name: f.name, url: f.share_url! })),
    });

    const td = dienMau(mau?.subject || `Partnership Opportunity with ${brandName}`, nguon);
    const th = dienMau(mau?.body ?? '', nguon);
    const cc = mau?.cc ?? '';
    const { url, qua_dai } = duongDanOutlook(c.email, td.text, th.text, cc);

    return {
      url, qua_dai, cc,
      chep: banDeChep(c.email, cc, td.text, th.text),
      thieu: [...new Set([...td.thieu, ...th.thieu])],
      coMau: Boolean(mau?.body?.trim()),
    };
  };

  const thu = sel ? layThuChoContact(sel) : null;
  const outlook = thu && thu.thieu.length === 0 && !thu.qua_dai ? thu.url : '';
  const zalo = sel ? zaloNumber(sel.phone) : '';
  const first = sel ? sel.full_name.trim().split(/\s+/).slice(-1)[0] : '';

  // Hang cho gui hang loat. Nguoi thieu email hoac thieu cho trong bi loai
  // khoi hang, khong am tham bo qua — liet ke ro ten va ly do o duoi.
  const bulkQueue = contacts
    .filter((c) => bulkIds.has(c.id))
    .map((c) => ({ contact: c, thu: layThuChoContact(c) }));
  const laSan = (x: { thu: ReturnType<typeof layThuChoContact> }) =>
    Boolean(x.thu && x.thu.thieu.length === 0 && !x.thu.qua_dai);
  const bulkReady = bulkQueue.filter(laSan);
  const bulkSkipped = bulkQueue.filter((x) => !laSan(x));
  const bulkIdxAn = Math.min(bulkIdx, Math.max(bulkReady.length - 1, 0));
  const bulkCurrent = bulkReady[bulkIdxAn] ?? null;

  /**
   * Gui nhom: MOT thu duy nhat, tat ca email da chon nam chung trong To.
   *
   * Khac voi bulkQueue o tren (moi nguoi mot thu rieng, ca nhan hoa). Cho nay
   * khong dien first_name/job_title/bio cho ai ca, nen neu mau dang dung co
   * nhung cho trong do thi dienMau() se tu lay vao `thieu` va man hinh se
   * chan gui — dung logic co san, khong can kiem tra rieng ten field.
   *
   * To thay vi Bcc: nguoi dung nhom nay dung khi ho MUON nguoi nhan thay
   * nhau (vi du gui chung mot thong bao cho ca nhom PIC ben brand), khong
   * phai gui rieng le nguy trang thanh chung.
   */
  const bulkGroup = contacts.filter((c) => bulkIds.has(c.id) && c.email);
  const thuNhom = bulkGroup.length ? (() => {
    const nguon = nguonTuContact({
      brand: brandName, senderName: toi.name, senderEmail: toi.email,
      files: files.filter((f) => f.share_url).map((f) => ({ name: f.name, url: f.share_url! })),
    });
    const td = dienMau(mau?.subject || `Partnership Opportunity with ${brandName}`, nguon);
    const th = dienMau(mau?.body ?? '', nguon);
    const cc = mau?.cc ?? '';
    const to = bulkGroup.map((c) => c.email!).join(',');
    const { url, qua_dai } = duongDanOutlook(to, td.text, th.text, cc);
    return {
      url, qua_dai, to,
      chep: banDeChep(to, cc, td.text, th.text),
      thieu: [...new Set([...td.thieu, ...th.thieu])],
    };
  })() : null;

  let badge = <span className="pill ok"><span className="dot" />Full contact</span>;
  if (sel && !sel.email && sel.phone)      badge = <span className="pill no">Phone only</span>;
  else if (sel && sel.email && !sel.phone) badge = <span className="pill no">Email only</span>;
  else if (sel && !sel.email && !sel.phone) badge = <span className="pill no">No contact</span>;

  return (
    <>
      <CasePanel brandId={brandId} />

      <div className="tile d-l">
        <div className="chead">
          <div>
            <div className="ct">Contact detail</div>
            <div className="cs">Selected from the org chart</div>
          </div>
        </div>

        <div className="cbody" style={{ paddingTop: 15 }}>
          {!sel && <p className="note">No contacts on file for this brand yet.</p>}

          {sel && (
            <>
              <div className="who">
                <div className="av">{initials(sel.full_name)}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="nm">{sel.full_name}</div>
                  <div className="ti">
                    {sel.job_title ?? 'Title unknown'}
                    {sel.company && sel.company !== brandName && ` · ${sel.company}`}
                  </div>
                </div>
                {badge}
              </div>

              {sel.email && (
                <div className="kv">
                  <div className="k">Email</div>
                  <div className="v"><div className="vrow">
                    <span className="vtext">{sel.email}</span>
                    {outlook
                      ? <a className="mini" href={outlook} target="_blank" rel="noopener">Outlook</a>
                      : <span className="mini off">Outlook</span>}
                    <a className="mini" href={`mailto:${sel.email}`}>Mail app</a>
                    <Mini text={sel.email} label="Copy" />
                  </div></div>
                </div>
              )}

              {/* Vi sao nut Outlook bi khoa. Khoa ma khong noi ly do thi PIC
                  tuong app hong roi bo qua ca tinh nang. */}
              {thu && thu.thieu.length > 0 && (
                <div className="mb-1 mt-2 rounded-lg border-l-[3px] border-red-deep bg-surface-sunk px-3 py-2.5 text-[12px] leading-relaxed text-ink-dim">
                  <b className="text-ink">
                    Cannot draft the email: {thu.thieu.map((k) => `{{${k}}}`).join(', ')}{' '}
                    {thu.thieu.length === 1 ? 'is' : 'are'} empty for {sel.full_name}.
                  </b>{' '}
                  Sending it would leave a hole mid sentence. Either fill that in on the contact,
                  or change your template so the missing part sits on a line you can drop.{' '}
                  <Link href="/templates" className="font-semibold text-teal-deep hover:underline">
                    Edit template
                  </Link>
                </div>
              )}

              {thu && thu.qua_dai && (
                <div className="mb-1 mt-2 rounded-lg border-l-[3px] border-red-deep bg-surface-sunk px-3 py-2.5 text-[12px] leading-relaxed text-ink-dim">
                  <b className="text-ink">Your template is too long to open this way.</b>{' '}
                  Some corporate mail proxies cut the link and the end of the email goes missing
                  without saying so.{' '}
                  <Link href="/templates" className="font-semibold text-teal-deep hover:underline">
                    Shorten it
                  </Link>
                </div>
              )}

              {thu && !thu.coMau && thu.thieu.length === 0 && (
                <div className="mb-1 mt-2 rounded-lg border-l-[3px] border-line bg-surface-sunk px-3 py-2.5 text-[12px] leading-relaxed text-ink-dim">
                  Outlook opens with the recipient and a subject, but an empty body: you have no
                  template yet.{' '}
                  <Link href="/templates" className="font-semibold text-teal-deep hover:underline">
                    Write one
                  </Link>
                </div>
              )}

              {sel.phone && (
                <div className="kv">
                  <div className="k">Phone</div>
                  <div className="v"><div className="vrow">
                    <span className="vtext">{sel.phone}</span>
                    {zalo && <a className="mini" href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener">Zalo</a>}
                    <a className="mini" href={`tel:${sel.phone}`}>Call</a>
                    <Mini text={sel.phone} label="Copy" />
                  </div></div>
                </div>
              )}

              {/* File gui kem cua mau thu. Nut Email khong dinh file duoc, nen
                  cho nay de PIC tai ve roi tu dinh trong Outlook. File nao da
                  bat chia se thi link cua no cung da nam san trong noi dung thu
                  qua cho trong {{files}}, khong can tai. */}
              {files.length > 0 && (
                <div className="kv">
                  <div className="k">Files</div>
                  <div className="v"><div className="vrow" style={{ flexWrap: 'wrap' }}>
                    {files.map((f) => <FileGuiKem key={f.id} f={f} />)}
                    <span className="vtext" style={{ color: 'var(--faint)', fontSize: 11.5 }}>
                      download, then attach in Outlook
                    </span>
                  </div></div>
                </div>
              )}

              {/* Hang nay TRUOC DAY chi hien khi co san duong dan LinkedIn, nen
                  voi phan lon nguoi trong bang no bien mat han. Ba phan tu so
                  contact hien khong co truong do, rieng bo seed nhap tay thi
                  42 tren 45 nguoi khong co. PIC tuong nut bi go mat.
                  Khong co san thi dua thang sang o tim cua LinkedIn, dien truoc
                  ten va cong ty. Cham hon mot nhip nhung luon co duong di. */}
              <div className="kv">
                <div className="k">LinkedIn</div>
                <div className="v"><div className="vrow">
                  {sel.linkedin_url ? (
                    <>
                      <a className="mini" href={sel.linkedin_url} target="_blank" rel="noopener">Open profile</a>
                      <Mini text={sel.linkedin_url} label="Copy link" />
                    </>
                  ) : (
                    <>
                      <a
                        className="mini"
                        href={`https://www.linkedin.com/search/results/people/?keywords=${
                          encodeURIComponent(`${sel.full_name} ${brandName}`)}`}
                        target="_blank" rel="noopener"
                      >
                        Search on LinkedIn
                      </a>
                      <span className="vtext" style={{ color: 'var(--faint)', fontSize: 11.5 }}>
                        no profile link on file
                      </span>
                    </>
                  )}
                </div></div>
              </div>

              <div className="kv">
                <div className="k">Level</div>
                <div className="v">
                  <span className="vtext">
                    {tierOf(sel.org_rank).label} · {tierOf(sel.org_rank).hint}
                  </span>
                </div>
              </div>

              <div className="kv">
                <div className="k">Origin</div>
                <div className="v">
                  <span className="vtext">{originLabel(sel.source)}</span>
                </div>
              </div>

              {sel.bio && <div className="bio">{sel.bio}</div>}

              <div className="acts">
                {outlook && <a className="btn" href={outlook} target="_blank" rel="noopener">Email {first}</a>}
                {/* Duong dan mo Outlook KHONG dinh kem file duoc, va se khong bao
                    gio dinh duoc: trinh duyet khong duoc phep gan file vao thu ho
                    nguoi dung. CC thi di duoc nhung Microsoft ghi nhan la thinh
                    thoang khong dien vao. Nen ai can gui kem ho so nang luc hoac
                    can chac chan CC dung nguoi thi chep ban day du roi tu soan. */}
                {thu && thu.thieu.length === 0 && (
                  <Mini text={thu.chep} label="Copy the whole email" />
                )}
                {zalo && <a className="btn2" href={`https://zalo.me/${zalo}`} target="_blank" rel="noopener">Zalo</a>}
                {sel.phone && <a className="btn2" href={`tel:${sel.phone}`}>Call</a>}
                {!outlook && !zalo && !sel.phone && (
                  <span style={{ color: 'var(--faint)', fontSize: 12 }}>No contact details on file yet.</span>
                )}
                <button className="btn2" onClick={() => setEditing(true)}>Edit contact</button>
                <button className="btn dg"
                  onClick={() => {
                    if (!confirm(`Delete ${sel.full_name}?`)) return;
                    start(async () => {
                      await deleteContact(sel.id, brandId);
                      setSelId(contacts.find((c) => c.id !== sel.id)?.id ?? null);
                    });
                  }}>Delete contact</button>
              </div>

            </>
          )}

          <button className="addc" onClick={() => setAdding(true)}>
            + Add contact to this brand
          </button>

          <AddContactModal
            brand={adding ? { id: brandId, name: brandName } : null}
            onClose={() => setAdding(false)} />

          <EditContactModal
            brandId={brandId}
            contact={editing ? sel : null}
            isAdmin={isAdmin}
            onClose={() => setEditing(false)} />
        </div>
      </div>

      <div className="tile d-r">
        <div className="chead" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="ct">Org chart</div>
            <div className="cs">Grouped by seniority, highest first</div>
          </div>
          {contacts.some((c) => c.email) && (
            <button className="mini" onClick={() => setBulkIds(
              bulkIds.size > 0 ? new Set() : new Set(contacts.filter((c) => c.email).map((c) => c.id)),
            )}>
              {bulkIds.size > 0 ? 'Clear selection' : 'Select all'}
            </button>
          )}
          <CopyContactsButton rows={copyRows} />
        </div>

        {bulkIds.size > 0 && !bulkPanel && (
          <div className="mb-1 mt-2 flex items-center justify-between gap-3 rounded-lg border-l-[3px] border-teal-deep bg-surface-sunk px-3 py-2.5 text-[12px] leading-relaxed text-ink-dim">
            <span>
              <b className="text-ink">{bulkIds.size} selected</b> · {bulkReady.length} ready to email
              {bulkSkipped.length > 0 && <> · {bulkSkipped.length} skipped</>}
            </span>
            <div className="acts" style={{ margin: 0 }}>
              <button className="btn" disabled={bulkReady.length === 0}
                onClick={() => { setBulkIdx(0); setBulkPanel('individual'); }}>
                Personalized, one at a time
              </button>
              <button className="btn2" disabled={!thuNhom}
                onClick={() => setBulkPanel('group')}>
                One email, everyone in To
              </button>
            </div>
          </div>
        )}

        {bulkPanel === 'group' && (
          <div className="mb-1 mt-2 rounded-lg border-l-[3px] border-teal-deep bg-surface-sunk px-3 py-2.5 text-[12px] leading-relaxed text-ink-dim">
            <b className="text-ink">One email, {bulkGroup.length} address{bulkGroup.length === 1 ? '' : 'es'} in To.</b>{' '}
            Everyone on the list sees everyone else&apos;s address. Only use this for a template
            with no per-person fields — {'{{first_name}}'}, {'{{job_title}}'} and {'{{bio}}'} can&apos;t
            be correct for more than one person at once.

            {thuNhom && thuNhom.thieu.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <b className="text-ink">
                  Cannot draft this: {thuNhom.thieu.map((k) => `{{${k}}}`).join(', ')}{' '}
                  {thuNhom.thieu.length === 1 ? 'needs' : 'need'} one specific person, not a group.
                </b>{' '}
                Use &quot;Personalized, one at a time&quot; instead, or edit the template to drop that field.{' '}
                <Link href="/templates" className="font-semibold text-teal-deep hover:underline">
                  Edit template
                </Link>
              </div>
            )}

            {thuNhom && thuNhom.thieu.length === 0 && thuNhom.qua_dai && (
              <div style={{ marginTop: 8 }}>
                <b className="text-ink">Too long to open this way.</b>{' '}
                Shorten the template or send fewer people at once.
              </div>
            )}

            {thuNhom && thuNhom.thieu.length === 0 && !thuNhom.qua_dai && (
              <div className="acts" style={{ marginTop: 10 }}>
                <a className="btn" href={thuNhom.url} target="_blank" rel="noopener">
                  Open in Outlook
                </a>
                <Mini text={thuNhom.chep} label="Copy the whole email" />
              </div>
            )}

            <button className="btn2" style={{ marginTop: 10 }}
              onClick={() => { setBulkPanel(null); setBulkIds(new Set()); }}>
              Done
            </button>
          </div>
        )}

        {bulkPanel === 'individual' && (
          <div className="mb-1 mt-2 rounded-lg border-l-[3px] border-teal-deep bg-surface-sunk px-3 py-2.5 text-[12px] leading-relaxed text-ink-dim">
            <b className="text-ink">Bulk email — one personalized draft at a time.</b>{' '}
            Each person still gets their own draft (name, title and bio filled in for them).
            Open one, hit Send inside Outlook, then come back for the next.

            {bulkSkipped.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <b className="text-ink">Skipped ({bulkSkipped.length}):</b>
                <ul style={{ marginTop: 4, paddingLeft: 18 }}>
                  {bulkSkipped.map(({ contact, thu: t }) => (
                    <li key={contact.id}>
                      {contact.full_name} —{' '}
                      {!contact.email ? 'no email on file'
                        : t?.qua_dai ? 'template too long to open this way'
                        : t ? `missing ${t.thieu.map((k) => `{{${k}}}`).join(', ')}`
                        : 'no email on file'}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {bulkCurrent ? (
              <div style={{ marginTop: 10 }}>
                Draft {bulkIdxAn + 1} of {bulkReady.length}:{' '}
                <b className="text-ink">{bulkCurrent.contact.full_name}</b>{' '}
                ({bulkCurrent.contact.email})
                <div className="acts" style={{ marginTop: 8 }}>
                  <a className="btn" href={bulkCurrent.thu!.url} target="_blank" rel="noopener"
                    onClick={() => setBulkIdx((i) => i + 1)}>
                    Open in Outlook &amp; next
                  </a>
                  <button className="btn2" onClick={() => setBulkIdx((i) => i + 1)}>
                    Skip this one
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                {bulkReady.length === 0
                  ? 'Nobody in this batch has a draft ready to open.'
                  : `All ${bulkReady.length} draft${bulkReady.length === 1 ? '' : 's'} opened. Each one still needs Send pressed inside Outlook.`}
              </div>
            )}

            <button className="btn2" style={{ marginTop: 10 }}
              onClick={() => { setBulkPanel(null); setBulkIds(new Set()); setBulkIdx(0); }}>
              {bulkCurrent ? 'Cancel' : 'Done'}
            </button>
          </div>
        )}

        {contacts.length === 0 ? (
          <div className="empty">
            <b>No contacts</b>
            <div>Nothing on file for this brand.</div>
          </div>
        ) : (
          <>
            <div className="chart">
              {groups.map((g) => (
                <div className="tier" key={g.t.label}>
                  <div className="tierh">
                    <span className={`tierb ${g.t.cls}`}>{g.t.label}</span>
                    <span className="tierl">
                      {g.people.length}{g.people.length === 1 ? ' person' : ' people, same level'}
                    </span>
                  </div>
                  <div className="lvl">
                    {g.people.map((c) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={bulkIds.has(c.id)}
                          disabled={!c.email}
                          title={c.email ? 'Include in bulk email' : 'No email on file'}
                          onChange={() => toggleBulk(c.id)}
                          style={{ flexShrink: 0, cursor: c.email ? 'pointer' : 'not-allowed' }}
                        />
                        <button onClick={() => setSelId(c.id)} style={{ flex: 1 }}
                          className={`node${selId === c.id ? ' on' : ''}`}>
                          <span className="nav2">{initials(c.full_name)}</span>
                          <span className="nw">
                            <span className="nn">{c.full_name}</span>
                            <span className="nt">{c.job_title ?? 'Title unknown'}</span>
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="legend">
              Levels inferred from job titles, not confirmed by the brand.
            </div>
          </>
        )}
      </div>
    </>
  );
}
