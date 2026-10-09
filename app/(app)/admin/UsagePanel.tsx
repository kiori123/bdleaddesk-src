// app/(app)/admin/UsagePanel.tsx
//
// Bang theo doi credit va chat luong contact, dat ngay duoi phan chia quota.
//
// Tat ca so lieu deu tu chay, khong ai phai nhap tay:
//   - So du credit  : goi thang SignalHire bang khoa da luu trong app_setting
//   - Da chi        : cong `amount` cua cac dong credit_ledger da 'committed'.
//                     Day la so credit CHINH APP NAY da tieu - xem ghi chu dai
//                     o phan tinh `daChi` ben duoi ve vi sao KHONG lay hieu so
//                     du nua.
//   - Theo nganh    : By credit va Free cong lai bang tong; Bulk la cot chong
//                     lan, chi de biet bao nhieu dong vao theo me import
//   - Ve rong       : contact ton credit ma khong co email lan phone. SignalHire
//                     khong tinh tien nhung nen tang, nen van phai hien ra
//
// Moi thu tinh tu quota_config.measure_since tro di. Truoc moc do la giai doan
// chay khoa free lan du lieu import tay, tron so, do vao khong co nghia.
//
// Moc so du duoc ghi ngay trong lan render nay, toi da moi tieng mot lan.
// Trang admin la trang dong (doc cookie) nen khong bi Next cache, moi lan mo
// la moi that.

import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isAppGenerated, isByCredit, ORIGIN_LABEL } from '@/lib/contactOrigin';
import { demNguoi } from '@/lib/contactIdentity';
import { MIN_CONTACT_XEP_HANG } from '@/lib/creditSheet';
import { docTatCa } from '@/lib/pageAll';
import { checkApiKey } from '@/lib/signalhire';

export const dynamic = 'force-dynamic';

const SNAPSHOT_EVERY_MS = 60 * 60 * 1000; // 1 tieng

/**
 * Lech bao nhieu credit giua so du SignalHire va so sach cua app thi moi dang
 * keu len. Duoi nguong nay gan nhu chac chan la nhieu loan binh thuong: mot
 * reveal dang chay do, mot lan thu khoa, lam tron phia ho.
 */
const NGUONG_LECH = 25;

type Balance = { left: number | null; unlimited: boolean; error: string | null };

/**
 * Hoi SignalHire con bao nhieu credit. Loi thi tra ve error, khong nem ra ngoai.
 *
 * Di qua checkApiKey() (lib/signalhire.ts) thay vi tu fetch() nhu truoc - de
 * dung CHUNG hang doi 3-dong-thoi voi search/reveal. Truoc day trang admin mo
 * dung luc mot PIC dang scan la request thu 4 dong thoi that su toi tai
 * khoan, vuot gioi han cua SignalHire du ham nay tuong minh dang doc-only.
 */
async function readBalance(apiKey: string | null): Promise<Balance> {
  if (!apiKey) return { left: null, unlimited: false, error: 'No SignalHire key saved in Settings yet.' };

  const check = await checkApiKey(apiKey);
  if (!check.ok) return { left: null, unlimited: false, error: check.message };
  return { left: check.credits, unlimited: check.unlimited, error: null };
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

  const { data: cfg } = await db.from('quota_config').select('measure_since').maybeSingle();

  // Moc bat dau do. Truoc moc nay la giai doan chay key free va co ca du lieu
  // import tay, tron so, nen khong tinh vao Spent / Gained / Came back empty.
  const measureSince = (cfg as any)?.measure_since ? new Date((cfg as any).measure_since) : null;
  const mocISO = measureSince ? measureSince.toISOString() : null;
  const afterBaseline = (iso: string | null | undefined) =>
    !measureSince || (iso != null && new Date(iso) >= measureSince);

  const [{ data: keyRow }, contacts, snaps, ledger] = await Promise.all([
    // app_setting bat RLS ma khong co policy nao, nen session nguoi dung doc ra
    // rong. Khoa API von la bi mat, doc bang service role moi dung: no khong bao
    // gio roi xuong trinh duyet, chi dung de goi SignalHire ngay tai day.
    admin.from('app_setting').select('value').eq('key', 'signalhire_api_key').maybeSingle(),

    // RLS cho admin thay het, nen doc thang qua session nguoi dung.
    //
    // PHAI di qua docTatCa(): mot .select() tran bi PostgREST cat o 1000 dong
    // ma khong bao loi, va bang contact dang o 993 - xem ghi chu dau
    // lib/pageAll.ts. Truoc day cho nay doc mot phat, tuc chi con bay contact
    // nua la moi con so duoi day am tham thieu.
    // Sap theo `id` chu khong phai `created_at`: phan trang bang offset doi
    // thu tu toan phan, ma `created_at` co trung (993 dong / 941 gia tri khac
    // nhau) nen mot dong co the bi nhay qua o cho noi hai trang. O day thu tu
    // khong co y nghia gi - moi con so duoi deu la phep dem - nen lay thang
    // khoa chinh cho chac.
    docTatCa<any>((tu, den) => db
      .from('contact')
      .select('id, email, phone, source, import_batch, created_at, external_uid, linkedin_url, brand:brand_id (category:category_id (name))')
      .order('id', { ascending: true })
      .range(tu, den)),

    // Moc so du: lay HET tu measure_since tro di, khong cat o 60 dong nua.
    // Ban cu dung .limit(60) nen cua so truot dan theo thoi gian - co luc no
    // bat dau tu 18/09 trong khi measure_since la 08/09, tuc Spent va Gained
    // dem tren hai khoang khac nhau (157 contact nam trong khe ho do) roi van
    // bi dem tru nhau.
    docTatCa<any>((tu, den) => {
      // `id` lam khoa phu: thu tu theo thoi gian la CAN cho phep tru lien
      // tiep ben duoi, nhung sap theo mot cot co the trung thi phan trang
      // offset khong an toan. Them `id` cho no thanh thu tu toan phan.
      const q = db.from('credit_snapshot')
        .select('taken_at, credits_left, unlimited')
        .order('taken_at', { ascending: true })
        .order('id', { ascending: true })
        .range(tu, den);
      return mocISO ? q.gte('taken_at', mocISO) : q;
    }),

    // So sach CUA APP: moi lan reveal co tinh tien deu de lai mot dong o day
    // (reserved -> committed/released, xem lib/credit.ts va CLAUDE.md).
    docTatCa<any>((tu, den) => {
      // Chi dem tong nen thu tu khong quan trong - sap theo khoa chinh cho
      // phan trang an toan (xem ghi chu o doan doc contact ben tren).
      const q = db.from('credit_ledger')
        .select('amount, status, created_at')
        .order('id', { ascending: true })
        .range(tu, den);
      return mocISO ? q.gte('created_at', mocISO) : q;
    }),
  ]);

  const balance = await readBalance((keyRow as any)?.value ?? null);

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

  // TRUC THU TU: so DONG khac so CON NGUOI. Bang contact la (nguoi x brand),
  // nen mot nguoi phu trach nhieu brand chiem nhieu dong - dung va can giu
  // nguyen cho PIC, nhung "993 leads" doc ra nhu 993 con nguoi thi sai. Xem
  // lib/contactIdentity.ts. Tren du lieu that: 993 dong = 979 nguoi, 13 trong
  // 14 cap trung la mot nguoi o cong ty me va o brand con cua no (Tan Phu
  // Plastic/Inochi, Xuong Giang Paper/Posy, Fani/TopGia, Sunlight/Vim...).
  const nNguoi = demNguoi(contacts);
  const trungNguoi = contacts.length - nNguoi;

  // ---- ghi moc so du, toi da moi tieng mot lan -----------------------------
  // Moc nay gio chi dung de DOI CHIEU (xem `lechSo` ben duoi), khong con la
  // nguon tinh Spent nua - nen mot lan ghi trung do hai tab mo cung luc khong
  // lam sai con so nao.
  const latest = snaps[snaps.length - 1];
  const stale = !latest || Date.now() - new Date(latest.taken_at).getTime() > SNAPSHOT_EVERY_MS;
  if (stale && (balance.left != null || balance.unlimited)) {
    await admin.from('credit_snapshot').insert({
      credits_left: balance.left,
      unlimited: balance.unlimited,
      contacts_total: nByCredit,
    });
  }

  // ---- da chi: lay tu SO SACH CUA APP, khong lay hieu so du ----------------
  //
  // Ban cu cong don nhung lan so du SignalHire TUT giua hai moc. Cach do sai
  // mot cach khong sua duoc, vi so du la cua CA TAI KHOAN chu khong rieng app
  // nay: credit het han, doi goi, hay ai do reveal thang tren web SignalHire
  // deu lam no tut y het mot lan app tieu tien.
  //
  // Da dinh that: 01/10/2026 so du roi 1458 -> 5 trong 7 tieng ruoi, trong khi
  // credit_ledger KHONG co mot dong nao va bang job KHONG co mot reveal nao
  // trong dung khoang do. Tile Spent khi ay doc 1904 trong khi ca doi app moi
  // chot 504 credit. Wasted an theo thanh 977 (51%).
  //
  // credit_ledger thi nguoc lai: moi dong la mot lan CHINH APP NAY tieu tien,
  // co job_id, co category, co nguoi bam. Do la thu duy nhat app chiu trach
  // nhiem va cung la thu duy nhat no bao cao duoc.
  const daChot = ledger.filter((l: any) => l.status === 'committed');
  const daChi = daChot.reduce((s: number, l: any) => s + (l.amount ?? 0), 0);
  const soLanChot = daChot.length;
  // Dong ket o 'reserved': credit da giu cho ma khong bao gio chot hay tra lai
  // (job chet giua chung). No van tru vao han muc category nen phai hien ra.
  const treoGiuCho = ledger
    .filter((l: any) => l.status === 'reserved')
    .reduce((s: number, l: any) => s + (l.amount ?? 0), 0);

  // ---- thu ve duoc gi, trong CUNG khoang voi daChi ------------------------
  //
  // SignalHire chi tinh tien ket qua CO email hoac phone; nguoi ve tay khong
  // thi app tra credit lai (`billable` trong app/api/reveal/route.ts). Nen
  // phai dem rieng hai nhom, va chi nhom dau moi dem duoc cung don vi voi
  // daChi.
  //
  // Doi chieu tren du lieu that (07/10/2026): 548 contact co lien he / 504
  // credit da chot. Lech 44 KHONG phai lam tron - do la so credit app that su
  // tieu ma quen ghi vao so: duong dan link bi tinh `billable = 0` vi so URL
  // voi uid hex, nen 126 credit bi tra lai voi ghi chu "nothing billable"
  // trong khi SignalHire van tru tien. Da vit o app/api/reveal/route.ts, nhung
  // du lieu CU thi khong dung lai duoc, nen Spent cho giai doan truoc
  // 07/10/2026 van thieu khoang chung do.
  const thuVe = contacts.filter((c) => byCredit(c) && afterBaseline(c.created_at));
  const coLienHe = (c: any) => (c.email ?? '').trim() !== '' || (c.phone ?? '').trim() !== '';
  const gained = thuVe.filter(coLienHe).length;
  const veRong = thuVe.filter((c) => !coLienHe(c));
  const veRongCoLinkedin = veRong.filter((c) => (c.linkedin_url ?? '').trim() !== '').length;

  // ---- doi chieu voi so du SignalHire --------------------------------------
  //
  // Khong dung de bao cao, dung de BAT chuyen la. So du tut nhieu hon so sach
  // nghia la co credit di dau do ngoai app: het han, doi goi, hoac co nguoi
  // lam viec thang tren web SignalHire. Truoc day phan chenh nay bi cong luon
  // vao Spent nen khong ai nhin thay.
  const coSo = snaps.filter((s: any) => s.credits_left != null);
  let tutTheoSoDu: number | null = null;
  let napThem = 0;
  if (coSo.length) {
    let sum = 0;
    const moc = [...coSo, ...(balance.left != null ? [{ credits_left: balance.left }] : [])];
    for (let i = 1; i < moc.length; i++) {
      const delta = moc[i - 1].credits_left - moc[i].credits_left;
      if (delta > 0) sum += delta;
      else if (delta < 0) napThem++;   // nap them hoac doi khoa, khong phai tieu
    }
    tutTheoSoDu = sum;
  }
  const lechSo = tutTheoSoDu != null ? tutTheoSoDu - daChi : null;
  const mocHienThi = measureSince ? measureSince.toLocaleDateString('vi-VN') : null;

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
    // Giu lai chinh cac dong cua category de dem SO NGUOI rieng cho no. Dem
    // nguoi khong cong don duoc nhu cac cot khac: hai dong cung mot nguoi o hai
    // category khac nhau phai tinh la mot nguoi o moi ben, nhung chi mot nguoi
    // o dong Total - nen Total KHONG bang tong cot nay, va dung nhu vay.
    rows: any[];
  }>();
  for (const c of contacts) {
    const name = c?.brand?.category?.name ?? '(no category)';
    const g = byCat.get(name) ?? {
      total: 0, paid: 0, free: 0, bulk: 0, appGenerated: 0, manual: 0,
      full: 0, email: 0, phone: 0, none: 0, paidFull: 0, rows: [],
    };
    g.total++;
    g.rows.push(c);
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
        {mocHienThi && <> Spent, Gained and Came back empty all count from {mocHienThi}.</>}
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
          value={String(daChi)}
          hint={
            `Charged by this app across ${soLanChot} reveal${soLanChot === 1 ? '' : 's'}` +
            (mocHienThi ? ` since ${mocHienThi}` : '') +
            (treoGiuCho ? `. ${treoGiuCho} more still held by stuck jobs.` : '.')
          }
        />
        <Tile
          label="Gained"
          value={String(gained)}
          hint={
            `Contacts that came back with an email or a phone over the same stretch. ` +
            `These are the ones SignalHire bills for.`
          }
        />
        <Tile
          label="Came back empty"
          value={String(veRong.length)}
          tone={veRong.length > gained ? 'warn' : undefined}
          hint={
            `No email and no phone, so nothing was charged` +
            (veRongCoLinkedin
              ? `. ${veRongCoLinkedin} of them still have a LinkedIn, so they are reachable.`
              : '.')
          }
        />
      </div>

      {lechSo != null && Math.abs(lechSo) >= NGUONG_LECH && (
        <p className="mt-3 rounded-lg border border-red-deep/30 bg-white px-4 py-3 text-sm leading-relaxed">
          <b>
            SignalHire&rsquo;s balance has fallen by {tutTheoSoDu} since {mocHienThi ?? 'the baseline'},
            but this app only charged {daChi}.
          </b>{' '}
          <span className="text-ink-dim">
            Those {lechSo} credits have no record in this app. Most of a gap this size is usually
            outside the app altogether: credits expiring, the plan renewing, the API key being
            swapped, or someone revealing directly on signalhire.com. Part of it can also be spend the
            app genuinely made but failed to book, so treat Spent as a floor rather than an exact
            figure.
            {napThem > 0 && <> {napThem} top-up{napThem > 1 ? 's were' : ' was'} skipped when working this out.</>}
          </span>
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-2.5 font-semibold">Category</th>
              <th className="px-3 py-2.5 text-right font-semibold" title="Rows in the contact table. One person covering two brands is two rows, on purpose.">
                Leads
              </th>
              <th className="px-3 py-2.5 text-right font-semibold" title="Distinct human beings behind those rows, matched on SignalHire id, LinkedIn URL and personal email. The Total is not the sum of this column: someone working across two categories is one person overall.">
                People
              </th>
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
              const nguoi = demNguoi(g.rows);
              return (
                <tr key={name} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-semibold">{name}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{g.total}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${nguoi < g.total ? 'text-red-deep' : 'text-ink-dim'}`}>
                    {nguoi}
                  </td>
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
                <td className={`px-3 py-2.5 text-right tabular-nums ${trungNguoi ? 'text-red-deep' : ''}`}>{nNguoi}</td>
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
                <td colSpan={14} className="px-4 py-6 text-center text-sm text-ink-dim">
                  No contacts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {trungNguoi > 0 && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-dim">
          <b>{contacts.length} rows cover {nNguoi} people.</b> The {trungNguoi} extra row
          {trungNguoi > 1 ? 's are' : ' is'} the same person listed under more than one brand, which is
          usually right: someone at a parent company is often the way in to several of its brands. Both
          numbers are shown so a repeat never quietly reads as a fresh lead.
        </p>
      )}

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
              Credits <i>this app</i> charged. Every reveal writes a row before it calls SignalHire and
              settles that row afterwards, so this is counted from those rows rather than from the
              balance.
              <br />
              It used to be worked out by adding up the drops in SignalHire&rsquo;s balance, which is
              wrong in a way that cannot be patched: the balance belongs to the whole account, so
              credits expiring, a plan renewing, a key being swapped, or somebody revealing directly on
              signalhire.com all look exactly like this app spending money. On 1 Oct the balance fell
              from 1458 to 5 in seven and a half hours with no reveal recorded at all, and this tile
              read 1904 when the app had charged 504 in its entire life. Anything the balance does that
              the app did not do now gets its own line above instead of being folded in here.
              <br />
              Read it as a floor, not an exact figure. Until 7 Oct a reveal started from a pasted
              LinkedIn link handed its credit back as &ldquo;nothing billable&rdquo; even when
              SignalHire had charged for it, so roughly 44 credits of real spend were never booked.
              That is fixed for new reveals, but the old rows cannot be reconstructed.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Leads and People</dt>
            <dd>
              <b>Leads</b> counts rows. <b>People</b> counts human beings, matching rows on SignalHire
              id, LinkedIn URL and personal email. Never on phone, because a company switchboard is
              shared, and never on name, because Vietnamese names repeat far too often.
              <br />
              They differ when one person is the contact for several brands, which is normal and worth
              keeping: a marketing lead at a parent company really is the way in to each of its brands,
              and deleting the second row would cut a brand loose. The <b>Total</b> row is not the sum
              of the People column, on purpose: someone working across two categories counts once in
              each of those categories and once overall.
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
            <dt className="font-semibold text-ink">Gained, Came back empty</dt>
            <dd>
              SignalHire only bills a reveal that comes back with an email or a phone, and the app
              hands the credit back for the rest, so these two tiles split the same stretch:{' '}
              <b>Gained</b> is what was paid for, <b>Came back empty</b> is what was not.
              <br />
              This replaces a tile called <b>Wasted</b>, which read &ldquo;Spent minus Gained&rdquo;
              and was comparing two different things: credits on one side, and on the other a row
              count that included every empty reveal the app was never charged for. It last showed
              977, or 51% of spend. The honest version of that question is <b>Full rate (paid)</b> in
              the table below, which asks how complete the records were that the money actually
              bought.
              <br />
              An empty reveal is not automatically a loss: most of them still carry a LinkedIn
              profile, which is enough to reach the person by hand.
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
