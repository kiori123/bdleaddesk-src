// app/(app)/admin/UsagePanel.tsx
//
// Bang theo doi credit va chat luong contact, dat ngay duoi phan chia quota.
//
// Tat ca so lieu deu tu chay, khong ai phai nhap tay:
//   - So du credit  : goi thang SignalHire bang khoa da luu trong app_setting
//   - Da chi        : cong don nhung lan so du TUT giua cac moc credit_snapshot.
//                     Lan nao tang thi la nap them, khong tinh.
//   - Theo nganh    : By credit va Free cong lai bang tong; Bulk la cot chong
//                     lan, chi de biet bao nhieu dong vao theo me import
//   - Luot hut      : so credit tieu ra ma khong thu ve duoc contact nao
//
// Moi thu tinh tu quota_config.measure_since tro di. Truoc moc do la giai doan
// chay khoa free lan du lieu import tay, tron so, do vao khong co nghia.
//
// Moc duoc ghi ngay trong lan render nay, toi da moi tieng mot lan. Trang admin
// la trang dong (doc cookie) nen khong bi Next cache, moi lan mo la moi that.

import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isAppGenerated, isByCredit, ORIGIN_LABEL } from '@/lib/contactOrigin';
import { MIN_CONTACT_XEP_HANG } from '@/lib/creditSheet';

export const dynamic = 'force-dynamic';

const SNAPSHOT_EVERY_MS = 60 * 60 * 1000; // 1 tieng

type Balance = { left: number | null; unlimited: boolean; error: string | null };

/** Hoi SignalHire con bao nhieu credit. Loi thi tra ve error, khong nem ra ngoai. */
async function readBalance(apiKey: string | null): Promise<Balance> {
  if (!apiKey) return { left: null, unlimited: false, error: 'No SignalHire key saved in Settings yet.' };

  try {
    const res = await fetch('https://www.signalhire.com/api/v1/credits', {
      headers: { apikey: apiKey },
      cache: 'no-store',
    });

    // Moi phan hoi cua SignalHire deu kem header nay, dung lam nguon du phong.
    const header = res.headers.get('x-credits-left');

    if (!res.ok) {
      return {
        left: header != null ? Number(header) : null,
        unlimited: false,
        error: `SignalHire returned ${res.status}`,
      };
    }

    const body: any = await res.json().catch(() => ({}));
    const raw = body?.credits ?? body?.creditsLeft ?? body?.balance ?? header;
    const n = Number(raw);

    // Goi Unlimited khong tra ve so huu han. Coi nhu khong gioi han thay vi hien so la.
    if (raw == null || !Number.isFinite(n) || n < 0 || n > 1e8) {
      return { left: null, unlimited: true, error: null };
    }
    return { left: n, unlimited: false, error: null };
  } catch (e: any) {
    return { left: null, unlimited: false, error: `Could not reach SignalHire: ${e?.message ?? 'network error'}` };
  }
}

function pct(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'warn' }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className={`mt-1 font-display text-[26px] leading-none ${tone === 'warn' ? 'text-red-deep' : 'text-teal-deep'}`}>
        {value}
      </div>
      {hint && <div className="mt-1.5 text-[11.5px] leading-snug text-ink-dim">{hint}</div>}
    </div>
  );
}

export default async function UsagePanel() {
  const db = await supabaseServer();
  const admin = supabaseAdmin();

  const [{ data: keyRow }, { data: rows }, { data: snaps }, { data: cfg }] = await Promise.all([
    // app_setting bat RLS ma khong co policy nao, nen session nguoi dung doc ra
    // rong. Khoa API von la bi mat, doc bang service role moi dung: no khong bao
    // gio roi xuong trinh duyet, chi dung de goi SignalHire ngay tai day.
    admin.from('app_setting').select('value').eq('key', 'signalhire_api_key').maybeSingle(),
    // RLS cho admin thay het, nen doc thang qua session nguoi dung.
    db.from('contact').select('id, email, phone, source, import_batch, created_at, brand:brand_id (category:category_id (name))'),
    db.from('credit_snapshot').select('taken_at, credits_left, unlimited, contacts_total').order('taken_at', { ascending: false }).limit(60),
    db.from('quota_config').select('measure_since').maybeSingle(),
  ]);

  // Moc bat dau do. Truoc moc nay la giai doan chay key free va co ca du lieu
  // import tay, tron so, nen khong tinh vao Spent / Wasted nua.
  const measureSince = (cfg as any)?.measure_since ? new Date((cfg as any).measure_since) : null;
  const afterBaseline = (iso: string | null | undefined) =>
    !measureSince || (iso != null && new Date(iso) >= measureSince);

  const balance = await readBalance((keyRow as any)?.value ?? null);
  const contacts = (rows ?? []) as any[];

  const full = contacts.filter((c) => c.email && c.phone);

  // HAI TRUC DOC LAP, dung gop lam mot:
  //   source       -> co ton credit khong. Day la truc tien.
  //   import_batch -> vao DB kieu gi. Day la truc thao tac.
  // Mot contact tim bang app van co the vao theo me import, hai chuyen do khong
  // loai tru nhau. Truoc day gop chung nen 11 dong FMCG bi xep nham la "add tay"
  // trong khi thuc te chung tim bang app va co ton credit.
  // isByCredit nam o lib/contactOrigin.ts, dung CHUNG voi sheet "Credit &
  // Contacts" cua export. Truoc day no la lambda ngay tai day; mot ban thu hai
  // se lech ma khong co gi bao.
  const byCredit = (c: any) => isByCredit(c.source);
  const isFree = (c: any) => !byCredit(c);

  const nByCredit = contacts.filter(byCredit).length;
  const nFree = contacts.filter(isFree).length;
  // Full rate (paid), tren TOAN BO - khop voi tong "Full rate (paid)" cua
  // sheet Credit & Contacts trong export. Xem ghi chu o byCat ben duoi.
  const nPaidFull = contacts.filter((c) => byCredit(c) && c.email && c.phone).length;
  // Cot chong lan, chi de tham khao: bao nhieu trong so tren vao theo me import.
  const nBulk = contacts.filter((c) => c.import_batch != null).length;

  // TRUC THU BA, cung doc lap voi hai truc tren: contact nay do AI/CAI GI tao
  // ra - app (isAppGenerated, dinh nghia duy nhat o lib/contactOrigin.ts) hay
  // nguoi tu them tay. Khac isByCredit/isFree o cho seed_verified duoc tinh
  // la app-generated du khong ton credit. Hai cot nay CONG DUNG BANG total,
  // khong chong lan nhu Bulk - moi contact ro rang la mot trong hai.
  const nAppGenerated = contacts.filter((c) => isAppGenerated(c.source)).length;
  const nManual = contacts.length - nAppGenerated;

  // ---- ghi moc, toi da moi tieng mot lan -----------------------------------
  const latest = (snaps ?? [])[0] as any;
  const stale = !latest || Date.now() - new Date(latest.taken_at).getTime() > SNAPSHOT_EVERY_MS;
  if (stale && (balance.left != null || balance.unlimited)) {
    await admin.from('credit_snapshot').insert({
      credits_left: balance.left,
      unlimited: balance.unlimited,
      contacts_total: nByCredit,
    });
  }

  // ---- da chi trong khoang co moc -----------------------------------------
  //
  // KHONG lay moc dau tru moc cuoi. Cong thuc do gia dinh so du chi di xuong,
  // nen chi can nap them credit hoac doi API key la ra so am. Da dinh mot lan:
  // doi khoa free (con 7) sang khoa tra phi (2000) lam Spent thanh -1990.
  //
  // Cach dung: di tu moc cu nhat toi moi nhat, chi cong nhung lan TUT. Lan nao
  // so du tang thi coi la nap them, cong 0. Nap bao nhieu lan cung khong sai.
  const asc = ((snaps ?? [])
    .filter((s: any) => s.credits_left != null && afterBaseline(s.taken_at)) as any[])
    .slice().reverse();

  let spent: number | null = null;
  let since: string | null = null;
  let toppedUp = 0;

  if (asc.length) {
    let sum = 0;
    for (let i = 1; i < asc.length; i++) {
      const delta = asc[i - 1].credits_left - asc[i].credits_left;
      if (delta > 0) sum += delta;
      else if (delta < 0) toppedUp++;
    }
    if (balance.left != null) {
      const delta = asc[asc.length - 1].credits_left - balance.left;
      if (delta > 0) sum += delta;
      else if (delta < 0) toppedUp++;
    }
    spent = sum;
    since = new Date(asc[0].taken_at).toLocaleDateString('vi-VN');
  }

  // Contact ton credit thu ve KE TU MOC, dem thang tu bang contact chu khong
  // lay hieu hai moc. Dem truc tiep thi khong bi lech khi co ai xoa contact.
  const gained = contacts.filter((c) => byCredit(c) && afterBaseline(c.created_at)).length;
  const wasted = spent != null && spent > 0 ? Math.max(0, spent - gained) : null;

  // ---- gom theo nganh ------------------------------------------------------
  const byCat = new Map<string, {
    total: number; paid: number; free: number; bulk: number;
    appGenerated: number; manual: number;
    full: number; email: number; phone: number; none: number;
    // Full rate tinh RIENG tren contact by-credit - PHAI khop voi "Full rate
    // (paid)" cua sheet Credit & Contacts trong export (lib/creditSheet.ts).
    // "Complete" o bang duoi tinh tren MOI contact (ca free), nen mot category
    // co nhieu contact go tay se cho hai con so khac nhau cho hai cau hoi khac
    // nhau - da tung xay ra that: Mom & Baby doc 41% o cot Complete (42 contact
    // free ganh) trong khi Full rate (paid) chi 29% (that su tu 3 credit no
    // mua). Hien ca hai o day de khong ai phai doi chieu voi file Excel moi
    // thay hai so lech nhau.
    paidFull: number;
  }>();
  for (const c of contacts) {
    const name = c?.brand?.category?.name ?? '(no category)';
    const g = byCat.get(name) ?? {
      total: 0, paid: 0, free: 0, bulk: 0, appGenerated: 0, manual: 0,
      full: 0, email: 0, phone: 0, none: 0, paidFull: 0,
    };
    g.total++;
    const paid = byCredit(c);
    if (paid) g.paid++;
    else g.free++;
    if (c.import_batch != null) g.bulk++;   // cot chong lan, khong cong vao total
    if (isAppGenerated(c.source)) g.appGenerated++;
    else g.manual++;
    if (c.email && c.phone) {
      g.full++;
      if (paid) g.paidFull++;
    }
    else if (c.email) g.email++;
    else if (c.phone) g.phone++;
    else g.none++;
    byCat.set(name, g);
  }
  const cats = [...byCat.entries()].sort((a, b) => b[1].total - a[1].total);

  return (
    <section>
      <h2 className="font-display text-base uppercase text-teal-deep">Credit spend and contact quality</h2>
      <p className="mt-1 text-xs text-ink-faint">
        Live from SignalHire and the contact table. Nothing on this screen is typed in by hand.
      </p>

      {balance.error && (
        <p className="mt-3 rounded-lg border border-red-deep/30 bg-white px-4 py-3 text-sm text-red-deep">
          {balance.error}
        </p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Credits left"
          value={balance.unlimited ? 'Unlimited' : balance.left != null ? String(balance.left) : '--'}
          hint={balance.unlimited ? 'Unlimited plan, SignalHire reports no balance' : 'Read live from SignalHire'}
        />
        <Tile
          label="Spent"
          value={spent != null ? String(spent) : '--'}
          hint={
            since
              ? `Since ${since}${toppedUp ? `, ${toppedUp} top-up${toppedUp > 1 ? 's' : ''} skipped` : ''}`
              : 'Needs a second reading before this can be worked out'
          }
        />
        <Tile
          label="Gained since baseline"
          value={String(gained)}
          hint={
            `Contacts that cost credits since the baseline. ` +
            `All time: ${nByCredit} by credit, ${nFree} free.`
          }
        />
        <Tile
          label="Wasted"
          value={wasted != null ? String(wasted) : '--'}
          tone={wasted != null && wasted > 0 ? 'warn' : undefined}
          hint={
            wasted != null && spent
              ? `${pct(wasted, spent)}% of credits spent brought back nobody`
              : 'Credits spent that brought back nobody'
          }
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2.5 font-semibold">Category</th>
              <th className="px-3 py-2.5 text-right font-semibold">Leads</th>
              <th className="px-3 py-2.5 text-right font-semibold" title="Who or what created the row. Always adds up to Leads.">
                {ORIGIN_LABEL.app}
              </th>
              <th className="px-3 py-2.5 text-right font-semibold" title="Who or what created the row. Always adds up to Leads.">
                {ORIGIN_LABEL.manual}
              </th>
              <th className="px-3 py-2.5 text-right font-semibold">By credit</th>
              <th className="px-3 py-2.5 text-right font-semibold">Free</th>
              <th className="px-3 py-2.5 text-right font-semibold" title="Overlaps the columns on the left. Not part of the total.">
                Bulk<span className="text-ink-faint">*</span>
              </th>
              <th className="px-3 py-2.5 text-right font-semibold">Both</th>
              <th className="px-3 py-2.5 text-right font-semibold">Email only</th>
              <th className="px-3 py-2.5 text-right font-semibold">Phone only</th>
              <th className="px-3 py-2.5 text-right font-semibold">Neither</th>
              <th className="px-4 py-2.5 text-right font-semibold" title="Both email and phone, over EVERY contact including free/hand-added ones. About list usability, not credit spend.">
                Complete
              </th>
              <th className="px-4 py-2.5 text-right font-semibold" title="Both email and phone, over only contacts that cost a credit. Matches Full rate (paid) on the Credit & Contacts export sheet.">
                Full rate (paid)
              </th>
            </tr>
          </thead>
          <tbody>
            {cats.map(([name, g]) => {
              const rate = pct(g.full, g.total);
              // Duoi nguong nay ti le nhay rat manh (China Project: 1/1 = 100%)
              // - khop CHINH XAC voi MIN_CONTACT_XEP_HANG cua export, de hai
              // ben khong bao gio mo rong khac nhau.
              const duMau = g.paid >= MIN_CONTACT_XEP_HANG;
              const paidRate = g.paid > 0 ? pct(g.paidFull, g.paid) : null;
              return (
                <tr key={name} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-semibold">{name}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{g.total}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{g.appGenerated}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{g.manual}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-teal-deep">{g.paid}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-dim">{g.free}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-faint">{g.bulk || ''}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{g.full}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-dim">{g.email}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-ink-dim">{g.phone}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${g.none ? 'text-red-deep' : 'text-ink-dim'}`}>
                    {g.none}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-sunk">
                        <div className="h-full bg-grad-teal" style={{ width: `${rate}%` }} />
                      </div>
                      <span className="tabular-nums text-xs">{rate}%</span>
                    </div>
                  </td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${duMau ? '' : 'italic text-ink-faint'}`}>
                    {paidRate != null ? `${paidRate}%` : '--'}
                  </td>
                </tr>
              );
            })}
            {cats.length > 0 && (
              <tr className="bg-surface-sunk/50 font-semibold">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{contacts.length}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{nAppGenerated}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{nManual}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-teal-deep">{nByCredit}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{nFree}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-ink-faint">{nBulk || ''}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{full.length}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {contacts.filter((c) => c.email && !c.phone).length}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {contacts.filter((c) => !c.email && c.phone).length}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {contacts.filter((c) => !c.email && !c.phone).length}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{pct(full.length, contacts.length)}%</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {nByCredit > 0 ? `${pct(nPaidFull, nByCredit)}%` : '--'}
                </td>
              </tr>
            )}
            {cats.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-6 text-center text-sm text-ink-dim">
                  No contacts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <details className="mt-3 rounded-xl border border-line bg-white px-4 py-3">
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          How these numbers are worked out
        </summary>
        <dl className="mt-3 space-y-3 text-[12.5px] leading-relaxed text-ink-dim">
          <div>
            <dt className="font-semibold text-ink">Credits left</dt>
            <dd>
              Asked of SignalHire every time this page loads. It is never stored or typed in, so it
              is whatever SignalHire says right now. On an Unlimited plan SignalHire reports no
              number, so this reads <b>Unlimited</b> and the Spent tile carries on working on its own.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Spent</dt>
            <dd>
              SignalHire only ever tells us today&rsquo;s balance, never a history. So this page
              writes the balance down for itself, at most once an hour. <b>Spent</b> adds up only the
              readings where the balance <i>fell</i>. A reading where it rose means the account was
              topped up or the API key was swapped, and that one adds nothing &mdash; so buying more
              credits can never drag this figure below zero. It counts from the date shown and cannot
              be back-dated.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">{ORIGIN_LABEL.app}, {ORIGIN_LABEL.manual}</dt>
            <dd>
              <i>Who or what created the row.</i> They never overlap and always add up to
              <b> Leads</b>. <b>{ORIGIN_LABEL.app}</b> covers SignalHire results, the pre-verified
              seed list, and pasted LinkedIn links &mdash; all three came back through the app, whether
              or not a credit was spent. <b>{ORIGIN_LABEL.manual}</b> is a contact someone typed in by
              hand on a brand page.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">By credit, Free, Bulk</dt>
            <dd>
              Different questions again, so do not read these as the same split as above.
              <br />
              <b>By credit</b> and <b>Free</b> answer <i>did this cost money</i>. They never overlap
              and always add up to <b>Leads</b>. By credit means the person was found through
              SignalHire, whether the app pulled them in or someone looked them up and typed the
              result in afterwards &mdash; either way a credit was spent. Free is the list that was
              verified by hand before this app existed.
              <br />
              <b>Bulk*</b> answers a third question: <i>how did the row get into the database</i>.
              It counts rows that arrived in one import rather than one at a time. A bulk row is
              usually also a By credit row and a {ORIGIN_LABEL.app} row, so this column <b>overlaps
              the other columns and is not part of the total</b>. It is here so a big import cannot
              quietly look like day-to-day work.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Wasted</dt>
            <dd>
              Credits spent, minus contacts gained over the same stretch. A reveal is charged the
              moment it is ticked; if the person comes back without both an email and a phone they
              are dropped, and the credit is gone anyway. Pasting a LinkedIn link is the easiest way
              to land here, because it is charged straight away without being searched first.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Complete</dt>
            <dd>
              Contacts holding both an email and a phone, over every contact in that category. It is
              about how usable the list is, not about what was paid, so hand-added contacts count too.
              Deleting a contact later lowers this without giving the credit back.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Full rate (paid)</dt>
            <dd>
              The same both-email-and-phone question as <b>Complete</b>, but the denominator is only
              contacts that cost a credit &mdash; free and hand-added ones are left out of both sides.
              This is the number that says whether the money spent on SignalHire is paying off, and it
              is the same figure as &ldquo;Full rate (paid)&rdquo; on the Credit &amp; Contacts sheet of
              the Excel export. Read it separately from <b>Complete</b>: a category with a lot of
              hand-added contacts (Mom &amp; Baby, for one) can show a much higher Complete than Full
              rate (paid) &mdash; that gap is real, not a bug, and it means the free contacts are
              carrying the list. Shown dimmed and in italics under {MIN_CONTACT_XEP_HANG} paid contacts,
              same threshold as the export: below that a single reveal can swing the rate by 50 points.
              Shown as <b>--</b> only when the category has no paid contacts at all.
            </dd>
          </div>
        </dl>
      </details>

    </section>
  );
}
