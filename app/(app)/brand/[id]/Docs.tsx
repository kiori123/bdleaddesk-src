'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

type Doc = { name: string; size: number; updated_at: string };
type Preview =
  | { kind: 'loading'; name: string }
  | { kind: 'image' | 'pdf'; name: string; url: string }
  | { kind: 'table'; name: string; rows: string[][]; total: number }
  | { kind: 'text'; name: string; body: string }
  | { kind: 'none'; name: string; msg: string };

const MAX = 25 * 1024 * 1024;
const IMG = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'];
const TXT = ['txt', 'md', 'json', 'log', 'xml', 'yml', 'yaml', 'html'];
const TAB = ['csv', 'tsv'];

function ext(n: string) { return (n.split('.').pop() || '').toLowerCase(); }

/** CSV co dau ngoac kep: dau phay trong ngoac khong phai dau ngat cot. */
function parseCsv(text: string, sep: string) {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; }
      } else { cell += c; }
    } else if (c === '"') { quoted = true; }
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') { cell += c; }
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

export default function Docs({ brandId, folderLink }: { brandId: string; folderLink?: string | null }) {
  const db = supabaseBrowser();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [prev, setPrev] = useState<Preview | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await db.storage.from('brand-docs').list(brandId, {
      limit: 100, sortBy: { column: 'updated_at', order: 'desc' },
    });
    if (error) { setMsg('Could not load the file list.'); return; }
    setDocs((data ?? []).filter((f: any) => f.id).map((f: any) => ({
      name: f.name, size: f.metadata?.size ?? 0, updated_at: f.updated_at,
    })));
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [brandId]);

  async function signed(name: string, secs = 300) {
    const { data, error } = await db.storage
      .from('brand-docs').createSignedUrl(`${brandId}/${name}`, secs);
    if (error || !data) return null;
    return data.signedUrl;
  }

  async function upload(file: File) {
    if (file.size > MAX) {
      setMsg(`That file is ${(file.size / 1048576).toFixed(1)} MB, over the 25 MB limit.`);
      return;
    }
    setBusy(true); setMsg('');
    const safe = file.name.replace(/[\\/\r\n]+/g, ' ').trim();
    const { error } = await db.storage
      .from('brand-docs').upload(`${brandId}/${safe}`, file, { upsert: true });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    load();
  }

  async function preview(d: Doc) {
    const e = ext(d.name);
    setPrev({ kind: 'loading', name: d.name });

    if (!IMG.includes(e) && e !== 'pdf' && !TXT.includes(e) && !TAB.includes(e)) {
      setPrev({ kind: 'none', name: d.name,
        msg: 'This file type cannot be previewed. Use Open to view it on your machine.' });
      return;
    }

    const url = await signed(d.name);
    if (!url) { setPrev({ kind: 'none', name: d.name, msg: 'Could not open this file.' }); return; }

    if (IMG.includes(e)) { setPrev({ kind: 'image', name: d.name, url }); return; }
    if (e === 'pdf')     { setPrev({ kind: 'pdf',   name: d.name, url }); return; }

    // File chu: tai noi dung ve roi dung, khong nhung iframe de tranh chay
    // script la trong file html nguoi khac tai len.
    try {
      const body = await (await fetch(url)).text();
      if (TAB.includes(e)) {
        const rows = parseCsv(body, e === 'tsv' ? '\t' : ',');
        if (!rows.length) { setPrev({ kind: 'none', name: d.name, msg: 'The file is empty.' }); return; }
        setPrev({ kind: 'table', name: d.name, rows: rows.slice(0, 301), total: rows.length - 1 });
      } else {
        setPrev({ kind: 'text', name: d.name, body: body.slice(0, 200000) });
      }
    } catch {
      setPrev({ kind: 'none', name: d.name, msg: 'Could not read the file contents.' });
    }
  }

  async function download(name: string) {
    const url = await signed(name, 60);
    if (!url) { setMsg('Could not open this file.'); return; }
    window.open(url, '_blank', 'noopener');
  }

  async function remove(name: string) {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    const { error } = await db.storage.from('brand-docs').remove([`${brandId}/${name}`]);
    if (error) { setMsg(error.message); return; }
    if (prev?.name === name) setPrev(null);
    load();
  }

  return (
    <div className="fsec">
      <div className="flab">
        Documents
        {folderLink && (
          <a className="fopen" href={folderLink} target="_blank" rel="noopener">Open folder</a>
        )}
      </div>

      <div className="flist">
        {docs.length === 0 && <div className="fmsg">No documents yet.</div>}
        {docs.map((d) => (
          <div className="fitem" key={d.name}>
            <span className="fico">{(ext(d.name) || 'file').toUpperCase()}</span>
            <span className="fnm">{d.name}</span>
            <button className="fbtn" onClick={() => preview(d)}>Preview</button>
            <button className="fbtn" onClick={() => download(d.name)}>Open</button>
            <button className="fbtn del" onClick={() => remove(d.name)}>Delete</button>
          </div>
        ))}
      </div>

      <div className="frow2">
        <label className="btn2 fadd">
          {busy ? 'Uploading' : 'Add file'}
          <input type="file" style={{ display: 'none' }} disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
        </label>
        <span className="fnote">
          {msg || 'Up to 25 MB. Everyone with access to this brand can open these.'}
        </span>
      </div>

      {prev && (
        <div className="fprev">
          <div className="fprevh">
            <span style={{ flex: 1, minWidth: 0 }}>{prev.name}</span>
            <button className="fbtn" onClick={() => setPrev(null)}>Close</button>
          </div>
          <div className="fpbox">
            {prev.kind === 'loading' && <div className="fpnone">Loading</div>}
            {prev.kind === 'none' && <div className="fpnone">{prev.msg}</div>}
            {prev.kind === 'image' && <img className="fpimg" src={prev.url} alt={prev.name} />}
            {prev.kind === 'pdf' && (
              <iframe src={prev.url} title={prev.name}
                style={{ width: '100%', height: 430, border: 'none', display: 'block' }} />
            )}
            {prev.kind === 'text' && <pre className="fptxt">{prev.body}</pre>}
            {prev.kind === 'table' && (
              <table className="fptab">
                <thead><tr>{prev.rows[0].map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                <tbody>
                  {prev.rows.slice(1).map((r, i) => (
                    <tr key={i}>{prev.rows[0].map((_, j) => <td key={j}>{r[j] ?? ''}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
