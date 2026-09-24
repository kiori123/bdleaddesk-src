'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { resolveBrands, goiYBrand, type Resolved, type GoiY } from './actions';
import { VUNG, VUNG_MAC_DINH, timVung } from '@/lib/regions';
import { tachBrand } from '@/lib/brandInput';

/**
 * Mot component cho ca hai loi vao. Chung goi CUNG mot API; diem khac nhau duy
 * nhat la mode 'role' hien them khoi Function.
 *
 * Quy tac cua man nay:
 *   Brand, Category, Region va Skip brands already on file la dieu kien tim
 *   THAT SU (Region chi ap dung khi cong ty qua lon va can lan goi thu hai -
 *   xem lib/signalhire.ts).
 *   Title words va Function KHONG gui di dau ca - chi xep hang lai ket qua sau
 *   khi ve, de trong cung duoc. Function tung duoc gui sang SignalHire duoi
 *   tham so `department` va do la mot loi that: nhan trong DEPARTMENTS duoi day
 *   la nhan tu dat cua app, SignalHire tra 422 "Department is not recognized"
 *   va nuot theo ca bo loc dia diem trong cung lan goi do. Xem ghi chu o dau
 *   lib/signalhire.ts.
 */

type Cat = { id: string; name: string };

// Mot bo goi y DUY NHAT cho moi category - khong co danh sach rieng theo
// nganh, vi PIC tu biet nganh cua minh can tu nao va bo goi y chi la diem
// khoi dau, ho go them/xoa thoai mai.
//
// "Decision makers" dat DAU TIEN co chu dich: nguoi ky hop dong agency o mot
// brand Viet Nam nho/vua thuong la chu hoac giam doc kinh doanh, khong phai
// nguoi co chu "ecommerce" trong chuc danh.
const KEYWORD_GROUPS: { label: string; chips: string[] }[] = [
  {
    label: 'Decision makers',
    chips: [
      'founder', 'owner', 'CEO', 'general director', 'chu tich', 'tong giam doc',
      'giam doc kinh doanh', 'commercial director', 'business development',
    ],
  },
  {
    label: 'Channel and function',
    chips: [
      'ecommerce', 'e-commerce', 'Shopee', 'TikTok Shop', 'Lazada', 'marketplace',
      'trade marketing', 'modern trade', 'omnichannel', 'digital', 'brand management', 'online',
    ],
  },
  {
    label: 'Industry',
    chips: ['FMCG', 'beauty', 'skincare', 'mother and baby', 'fashion', 'F&B', 'supplements'],
  },
  {
    label: 'China and cross-border',
    chips: [
      'Tmall', 'JD', 'Douyin', 'Taobao', '1688', 'Alibaba', 'cross-border',
      'overseas', 'export', 'Southeast Asia', 'SEA market',
    ],
  },
];

const DEPARTMENTS = [
  'Marketing', 'Sales',
  // Doi tac chinh cua OnPoint. Form n8n cu co muc nay, ban app dau tien lam roi
  // mat, nen PIC tim nguoi ecom phai chon Marketing roi tu loc bang mat.
  'E-commerce and digital',
  'Business Development',
  // Voi brand nuoc ngoai dang tim duong vao Viet Nam, nguoi quyet dinh thuong
  // khong nam o doi Sales trong nuoc ma o doi Export hoac Overseas cua tap doan.
  'Export and international',
  'Operations', 'Product',
  'Engineering', 'Finance', 'Human Resources', 'Legal', 'Support',
];

// Danh sach vung lay tu lib/regions.ts, dung chung voi phia goi SignalHire.
// Truoc day o day co mot ban chep rieng, them mot dong ma quen ben kia thi lua
// chon do lang le rot ve khong loc dia diem, khong co gi bao.

export default function SearchForm({
  mode, categories,
}: { mode: 'explore' | 'role'; categories: Cat[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState('');

  const [brands, setBrands] = useState(mode === 'role' ? '' : '');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [region, setRegion] = useState(VUNG_MAC_DINH);

  // Nhieu nhom chuc vu cung luc. Form n8n cu tick duoc nhieu, ban app dau tien
  // chi cho chon mot, nen ai muon ca Marketing lan E-commerce phai quet hai lan
  // va ton hai luot cho cung mot brand.
  const [depts, setDepts] = useState<string[]>([]);
  const [titleWords, setTitleWords] = useState('');

  // Gui THANG sang SignalHire lam tham so `keywords` (xem lib/signalhire.ts) -
  // KHAC voi Title words, truong nay co the LOC (khi cong ty qua lon, lan goi
  // thu hai dung no de thu hep) nen thuoc Must match, khong phai chi xep hang.
  // Ap dung o CA hai mode: Explore lan Find a role.
  const [keywords, setKeywords] = useState('');

  function themTuKhoa(tu: string) {
    const term = tu.includes(' ') ? `"${tu}"` : tu;
    setKeywords((cu) => {
      const c = cu.trim();
      if (!c) return term;
      // Da co san dung tu (bo qua dau ngoac kep luc so) thi khong them trung.
      const daCo = c.split(/\bOR\b/i).map((x) => x.trim().replace(/^"|"$/g, '').toLowerCase());
      if (daCo.includes(tu.toLowerCase())) return cu;
      return `${c} OR ${term}`;
    });
  }

  // Mac dinh BAT, giong form n8n cu. Gan het brand trong he thong da co nguoi,
  // nen tat mac dinh la moi lan quet lai danh sach cu deu dam vao tran 300
  // brand mot ngay va co the tra tien lan hai cho dung nguoi da co.
  const [skipScanned, setSkipScanned] = useState(true);

  const [resolved, setResolved] = useState<Resolved[]>([]);
  const [looking, setLooking] = useState(false);
  const [lookErr, setLookErr] = useState(false);

  const [goiY, setGoiY] = useState<GoiY[]>([]);
  const [hienGoiY, setHienGoiY] = useState(false);

  const [dangDocFile, setDangDocFile] = useState(false);
  const [tinFile, setTinFile] = useState('');

  // /api/scan tra needsConfirmation khi lo qua lon so voi han muc con lai cua
  // team hom nay. Khong tu quet mot phan - PIC phai bam xac nhan thi lan gui
  // lai (voi danh sach da rut gon) moi thuc su chay.
  const [confirmScan, setConfirmScan] = useState<{
    asked: number; wouldScan: string[]; resetsAt: string;
  } | null>(null);

  function batDept(d: string) {
    setDepts((cu) => (cu.includes(d) ? cu.filter((x) => x !== d) : [...cu, d]));
  }

  /**
   * Doc file danh sach brand roi DO RA O NHAP, khong quet luon.
   *
   * PIC phai nhin duoc app doc ra gi truoc khi tieu luot. File that hay co dong
   * tieu de, dong tong, cot ghi chu; doc nham cot la quet 40 cai ten vo nghia.
   * Do ra o nhap thi sua duoc, va mo ta cot da doc nam ngay canh do.
   */
  async function nhanFile(f: File | null) {
    if (!f) return;
    setTinFile(''); setErr(''); setDangDocFile(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch('/api/brands/parse', { method: 'POST', body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(body.error ?? 'Could not read that file.'); return; }

      const ten: string[] = Array.isArray(body.names) ? body.names : [];
      if (!ten.length) { setErr('No brand names were found in that file.'); return; }

      // Noi them vao thay vi de len, de PIC go tay vai brand roi upload them.
      setBrands((cu) => (cu.trim() ? `${cu.replace(/[\s,]+$/, '')}, ${ten.join(', ')}` : ten.join(', ')));
      setTinFile(
        `Read ${ten.length} name${ten.length === 1 ? '' : 's'} from "${body.column}" `
        + `across ${body.rows} rows. Check the list before searching.`,
      );
    } catch {
      setErr('Could not read that file. Try saving it as .csv and uploading again.');
    } finally {
      setDangDocFile(false);
    }
  }

  // tachBrand chu khong phai split(','): "ABC, LLD" la MOT ten phap nhan, tach
  // doi la di tim mot cong ty ten LLD khong co that.
  const brandList = tachBrand(brands);

  // Tra cong ty khi nguoi dung ngung go 400ms. Khong tra moi phim vi moi lan la
  // mot vong xuong DB.
  //
  // Ba trang thai, va phai phan biet duoc ca ba. Truoc day chi co mot: khong co
  // gi hien ra. Dang tra, tra hong, va tra xong ma brand khong co trong bang -
  // ca ba deu ra man hinh trong y het nhau, nen nguoi dung khong biet nen doi,
  // nen bao loi, hay nen them alias.
  useEffect(() => {
    if (!brandList.length) { setResolved([]); setLooking(false); setLookErr(false); return; }

    setLooking(true);
    setLookErr(false);

    const t = setTimeout(() => {
      resolveBrands(brandList)
        .then((r) => { setResolved(r); setLookErr(false); })
        // Khong co catch thi mot loi phia server lam Promise reject trong im
        // lang: setResolved khong bao gio chay, o goi y khong bao gio hien, va
        // khong co dau vet nao tren man hinh lan trong console.
        .catch(() => { setResolved([]); setLookErr(true); })
        .finally(() => setLooking(false));
    }, 400);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands]);

  // Goi y ten brand. Chi tra theo cum DANG GO, tuc phan sau dau phay cuoi cung,
  // de o nhieu brand van goi y duoc cho tung cai.
  const dangGo = brands.split(',').slice(-1)[0].trim();

  useEffect(() => {
    if (dangGo.length < 2) { setGoiY([]); return; }
    let bo = false;
    const t = setTimeout(() => {
      goiYBrand(dangGo)
        .then((r) => { if (!bo) setGoiY(r); })
        .catch(() => { if (!bo) setGoiY([]); });
    }, 250);
    return () => { bo = true; clearTimeout(t); };
  }, [dangGo]);

  /** Thay cum dang go bang ten duoc chon, giu nguyen cac brand da go truoc do. */
  function chonGoiY(ten: string) {
    const phan = brands.split(',');
    phan[phan.length - 1] = ` ${ten}`;
    setBrands(phan.join(',').replace(/^\s+/, ''));
    setHienGoiY(false);
  }

  function run(brandsOverride?: string[]) {
    setErr('');
    const danhSach = brandsOverride ?? brandList;
    if (!danhSach.length) { setErr('Type at least one brand name.'); return; }
    if (!categoryId) { setErr('Pick the category this belongs to.'); return; }
    setConfirmScan(null);

    start(async () => {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId,
          brands: danhSach.map((name) => ({ name, tier: 1 })),
          location: region,
          skipScanned,
          // CHI man Find a role moi gui nhom chuc vu di lam dieu kien tim. Man
          // Explore khong con o chon Department nua, nen o day luon la mang
          // rong: gui di thi SignalHire se loai thang nguoi khong khop truoc
          // khi phan xep hang kip chay.
          role: mode === 'role' ? depts : [],
          // Keywords ap dung o CA HAI mode, khac Function o tren.
          keywords: keywords.trim(),
          // Mo uoc di kem job de man ket qua xep hang duoc, KHONG gui sang SignalHire.
          prefs: {
            department: depts[0] ?? null,
            departments: depts,
            titleWords: titleWords.split(',').map((w) => w.trim()).filter(Boolean),
          },
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(body.error ?? 'Could not start the search. Try again in a moment.'); return; }
      if (body.needsConfirmation) {
        setConfirmScan({
          asked: body.asked,
          wouldScan: Array.isArray(body.wouldScan) ? body.wouldScan : [],
          resetsAt: body.resetsAt,
        });
        return;
      }
      router.push(`/scan/results/${body.jobId}`);
    });
  }

  const label = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-faint';
  const input =
    'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-teal-deep';

  return (
    // flex column + flex 1: tam nay an het chieu cao con lai cua trang, va hang
    // nut o duoi duoc day xuong day bang marginTop auto. Truoc day form ket thuc
    // o lung chung man hinh roi bo trong phan con lai.
    <div className="tile" style={{ flex: 1, padding: '16px 18px 0' }}>
      {err && (
        <p className="mb-4 rounded-lg border border-red-deep/30 bg-white px-4 py-3 text-[13px] text-red-deep">
          {err}
        </p>
      )}

      {/* ---------- MUST MATCH ---------- */}
      {/* Khong ghi ten nha cung cap ra man hinh. PIC khong can biet dang goi API
          nao, va mai mot doi nha cung cap thi cau chu do thanh sai. */}
      <div className="mb-4 flex items-baseline gap-2.5 border-b-2 border-teal-deep pb-1.5">
        <span className="font-display text-sm uppercase tracking-wide text-teal-deep">Must match</span>
        <span className="text-[11px] font-semibold text-ink-faint">narrows the search</span>
      </div>

      <div className="mb-4">
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
          <label className={`${label} mb-0`} htmlFor="brands">
            {mode === 'role' ? 'Brands' : 'Brand'}
          </label>

          {/* Upload danh sach. Chi hien o man nhieu brand: man Explore mot brand
              thi mot cai nut upload chi lam roi mat. */}
          {mode === 'role' && (
            <label className="mini" style={{ cursor: dangDocFile ? 'default' : 'pointer' }}>
              {dangDocFile ? 'Reading…' : 'Upload a list'}
              <input
                type="file" className="hidden" disabled={dangDocFile}
                accept=".xlsx,.xls,.csv,.tsv,.txt"
                onChange={(e) => { nhanFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
              />
            </label>
          )}
        </div>

        {tinFile && (
          <div className="mb-2 rounded-lg border-l-[3px] border-teal-deep bg-surface-sunk px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-dim">
            {tinFile}
          </div>
        )}

        <input
          id="brands" className={input} value={brands} autoFocus autoComplete="off"
          placeholder={mode === 'role' ? 'Chin-su, Omachi, Nam Ngu' : 'Royal Canin'}
          onChange={(e) => { setBrands(e.target.value); setHienGoiY(true); }}
          onFocus={() => setHienGoiY(true)}
          // Cho nhap chuot ra nut goi y kip chay truoc khi danh sach bien mat.
          // Dong ngay o onBlur thi cu bam vao goi y la no chay mat duoi ngon tay.
          onBlur={() => setTimeout(() => setHienGoiY(false), 150)}
        />

        {/* Hien ra dung nhung ten se duoc tim.
            Khong the de PIC doan: go "ABC, LLD" thi ho nghi la mot brand, con
            app truoc day hieu thanh hai. Bay ra day thi sai la thay ngay, khong
            phai doi quet xong moi biet. */}
        {brandList.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Will search {brandList.length}:
            </span>
            {brandList.map((b, i) => (
              <span key={`${b}-${i}`} className="cattag">{b}</span>
            ))}
          </div>
        )}

        {hienGoiY && goiY.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {goiY.map((g) => (
              <button
                key={g.name} type="button" className={`mini${g.onFile ? ' ok' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => chonGoiY(g.name)}
              >
                {g.name}
                {g.onFile && (
                  <span className="ml-1.5 font-normal opacity-70">
                    {g.contacts} on file
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {looking && brandList.length > 0 && (
          <div className="mt-2 rounded-lg border-l-[3px] border-line bg-surface-sunk px-3 py-2.5 text-[12.5px] text-ink-faint">
            Checking which company to search…
          </div>
        )}

        {lookErr && (
          <div className="mt-2 rounded-lg border-l-[3px] border-red-deep bg-surface-sunk px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-dim">
            Could not check the brand mapping just now, so this screen cannot show you which
            company it will search. The search itself still works. Try retyping the brand, and
            tell Khoa if it keeps happening.
          </div>
        )}

        {!looking && !lookErr && resolved.length > 0 && (
          <div className="mt-2 rounded-lg border-l-[3px] border-teal-deep bg-surface-sunk px-3 py-2.5 text-[12.5px] leading-relaxed text-ink-dim">
            {resolved.map((r) => (
              <div key={r.brand} className="mb-1 last:mb-0">
                {r.companies.length === 0 ? (
                  <>
                    <b className="text-ink">{r.brand}</b> is not mapped to a company yet. The search
                    will use the brand name itself, which usually finds nobody. Add it under Admin,
                    Aliases.
                  </>
                ) : (
                  <>
                    Searching{' '}
                    {r.companies.map((c, i) => (
                      <span key={c.employer}>
                        {i > 0 && <span className="text-ink-faint"> OR </span>}
                        <b className="text-teal-deep">{c.employer}</b>
                        {c.relation === 'distributor' && (
                          <span className="text-ink-faint"> (distributor)</span>
                        )}
                      </span>
                    ))}
                    {r.companies.length > 1 && (
                      <span className="text-ink-faint"> for {r.brand}</span>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="cat">Category</label>
          <select id="cat" className={input} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="region">Where do they work</label>
          <select id="region" className={input} value={region} onChange={(e) => setRegion(e.target.value)}>
            {VUNG.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
          </select>

          {/* Cau giai thich cua lua chon dang chon, luon hien.
              Ly do co no: chi PIC phu trach Trung Quoc doc "China only" va
              "Greater China" ma khong biet chon cai nao, vi hai chu do khong noi
              ra Hong Kong hay Dai Loan co nam trong hay khong. Nhan moi cung da
              noi ro han, nhung nhan thi ngan, cho giai thich moi day du. */}
          <p className="mt-1.5 max-w-[62ch] text-[11.5px] leading-snug text-ink-faint">
            {timVung(region)?.hint}
          </p>

          {/* Cau nay phai co, va phai noi ro. Nhan o tren la "Where do they
              work" va cau hint la "People working in Vietnam." - ca hai hua
              mot bo loc tuyet doi, con thuc te chi loc khi cong ty qua lon
              (xem lib/signalhire.ts: cong ty duoi 100 nguoi thi CO Y lay het,
              vi luc do PIC muon thay moi nguoi). Khong noi ra thi PIC mo ket
              qua, thay nguoi o Singapore hay London, va ket luan app hong -
              dung nhu bao cao "filter Vietnam nhung ra toan SEA". */}
          {timVung(region)?.nuoc?.length ? (
            <p className="mt-1.5 max-w-[62ch] text-[11.5px] leading-snug text-ink-faint">
              For a company with a lot of people on file this filters at the source. For a
              smaller one everyone comes back whatever their location, and the results screen
              puts the people in {timVung(region)!.label} at the top with the rest below a line.
            </p>
          ) : null}

          {/* Rieng Trung Quoc dai luc thi noi them mot cau, vi day la cho de
              hieu nham nhat: it ket qua o day KHONG co nghia la brand do khong
              co ai. LinkedIn bi chan o dai luc nen nhieu nguoi khong co ho so,
              nhung dung nhung nguoi lam doi ngoai thi thuong lai co. */}
          {region === 'China only' && (
            <p className="mt-1.5 max-w-[62ch] text-[11.5px] leading-snug text-ink-dim">
              <b>Few results here does not mean the brand has nobody.</b> Fewer people in
              mainland China keep a public profile, so this option finds less than it
              would for other markets. If it comes back thin, run it again on the option
              just below, which adds Hong Kong, Taiwan and Macau. Looking costs nothing.
            </p>
          )}
        </div>
      </div>

      {/* Bo qua brand da co nguoi. Nam trong Must match vi no that su thay doi
          danh sach duoc gui di, khong phai chuyen xep hang. */}
      <div className="mb-4">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox" checked={skipScanned}
            onChange={(e) => setSkipScanned(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-teal-deep"
          />
          <span className="text-[13px] leading-snug text-ink-dim">
            <b className="text-ink">Skip brands already on file</b>
            <span className="mt-0.5 block max-w-[64ch] text-[11.5px] text-ink-faint">
              A brand that already has contacts is left out, so the team scan limit is not
              spent looking up people you already have. Untick to search them again anyway.
              The next screen names every brand it left out.
            </span>
          </span>
        </label>
      </div>

      {/* Keywords: gui THANG sang SignalHire (tham so `keywords`), ap dung o
          CA HAI mode. No CHI loc khi cong ty qua lon va can lan goi thu hai
          (xem lib/signalhire.ts) - cong ty nho van lay het, luc do Keywords
          chi con doi thu tu. Vi vay no nam trong Must match nhung cau giai
          thich phai noi ro dieu kien do, khong hua loc luon nhu Function. */}
      <div className="mb-4">
        <label className={label} htmlFor="kw">
          Keywords <span className="normal-case text-ink-faint">optional, click a suggestion or type your own</span>
        </label>
        <input
          id="kw" className={input} value={keywords}
          placeholder='ecommerce OR "trade marketing"'
          onChange={(e) => setKeywords(e.target.value)}
        />

        <div className="mt-2 space-y-1.5">
          {KEYWORD_GROUPS.map((g) => (
            <div key={g.label} className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                {g.label}:
              </span>
              {g.chips.map((c) => (
                <button
                  key={c} type="button" className="mini"
                  onClick={() => themTuKhoa(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          ))}
        </div>

        <p className="mt-2 max-w-[62ch] text-[11.5px] leading-snug text-ink-faint">
          Matches skills and past or present job history, not just the current title. Type
          anything, including <code>OR</code>, <code>AND</code> and parentheses. Only narrows the
          search when a company has too many people to show at once - for a small company
          everyone still comes back, and this only reorders them.
        </p>
      </div>

      {/* Man Find a role: nhom chuc vu CHI de xep hang (doi chieu voi job_title
          o lib/rank.ts), KHONG gui sang SignalHire lam dieu kien tim - xem ghi
          chu o dau file va o dau lib/signalhire.ts. */}
      {mode === 'role' && (
        <div className="mb-4">
          <span className={label}>Function <span className="normal-case text-ink-faint">tick as many as you need</span></span>

          <div className="flex flex-wrap gap-1.5">
            {DEPARTMENTS.map((d) => (
              <button
                key={d} type="button"
                className={`mini${depts.includes(d) ? ' ok' : ''}`}
                onClick={() => batDept(d)}
              >
                {d}
              </button>
            ))}
          </div>

          <p className="mt-2 max-w-[62ch] text-[11.5px] leading-snug text-ink-faint">
            {depts.length === 0 ? (
              <>Nothing ticked means every senior person, whatever their function.</>
            ) : (
              <>
                This <b>reorders</b> the list, it never shortens it: people whose job title
                mentions one of the ticked functions rise to the top, and everyone else is
                still there below them. Nobody is dropped for having the wrong function.
              </>
            )}
          </p>
        </div>
      )}

      {/* Xep hang lai theo tu trong chuc danh. KHONG gui sang SignalHire va
          KHONG loai ai: chi day nguoi khop len tren, giong nhu diem thuong
          theo thang bac o lib/rank.ts. */}
      <div className="mb-4">
        <label className={label} htmlFor="tw">Title words <span className="normal-case text-ink-faint">optional, separate with commas</span></label>
        <input
          id="tw" className={input} value={titleWords}
          placeholder="trade marketing, ecommerce, kenh MT"
          onChange={(e) => setTitleWords(e.target.value)}
        />
        <p className="mt-1.5 text-[11.5px] text-ink-faint">
          Moves matching titles to the top of the list, it never removes anyone. Accents are
          ignored, so &ldquo;kenh MT&rdquo; also matches &ldquo;Kênh MT&rdquo;.
        </p>
      </div>

      {/* Han muc brand-scan chung ca team hom nay khong du cho ca lo. Chua
          quet gi ca - PIC phai tu bam xac nhan lo nho hon. */}
      {confirmScan && (
        <div className="mb-4 rounded-lg border-l-[3px] border-red-deep bg-surface-sunk px-4 py-3 text-[12.5px] leading-relaxed text-ink-dim">
          <b className="text-ink">
            Only {confirmScan.wouldScan.length} of {confirmScan.asked} brands can be scanned today.
          </b>{' '}
          The team&apos;s daily scan limit resets at midnight Vietnam time
          ({new Date(confirmScan.resetsAt).toLocaleString('vi-VN')}). Nothing has been scanned yet.
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {confirmScan.wouldScan.map((b, i) => (
              <span key={`${b}-${i}`} className="cattag">{b}</span>
            ))}
          </div>
          <button
            type="button" onClick={() => run(confirmScan.wouldScan)} disabled={pending}
            className="mt-2.5 h-8 rounded-lg bg-grad-teal px-3.5 text-[11px] font-semibold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-40"
          >
            Scan these {confirmScan.wouldScan.length} now
          </button>
        </div>
      )}

      <div
        className="flex flex-wrap items-center gap-4"
        style={{
          marginTop: 'auto', marginLeft: -18, marginRight: -18,
          padding: '15px 18px', borderTop: '1px solid var(--bd)',
        }}
      >
        <button
          onClick={() => run()} disabled={pending || !brandList.length}
          className="rounded-lg bg-grad-teal px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-40"
        >
          {pending ? 'Searching' : 'Search'}
        </button>

        {/* Mot lan quet co the mat 30 den 60 giay, va lau hon nua khi phai tim
            lai vi alias tra ve rong. Chi doi chu tren nut thi PIC tuong may
            treo roi bam lai lan hai. */}
        {pending ? (
          <span className="progrow" style={{ flex: 1, minWidth: 220 }}>
            <span className="prog" />
            <span className="progtxt">
              Looking up {brandList.length} brand{brandList.length === 1 ? '' : 's'}, up to a minute
            </span>
          </span>
        ) : (
          <span className="text-[12.5px] text-ink-dim">
            Free. Uses {brandList.length || 0} of your brand scans.
          </span>
        )}
      </div>
    </div>
  );
}
