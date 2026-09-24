import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Quota = { tran: number; team_da_dung: number; team_con_lai: number; cua_toi: number };
type Credit = { category: string; con_lai: number };

/**
 * Man chon kieu quet.
 *
 * Bo cuc: dai so lieu mot dong tren cung, roi ba the hanh dong chiem 3 cot va
 * "Recent scans" lam cot ben. Bo cuc 3 + 1 nay da co san trong globals.css
 * (.g-list, .g-side), dung chung voi Brand board.
 *
 * Hai lan truoc sai o cho nay: dat so lieu to bang nua trang lam lech thu tu uu
 * tien, roi dat maxWidth ma quen can giua lam ca trang dinh le trai.
 */

function Stat({ label, m }: { label: string; m: Quota }) {
  const pct = m.tran > 0 ? Math.min(100, (m.team_da_dung / m.tran) * 100) : 0;
  const tight = pct >= 80;

  return (
    <div style={{ flex: '1 1 150px', minWidth: 0 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
        textTransform: 'uppercase', color: 'var(--faint)',
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 3 }}>
        <span style={{
          fontFamily: 'var(--dp)', fontSize: 20, lineHeight: 1,
          color: tight ? 'var(--acc)' : 'var(--tl)',
        }}>{m.team_con_lai.toLocaleString('en-US')}</span>
        <span style={{ fontSize: 11, color: 'var(--faint)' }}>
          left of {m.tran.toLocaleString('en-US')}
        </span>
      </div>
      {/* Chua dung gi thi khong ve thanh do. Mot thanh 0% khong mang thong tin
          nao ma lai giong o giao dien bi loi. */}
      {pct > 0 && (
        <div className="ktrack" style={{ marginTop: 7 }}>
          <div className="kseg a" style={{ width: `${pct}%`, background: tight ? 'var(--acc)' : 'var(--tl2)' }} />
          <div className="kseg b" style={{ width: `${100 - pct}%` }} />
        </div>
      )}
    </div>
  );
}

function Pick({
  n, href, title, body, gets, cost, paid,
}: {
  n: string; href: string; title: string; body: string;
  gets: string; cost: string; paid?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`tile k1 ${paid ? 'hl' : 'tl'}`}
      // space-between: so thu tu bam dinh, cum chu o giua, dong gia bam day.
      // The cao bao nhieu thi ba cum tu gian ra bay nhieu, khong don cuc len tren
      // roi bo trong phan duoi.
      style={{ justifyContent: 'space-between', textDecoration: 'none', padding: '16px 16px 15px' }}
    >
      <div style={{
        fontFamily: 'var(--dp)', fontSize: 11, letterSpacing: '.06em',
        color: 'var(--faint)', lineHeight: 1,
      }}>{n}</div>

      <div>
        <div style={{
          fontFamily: 'var(--dp)', fontSize: 19, lineHeight: 1.08,
          textTransform: 'uppercase', letterSpacing: '.01em',
          color: paid ? 'var(--acc)' : 'var(--tl)',
        }}>{title}</div>

        <p style={{ margin: '9px 0 0', fontSize: 12, color: 'var(--dim)', lineHeight: 1.5 }}>
          {body}
        </p>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>{gets}</span>
        <span className={`ctag2 ${paid ? 'paid' : 'free'}`}>{cost}</span>
      </div>
    </Link>
  );
}

/** "3 phut truoc" doc nhanh hon mot dau thoi gian day du o danh sach ngan. */
function khiNao(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

export default async function ScanPicker() {
  const db = await supabaseServer();
  const { data: quota } = await db.rpc('my_quota');

  // Lan quet gan day. RLS lo phan ai thay gi: job_read chi cho xem job cua
  // chinh minh, tru admin thi thay het.
  const { data: jobs } = await db
    .from('job')
    .select('id, status, payload, created_at')
    .eq('kind', 'search')
    .order('created_at', { ascending: false })
    .limit(7);

  // Dem ung vien bang mot luot rieng. PostgREST khong long duoc count vao select,
  // ma sau job thi chi con toi da 7 id nen mot vong nua la du re.
  const ids = (jobs ?? []).map((j: any) => j.id);
  const { data: cands } = ids.length
    ? await db.from('scan_candidate').select('job_id').in('job_id', ids)
    : { data: [] as { job_id: string }[] };

  const demTheoJob = new Map<string, number>();
  for (const c of (cands ?? []) as { job_id: string }[]) {
    demTheoJob.set(c.job_id, (demTheoJob.get(c.job_id) ?? 0) + 1);
  }

  const locked = quota?.dang_khoa === true;
  const credits = (quota?.credit ?? []) as Credit[];
  const totalCredits = credits.reduce((n, c) => n + (c.con_lai ?? 0), 0);

  return (
    // Cao toi thieu bang phan man hinh con lai sau thanh dieu huong 48px va
    // padding 14 + 46 cua .wrap. Nho vay hang the o duoi an het cho thua thay vi
    // de trang ket thuc o lung chung roi bo trong nua duoi.
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100dvh - 108px)' }}>
      <div className="phead">
        <h1 className="h1">New scan</h1>
        <span className="h1s">
          Looking is free. Nothing is charged until you pick people on the results screen.
        </span>
      </div>

      {locked && quota?.mo_khoa_luc && (
        <div className="tile" style={{ padding: '13px 15px', marginBottom: 11, borderColor: 'var(--acc)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--acc)' }}>Searching is locked</div>
          <p className="note" style={{ marginTop: 5, fontSize: 11.5 }}>
            The team reached the {quota.khoa_vi === 'brand' ? 'brand' : 'profile'} limit. The whole
            account locks for 24 hours once either one is hit. It unlocks at{' '}
            <b>{new Date(quota.mo_khoa_luc).toLocaleString('vi-VN')}</b>. Getting contact details
            for people you already found still works.
          </p>
        </div>
      )}

      <div
        className="tile"
        style={{
          flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start',
          gap: 18, padding: '12px 16px', marginBottom: 11,
        }}
      >
        {quota?.brand && <Stat label="Brand scans today" m={quota.brand} />}
        {quota?.profile && <Stat label="Profiles today" m={quota.profile} />}

        <div style={{ flex: '1 1 150px', minWidth: 0 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
            textTransform: 'uppercase', color: 'var(--faint)',
          }}>Contact credits</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 3 }}>
            <span style={{ fontFamily: 'var(--dp)', fontSize: 20, lineHeight: 1, color: 'var(--acc)' }}>
              {totalCredits.toLocaleString('en-US')}
            </span>
            <span style={{ fontSize: 11, color: 'var(--faint)' }}>left this month</span>
          </div>
          {/* Chi tiet tung category thuoc man Credits. Nhet bay chip vao day chi
              lam gay hang va bo mot chip le loi xuong dong duoi. */}
          <Link
            href="/credits"
            style={{ display: 'inline-block', marginTop: 6, fontSize: 11, fontWeight: 600, color: 'var(--tl2)' }}
          >
            See by category →
          </Link>
        </div>
      </div>

      {/* flex 1: hang nay nuot toan bo chieu cao con lai. */}
      <div className="bento" style={{ flex: 1, alignItems: 'stretch' }}>
        <div className="g-list pick3">
          <Pick
            n="01"
            href="/scan/explore"
            title="Explore a brand"
            body="You have a brand name and do not know yet who to talk to."
            gets="Anyone senior at that company"
            cost="FREE"
          />
          <Pick
            n="02"
            href="/scan/role"
            title="Find a role"
            body="You need Trade Marketing, E-commerce or leadership at one or more brands."
            gets="Filtered and ranked by fit"
            cost="FREE"
          />
          <Pick
            n="03"
            href="/scan/person"
            title="Get a contact"
            body="You already know who the person is and want their email and phone."
            gets="Email and phone number"
            cost="1 CREDIT EACH"
            paid
          />

          <p className="note" style={{ gridColumn: '1/-1', margin: 0, fontSize: 11 }}>
            Picked the wrong one? Go back and choose again, it costs nothing.
          </p>
        </div>

        {/* Duong quay lai ket qua cu. Truoc day khong co cho nao dan toi
            /scan/results, nen quet xong ma doi tab la mat danh sach, chi con
            cach boi lich su trinh duyet. */}
        <div className="tile g-side" style={{ alignSelf: 'stretch' }}>
          <div className="chead" style={{ padding: '12px 15px 11px' }}>
            <span className="ct">Recent scans</span>
          </div>

          {(jobs ?? []).length === 0 ? (
            <p style={{ margin: 0, padding: '13px 15px 15px', fontSize: 11, color: 'var(--faint)', lineHeight: 1.6 }}>
              Nothing scanned yet. Once you run a search it stays here, so you can reopen the
              results later without paying again.
            </p>
          ) : (
            <div style={{ padding: '2px 15px 11px' }}>
              {(jobs ?? []).map((j: any) => {
                const ten: string[] = Array.isArray(j.payload?.brands)
                  ? j.payload.brands.map((b: any) => b?.name).filter(Boolean)
                  : [];
                const dem = demTheoJob.get(j.id) ?? 0;
                const dangChay = j.status === 'queued' || j.status === 'running';

                return (
                  <Link
                    key={j.id}
                    href={`/scan/results/${j.id}`}
                    className="crow"
                    // Cot ben hep nen xep doc: ten o tren, gio va trang thai o
                    // duoi. Xep ngang thi ten brand bi cat giua chung.
                    style={{ textDecoration: 'none', display: 'block', padding: '10px 0' }}
                  >
                    <div style={{
                      fontSize: 12, fontWeight: 600, color: 'var(--tx)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {ten.length ? ten.join(', ') : 'Untitled scan'}
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: 8, marginTop: 5,
                    }}>
                      <span style={{ fontSize: 10.5, color: 'var(--faint)' }}>
                        {khiNao(j.created_at)}
                        {j.payload?.location && <> · {j.payload.location}</>}
                      </span>
                      <span
                        className="ctag2"
                        style={
                          j.status === 'failed'
                            ? { background: 'var(--acct)', color: 'var(--acc)' }
                            : dangChay
                              ? { background: 'var(--srf3)', color: 'var(--dim)' }
                              : { background: 'var(--srf3)', color: 'var(--tl)' }
                        }
                      >
                        {j.status === 'failed' ? 'FAILED' : dangChay ? 'SEARCHING' : `${dem} FOUND`}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
