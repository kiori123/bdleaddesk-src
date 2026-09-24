'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { strengthOf } from '@/lib/rank';
import { MAX_BRAND_MOI_LAN } from '@/lib/scanLimits';
import { pollJob, type Cand, type JobView, type BrandStat } from './actions';

/**
 * Hai viec, khong hon:
 *   1. Doi job chay xong, va noi that neu no khong xong.
 *   2. Cho chon nguoi roi bam lay contact. Day la cho DUY NHAT ton credit trong
 *      ca luong tim kiem, nen so credit phai nam ngay tren nut, khong giau trong
 *      man xac nhan.
 */

const HOI_LAI_MOI = 3000;      // 3s: mot lan quet thuong xong trong 20-60s
const NGHI_HONG_SAU = 120_000; // 2 phut khong thay gi thi doi giong

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

/**
 * "28 of 1020 shown" - de PIC phan biet ba tinh huong khac han nhau: khong
 * co trong SignalHire, cong ty nho da lay het, hay cong ty lon bi loc o
 * nguon. Khong noi ra thi mot danh sach ngan trong ba ly do do trong giong
 * y het nhau, va PIC de nham "khong co trong SignalHire" thanh "brand nay
 * khong ai lam viec quyet dinh o day".
 */
function ThongKe({ s }: { s: BrandStat | undefined }) {
  if (!s) return null;
  if (s.outcome === 'not_found') {
    return (
      <span className="text-[11.5px] text-ink-faint">
        Not found in SignalHire &mdash; check whether this brand trades under a different legal entity.
      </span>
    );
  }
  if (s.outcome === 'error') {
    return <span className="text-[11.5px] text-ink-faint">Could not reach SignalHire for this company.</span>;
  }
  // Da loc THAT hay chua loc duoc la hai chuyen khac han nhau, va truoc day
  // ca hai deu hien ra dung mot cau. Khi lan goi thu hep that bai (vi du
  // SignalHire tra 422), danh sach dang hien la 100 nguoi DAU TIEN cua chi muc
  // toan cau - khong theo vung, khong theo cap bac. Noi "narrowed at the
  // source" cho mot danh sach nhu vay lam PIC tin day la nguoi trong vung ho
  // chon, roi ngoi doc mot danh sach nguoi o My va Chau Au.
  if (s.outcome === 'narrowed' && s.filterSkipped) {
    return (
      <span className="text-[11.5px] text-red">
        {s.found} people shown but <b>not filtered</b>
        {s.total != null ? ` (this company has ${s.total})` : ''} &mdash; the region and
        seniority filter did not run, so these are the first people in the index anywhere in
        the world, not just where you asked. Search this brand again; if it keeps happening,
        tell an admin.
      </span>
    );
  }
  if (s.outcome === 'narrowed' && s.total != null) {
    return (
      <span className="text-[11.5px] text-ink-faint">
        {s.found} of {s.total} shown, narrowed at the source because the company is large.
      </span>
    );
  }
  return (
    <span className="text-[11.5px] text-ink-faint">
      {s.found} shown, everyone in SignalHire&rsquo;s index for this company.
    </span>
  );
}

function Chip({ s }: { s: number }) {
  const k = strengthOf(s);
  const style =
    k === 'strong' ? 'border-teal-deep text-teal-deep'
      : k === 'fair' ? 'border-line text-ink-dim'
        : 'border-line text-ink-faint';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${style}`}>
      {k === 'strong' ? 'Strong match' : k === 'fair' ? 'Worth a look' : 'Long shot'}
    </span>
  );
}

/**
 * Ba dai bao o duoi deu phai hien o MOI trang thai ket thuc, ke ca trang thai
 * khong ai ve. Im lang thi mot lan quet nam brand tra ve nguoi cua mot brand,
 * PIC dem thieu roi tuong app nuot mat bon brand kia.
 */

/**
 * Alias dan vao ngo cut nen app da tu tim lai bang ten brand.
 *
 * Bat buoc phai noi ra. Neu im lang thi PIC thay ket qua tot va tuong alias
 * dang dung, roi lan sau brand ho hang cua no lai ra rong y het the.
 */
function DaDoiTen({ ds }: { ds: { brand: string; from: string; to: string }[] }) {
  if (!ds.length) return null;
  return (
    <div className="mb-5 rounded-lg border-l-[3px] border-red-deep bg-surface-sunk px-4 py-3 text-[12.5px] leading-relaxed text-ink-dim">
      <b className="text-ink">Had to search a different name.</b>
      {ds.map((d) => (
        <div key={d.brand} className="mt-1">
          <b>{d.brand}</b> is mapped to <b>{d.from}</b>, which returned nobody, so the search
          used <b className="text-teal-deep">{d.to}</b> instead and that worked. The working name
          is now saved, so the next scan starts there. Tell Khoa if the mapping looks wrong.
        </div>
      ))}
    </div>
  );
}

/**
 * Brand vuot tran moi lan quet nen chua chay lan nao.
 *
 * Con so trong cau doc tu MAX_BRAND_MOI_LAN (lib/scanLimits.ts - file khong
 * keo theo lib/supabase/admin.ts, an toan de import vao client component nay),
 * KHONG viet chet trong JSX: truoc day copy ghi tay "8 brand" tach roi voi
 * hang so that su scan/route.ts dung, giam tran ma quen sua chu la man hinh
 * noi sai so.
 */
function ChuaChay({ ten }: { ten: string[] }) {
  if (!ten.length) return null;
  return (
    <div className="mb-5 rounded-lg border-l-[3px] border-red-deep bg-surface-sunk px-4 py-3 text-[12.5px] leading-relaxed text-ink-dim">
      <b className="text-ink">{ten.length} brand{ten.length === 1 ? '' : 's'} were not searched at all.</b>{' '}
      One scan handles {MAX_BRAND_MOI_LAN} brands so it finishes before the page times out. These are still
      waiting: {ten.join(', ')}. Copy them into a new scan.
    </div>
  );
}

function BoQua({ ten }: { ten: string[] }) {
  if (!ten.length) return null;
  return (
    <div className="mb-5 rounded-lg border-l-[3px] border-teal-deep bg-surface-sunk px-4 py-3 text-[12.5px] leading-relaxed text-ink-dim">
      <b className="text-ink">Left out, already on file: </b>
      {ten.join(', ')}.{' '}
      Open the brand to see who is there. To search {ten.length === 1 ? 'it' : 'them'} again,
      untick <b>Skip brands already on file</b> and run the scan once more.
    </div>
  );
}

/**
 * Ba trang thai ngan (dang cho, hong, khong ai ve) chi la mot hop nho. De mac
 * dinh chung dinh sat dinh trang va bo trong ca man hinh phia duoi. Hop nay
 * an het chieu cao con lai roi dat hop do vao giua.
 */
function Giua({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 'calc(100dvh - 220px)',
    }}>
      <div style={{ width: '100%', maxWidth: 560 }}>{children}</div>
    </div>
  );
}

export default function Results({
  jobId, categoryId, initial, showChip,
}: { jobId: string; categoryId: string | null; initial: JobView; showChip: boolean }) {
  const [view, setView] = useState<JobView>(initial);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [dangLamMoi, setDangLamMoi] = useState(false);
  // Dang lam brand thu may tren tong so. Mot lan bam co the goi /api/reveal
  // nhieu lan lien tiep, moi lan vai giay; khong dem ra thi PIC ngoi nhin mot
  // nut xam va khong biet no con chay hay da chet.
  const [buoc, setBuoc] = useState<{ i: number; n: number; ten: string } | null>(null);

  /**
   * Lam moi bang tay.
   *
   * Vong hoi lai tu dong DUNG han khi job xong. Do la dieu dung, khong the hoi
   * mai mai. Nhung nguoi khac trong team van reveal tiep tren cung ket qua, hoac
   * chinh minh vua reveal xong o tab khac, luc do man nay dang cu ma khong co
   * cach nao lam moi ngoai bam F5 va mat het o da tick.
   *
   * Nut nay giu nguyen o da tick, chi lay lai du lieu.
   */
  async function lamMoi() {
    setDangLamMoi(true);
    try {
      const v = await pollJob(jobId).catch(() => null);
      if (v) setView(v);
    } finally {
      setDangLamMoi(false);
    }
  }

  const batDau = useMemo(() => new Date(initial.createdAt).getTime(), [initial.createdAt]);
  const dangCho = view.status === 'queued' || view.status === 'running';

  // Dong ho chay rieng voi vong hoi lai, de so giay van nhuc nhich ngay ca khi
  // mot lan hoi bi treo.
  useEffect(() => {
    if (!dangCho) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [dangCho]);

  const dungLai = useRef(false);
  useEffect(() => {
    if (!dangCho) return;
    dungLai.current = false;

    let t: ReturnType<typeof setTimeout>;
    const vong = async () => {
      if (dungLai.current) return;
      const v = await pollJob(jobId).catch(() => null);
      if (v) {
        setView(v);
        if (v.status !== 'queued' && v.status !== 'running') return;
      }
      t = setTimeout(vong, HOI_LAI_MOI);
    };
    t = setTimeout(vong, HOI_LAI_MOI);

    return () => { dungLai.current = true; clearTimeout(t); };
  }, [jobId, dangCho]);

  const statsByBrand = useMemo(
    () => new Map(view.brandStats.map((s) => [s.brand, s])),
    [view.brandStats],
  );

  // Gom theo brand vi /api/reveal nhan mot brand moi lan goi.
  const theoBrand = useMemo(() => {
    const m = new Map<string, Cand[]>();
    for (const c of view.candidates) {
      const k = c.brand_name;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return [...m.entries()];
  }, [view.candidates]);

  const chuaCo = view.candidates.filter((c) => !c.contact_id);
  const soChon = picked.size;

  function bat(uid: string) {
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(uid)) n.delete(uid); else n.add(uid);
      return n;
    });
  }

  async function layContact() {
    setErr(''); setDone(''); setBusy(true);
    try {
      // Mot lan goi cho moi brand. Neu brand thu hai hong thi brand thu nhat da
      // xong van giu nguyen: bao ro cai nao duoc cai nao khong, khong nuot loi.
      const loi: string[] = [];
      let ok = 0;

      const canLam = theoBrand.filter(([, list]) =>
        list.some((c) => picked.has(c.external_uid)));
      let i = 0;

      for (const [brandName, list] of canLam) {
        const uids = list.filter((c) => picked.has(c.external_uid)).map((c) => c.external_uid);
        if (!uids.length) continue;
        i += 1;
        setBuoc({ i, n: canLam.length, ten: brandName });

        const res = await fetch('/api/reveal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoryId,
            brandId: list[0].brand_id,
            brandName,
            uids,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (res.ok) ok += uids.length;
        else loi.push(`${brandName}: ${body.error ?? `error ${res.status}`}`);
      }

      if (ok) {
        setDone(`Asked for ${ok} ${ok === 1 ? 'contact' : 'contacts'}. They appear on the brand page once they come back.`);
        setPicked(new Set());
        // Lay lai ngay de nhung nguoi vua reveal chuyen sang "Already have it".
        // Khong lam thi o tick cua ho van mo, va PIC de bam tra tien lan hai.
        await pollJob(jobId).then((v) => { if (v) setView(v); }).catch(() => {});
      }
      if (loi.length) setErr(loi.join(' · '));
    } finally {
      setBusy(false);
      setBuoc(null);
    }
  }

  // ---------- dang cho ------------------------------------------------------
  if (dangCho && view.candidates.length === 0) {
    const troi = now - batDau;
    const lau = troi > NGHI_HONG_SAU;

    return (
      <Giua>
      <div className="rounded-xl border border-line bg-white p-6">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 animate-pulse rounded-full bg-teal-deep" />
          <b className="text-[15px]">{lau ? 'Still nothing back' : 'Searching'}</b>
          <span className="text-[13px] tabular-nums text-ink-faint">{fmt(troi)}</span>
        </div>

        <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-ink-dim">
          {lau ? (
            <>
              A scan normally comes back inside a minute. This one has not. Nothing has been
              charged, so you can safely start a new scan. If this keeps happening, tell Khoa,
              and check the bell at the top right for the reason.
            </>
          ) : (
            <>
              Leave this page open. Nothing is charged for looking. You will pick people here
              when the results arrive.
            </>
          )}
        </p>
      </div>
      </Giua>
    );
  }

  // ---------- hong ----------------------------------------------------------
  if (view.status === 'failed') {
    return (
      <Giua>
      <div className="rounded-xl border border-red-deep/30 bg-white p-6">
        <b className="text-[15px] text-red-deep">The scan failed</b>
        <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-ink-dim">
          {view.error || 'No reason was given.'} Nothing was charged.
        </p>
      </div>
      </Giua>
    );
  }

  // ---------- xong nhung khong co ai ---------------------------------------
  if (view.candidates.length === 0) {
    // Bo qua het thi /api/scan chan ngay tu form, khong tao job. Nhung mot lan
    // quet nam brand co the bo qua bon va brand con lai khong ra ai, luc do van
    // roi vao day va van phai ke ten bon brand kia.
    //
    // "Khong ai" o day co the la HAI ly do rat khac nhau (xem ThongKe): brand
    // khong co trong chi muc SignalHire (not_found - lan kham pha khong loc gi
    // ma van total 0), hoac brand co nguoi that nhung lan thu hep loc het
    // (narrowed voi found = 0, hiem khi xay ra vi SENIOR rat rong, nhung co
    // the). Noi ro tung truong hop thay vi mot cau chung chung cho ca hai.
    const khongThay = view.brandStats.filter((s) => s.outcome === 'not_found');
    const locHet = view.brandStats.filter((s) => s.outcome === 'narrowed' && s.found === 0);

    return (
      <Giua>
      <ChuaChay ten={view.notRun} />
      <BoQua ten={view.skipped} />
      <div className="rounded-xl border border-line bg-white p-6">
        <b className="text-[15px]">Nobody came back</b>
        {khongThay.length > 0 && (
          <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-ink-dim">
            <b className="text-ink">
              {khongThay.map((s) => s.brand).join(', ')}
            </b>{' '}
            {khongThay.length === 1 ? 'is' : 'are'} not in SignalHire&rsquo;s index at all, under
            the mapped company or the brand name itself. Check whether it trades under a
            different legal entity and search that name.
          </p>
        )}
        {locHet.length > 0 && (
          <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-ink-dim">
            <b className="text-ink">
              {locHet.map((s) => s.brand).join(', ')}
            </b>{' '}
            {locHet.length === 1 ? 'has' : 'have'} people in SignalHire, but the region, seniority
            and keywords narrowed the large result down to nobody. Try a wider region or fewer
            keywords. Function ticks are not part of this &mdash; they only reorder the list.
          </p>
        )}
        {khongThay.length === 0 && locHet.length === 0 && (
          <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-ink-dim">
            The search ran and matched no one. It tried the mapped company first and then the
            brand name itself, so a wrong mapping is not the reason this time. This cost no
            credits.
          </p>
        )}
      </div>
      </Giua>
    );
  }

  // ---------- co ket qua ----------------------------------------------------
  return (
    <>
      <DaDoiTen ds={view.fellBack} />
      <ChuaChay ten={view.notRun} />
      <BoQua ten={view.skipped} />

      {err && (
        <p className="mb-4 rounded-lg border border-red-deep/30 bg-white px-4 py-3 text-[13px] text-red-deep">{err}</p>
      )}
      {done && (
        <p className="mb-4 rounded-lg border border-teal-deep/40 bg-white px-4 py-3 text-[13px] text-teal-deep">{done}</p>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <p className="max-w-[62ch] flex-1 text-[13px] text-ink-dim">
          {view.candidates.length} found,{' '}
          {view.regionLabel
            ? <>people in <b className="text-ink">{view.regionLabel}</b> first, then most likely first</>
            : <>most likely first</>}. Everyone the search returned is here, including people who
          matched none of your preferences. Ticking costs nothing.
        </p>
        <button type="button" className="btn2" onClick={lamMoi} disabled={dangLamMoi || busy}>
          {dangLamMoi ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      {theoBrand.map(([brand, list]) => (
        <div key={brand} className="mb-7">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-line pb-1.5">
            <span className="font-display text-sm uppercase tracking-wide text-teal-deep">{brand}</span>
            <span className="text-[11px] font-semibold text-ink-faint">{list.length}</span>
            <ThongKe s={statsByBrand.get(brand)} />
          </div>

          <div className="grid gap-2">
            {list.map((c, i) => {
              const co = Boolean(c.contact_id);
              const tick = picked.has(c.external_uid);
              // Duong ke dat ngay TRUOC nguoi dau tien nam ngoai vung. actions.ts
              // da xep trong-vung len truoc, nen chi co dung mot cho chuyen nhom.
              // Khong an ai di: nguoi duoi duong nay van tick va lay contact binh
              // thuong, chi la PIC biet minh da di qua ranh gioi nao.
              const ranh = view.regionLabel !== null
                && c.inRegion === false
                && (i === 0 || list[i - 1].inRegion !== false);
              return (
                <Fragment key={c.id}>
                {ranh && (
                  <p className="mt-2 flex flex-wrap items-baseline gap-x-2 border-t border-line pt-3 text-[11.5px] text-ink-faint">
                    <span className="font-semibold uppercase tracking-wide text-ink-dim">
                      Outside {view.regionLabel}
                    </span>
                    <span>
                      {i === 0
                        ? `Nobody found for this brand works in ${view.regionLabel}. `
                        : `${list.length - i} of ${list.length} work somewhere else. `}
                      Still worth a look: a regional or head-office decision maker often sits
                      outside the market they cover.
                    </span>
                  </p>
                )}
                <div
                  className={`flex items-start gap-3 rounded-lg border bg-white p-3.5 transition ${
                    co ? 'border-line opacity-60'
                      : tick ? 'border-teal-deep' : 'border-line hover:border-teal-deep'
                  }`}
                >
                  {/* <label> boc CA hang thi bam vao link LinkedIn cung tick
                      luon o chon. Tach ra: label chi boc phan chu, link nam
                      ngoai. */}
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                  <input
                    type="checkbox" className="mt-1" style={{ accentColor: 'var(--tl)' }}
                    disabled={co || busy}
                    checked={tick}
                    onChange={() => bat(c.external_uid)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <b className="text-[14px]">{c.full_name}</b>
                      {/* Khong dat mo uoc nao thi diem chi con thang bac, goi
                          mot CEO la "Long shot" luc do la sai. An di. */}
                      {showChip && <Chip s={c.score} />}
                      {co && (
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                          Already have it
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-ink-dim">
                      {c.job_title || 'Job title not given'}
                      {c.company && <span className="text-ink-faint"> · {c.company}</span>}
                      {c.location && <span className="text-ink-faint"> · {c.location}</span>}
                    </span>
                    {c.score_reasons.length > 0 && (
                      <span className="mt-1 block text-[11.5px] text-ink-faint">
                        {c.score_reasons.join(' · ')}
                      </span>
                    )}
                  </span>
                  </label>

                  {/* Xem LinkedIn TRUOC khi quyet dinh tra tien, giong ban cu.
                      Buoc tim nguoi khong tra ve duong dan LinkedIn, chi reveal
                      moi co, ma reveal thi da mat credit roi. Nen day la duong
                      sang o tim cua LinkedIn, dien san ten va cong ty. */}
                  <a
                    className="mini shrink-0"
                    href={`https://www.linkedin.com/search/results/people/?keywords=${
                      encodeURIComponent(`${c.full_name} ${c.company || brand}`)}`}
                    target="_blank" rel="noopener"
                    title="Check who this is before you spend a credit"
                  >
                    LinkedIn
                  </a>
                </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      ))}

      <div className="sticky bottom-0 -mx-4 mt-6 flex flex-wrap items-center gap-4 border-t border-line bg-white px-4 py-4">
        <button
          onClick={layContact}
          disabled={busy || soChon === 0}
          className="rounded-lg bg-grad-red px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-40"
        >
          {busy ? 'Working' : `Get contacts · ${soChon} credit${soChon === 1 ? '' : 's'}`}
        </button>

        {busy ? (
          <span className="progrow" style={{ flex: 1, minWidth: 200 }}>
            <span className="prog" />
            <span className="progtxt">
              {buoc ? `${buoc.ten}, ${buoc.i} of ${buoc.n}` : 'Sending'}
            </span>
          </span>
        ) : (
          <span className="text-[12.5px] text-ink-dim">
            {soChon === 0
              ? `Tick the people you want. ${chuaCo.length} still without contact details.`
              : `1 credit each. Charged only if the lookup succeeds.`}
          </span>
        )}
      </div>
    </>
  );
}
