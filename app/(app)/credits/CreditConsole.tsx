'use client';

import { useState, useTransition } from 'react';
import { askCredits, decideRequest } from './actions';

type Meter = { tran: number; team_da_dung: number; team_con_lai: number; cua_toi: number };

type Quota = {
  ngay: string;
  ky_bat_dau: string | null;
  dang_khoa: boolean;
  mo_khoa_luc: string | null;
  khoa_vi: string | null;
  brand: Meter;
  profile: Meter;
  credit: { category: string; cap: number; da_dung: number; con_lai: number }[];
  cho_toi_duyet: number;
  toi_dang_cho: number;
};

type Peer = { id: string; full_name: string; role: string; categories: string[]; con_lai: number };

type Req = {
  id: string;
  huong: 'toi_gui' | 'toi_nhan';
  doi_phuong: string;
  category: string | null;
  brand_name: string | null;
  amount: number;
  reason: string | null;
  status: string;
  created_at: string;
  expires_at: string;
};

type Cat = { id: string; name: string };

function SearchMeter({ label, m }: { label: string; m: Meter }) {
  const p = m.tran > 0 ? Math.min(100, (m.team_da_dung / m.tran) * 100) : 0;
  const tight = p >= 80;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold">{label}</span>
        <span className={`text-xs tabular-nums ${tight ? 'text-red-deep' : 'text-ink-faint'}`}>
          {m.team_da_dung} / {m.tran}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunk">
        <div
          className={`h-full transition-all ${tight ? 'bg-grad-red' : 'bg-grad-teal'}`}
          style={{ width: `${p}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11.5px] tabular-nums text-ink-dim">
        {m.team_con_lai} left · you used {m.cua_toi}
      </p>
    </div>
  );
}

const LABEL: Record<string, string> = {
  pending: 'Waiting',
  approved: 'Approved',
  rejected: 'Declined',
  expired: 'Expired',
};

export default function CreditConsole({
  quota, peers, requests, categories,
}: { quota: Quota; peers: Peer[]; requests: Req[]; categories: Cat[] }) {
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const [form, setForm] = useState({
    to: 'admin',
    categoryId: categories[0]?.id ?? '',
    amount: '50',
    brandName: '',
    reason: '',
  });

  const inbox = requests.filter((r) => r.huong === 'toi_nhan' && r.status === 'pending');
  const sent = requests.filter((r) => r.huong === 'toi_gui');

  function send() {
    setMsg('');
    start(async () => {
      const res = await askCredits({
        categoryId: form.categoryId,
        toProfileId: form.to === 'admin' ? null : form.to,
        amount: Number(form.amount),
        brandName: form.brandName,
        reason: form.reason,
      });
      if (res?.error) setMsg(res.error);
      else setForm((f) => ({ ...f, brandName: '', reason: '' }));
    });
  }

  function decide(id: string, approve: boolean) {
    setMsg('');
    start(async () => {
      const res = await decideRequest(id, approve);
      if (res?.error) setMsg(res.error);
    });
  }

  return (
    <>
      <div className="phead">
        <h1 className="h1">Credits</h1>
        <span className="text-xs text-ink-faint">{quota.ngay}</span>
      </div>

      {msg && (
        <p className="mb-4 rounded-lg border border-line bg-surface-sunk px-3 py-2 text-[12px] leading-snug text-red-deep">
          {msg}
        </p>
      )}

      {/* Hai tran theo cua so 24 gio truot, dung chung ca team */}
      <div className="mb-6 rounded-xl border border-line bg-white p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="font-semibold">Search limits</span>
          <span className="text-[11px] uppercase tracking-wide text-ink-faint">
            SignalHire account, shared
          </span>
        </div>

        {quota.dang_khoa && quota.mo_khoa_luc && (
          <div className="mb-3 rounded-lg border border-red-deep/30 bg-surface-sunk px-3 py-2.5 text-[12.5px] leading-snug text-red-deep">
            <b>Searching is locked.</b> The team hit the{' '}
            {quota.khoa_vi === 'brand' ? 'brand' : 'profile'} limit, and SignalHire locks the
            whole account for 24 hours once either one is reached. It unlocks at{' '}
            <b>{new Date(quota.mo_khoa_luc).toLocaleString('vi-VN')}</b>. Revealing contacts you
            already found is not affected.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <SearchMeter label="Brands scanned" m={quota.brand} />
          <SearchMeter label="Profiles returned" m={quota.profile} />
        </div>

        <p className="mt-3 text-[11.5px] leading-snug text-ink-faint">
          Both caps are shared by the whole team, not split per person, and nothing resets at
          midnight. Reaching <b>either</b> one locks searching for everyone for 24 hours, so the
          bars are worth a glance before starting a big batch.
        </p>
      </div>

      {/* Credit theo category */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-dim">This month</h2>
      {quota.credit.length === 0 ? (
        <p className="note mb-6">
          You are not assigned to any category yet, so there is no budget to show.
          Ask an admin to assign you one.
        </p>
      ) : (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {quota.credit.map((c) => {
            const pct = c.cap > 0 ? Math.min(100, (c.da_dung / c.cap) * 100) : 0;
            const empty = c.con_lai <= 0;
            return (
              <div key={c.category} className="rounded-xl border border-line bg-white p-4">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{c.category}</span>
                  <span className={`text-xs ${empty ? 'text-red-deep' : 'text-ink-faint'}`}>
                    {c.cap === 0 ? 'no budget yet' : `${c.con_lai} left`}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunk">
                  <div
                    className={`h-full transition-all ${empty ? 'bg-grad-red' : 'bg-grad-teal'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-2 text-[11.5px] text-ink-dim">{c.da_dung} of {c.cap} used</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Request dang cho minh duyet */}
      {inbox.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-dim">
            Waiting for you ({inbox.length})
          </h2>
          <div className="mb-6 space-y-2">
            {inbox.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4">
                <div className="text-sm">
                  <p><b>{r.doi_phuong}</b> is asking for <b>{r.amount}</b> credits</p>
                  <p className="text-[11.5px] text-ink-dim">
                    {[r.category, r.brand_name, r.reason].filter(Boolean).join(' | ') || 'No reason given'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => decide(r.id, true)} disabled={pending}
                    className="h-9 rounded-lg bg-grad-teal px-3.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-40"
                  >Approve</button>
                  <button
                    onClick={() => decide(r.id, false)} disabled={pending}
                    className="h-9 rounded-lg border border-line px-3.5 text-xs font-semibold uppercase tracking-wide text-ink-dim transition hover:bg-surface-sunk disabled:opacity-40"
                  >Decline</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Xin them */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-dim">Request more credits</h2>
      <div className="mb-6 rounded-xl border border-line bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs">
            <span className="mb-1 block text-ink-dim">Ask</span>
            <select
              value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })}
              className="h-9 w-full rounded-lg border border-line bg-surface-sunk px-2.5 text-sm outline-none focus:border-teal-deep focus:bg-white"
            >
              <option value="admin">An admin</option>
              {peers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}{p.categories.length ? ` (${p.categories.join(', ')})` : ''} - {p.con_lai} left
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs">
            <span className="mb-1 block text-ink-dim">Add to category</span>
            <select
              value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="h-9 w-full rounded-lg border border-line bg-surface-sunk px-2.5 text-sm outline-none focus:border-teal-deep focus:bg-white"
            >
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>

          <label className="text-xs">
            <span className="mb-1 block text-ink-dim">How many</span>
            <input
              type="number" min={1} value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="h-9 w-full rounded-lg border border-line bg-surface-sunk px-2.5 text-sm outline-none focus:border-teal-deep focus:bg-white"
            />
          </label>

          <label className="text-xs">
            <span className="mb-1 block text-ink-dim">Brand (optional)</span>
            <input
              value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })}
              className="h-9 w-full rounded-lg border border-line bg-surface-sunk px-2.5 text-sm outline-none focus:border-teal-deep focus:bg-white"
            />
          </label>

          <label className="text-xs sm:col-span-2">
            <span className="mb-1 block text-ink-dim">Why</span>
            <input
              value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Three more brands to enrich for this week's pitch"
              className="h-9 w-full rounded-lg border border-line bg-surface-sunk px-2.5 text-sm outline-none focus:border-teal-deep focus:bg-white"
            />
          </label>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={send} disabled={pending || !form.categoryId}
            className="h-9 rounded-lg bg-grad-teal px-3.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-40"
          >{pending ? 'Sending' : 'Send request'}</button>
          <span className="text-[11.5px] leading-snug text-ink-faint">
            They get a bell notification. If they approve, the credits move out of their
            category and into yours.
          </span>
        </div>
      </div>

      {/* Da gui */}
      {sent.length > 0 && (
        <>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-dim">Your requests</h2>
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead className="text-left text-[11.5px] uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-4 py-2 font-semibold">Asked</th>
                  <th className="px-4 py-2 font-semibold">Category</th>
                  <th className="px-4 py-2 text-right font-semibold">Credits</th>
                  <th className="px-4 py-2 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {sent.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="px-4 py-2">{r.doi_phuong}</td>
                    <td className="px-4 py-2 text-ink-dim">{r.category ?? '-'}</td>
                    <td className="px-4 py-2 text-right">{r.amount}</td>
                    <td className={`px-4 py-2 text-right ${r.status === 'rejected' ? 'text-red-deep' : 'text-ink-dim'}`}>
                      {LABEL[r.status] ?? r.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
