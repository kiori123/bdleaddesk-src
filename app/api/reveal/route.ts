import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { reserveCredit, releaseCredit, commitCredit, canUseCategory } from '@/lib/credit';
import { nameKey } from '@/lib/nameKey';
import { khoaLinkedin } from '@/lib/contactIdentity';
import { loadSettings, revealUids, hocAliasTuContact } from '@/lib/signalhire';
import { rankOf } from '@/lib/orgRank';
import { baoChoNguoi } from '@/lib/notify';

export const maxDuration = 60;

/**
 * BD chon nguoi tu ket qua scan roi bam reveal. Day la cho credit that su bi
 * tieu, nen la cho duy nhat duoc phep goi reserveCredit().
 *
 * Thu tu bat buoc, khong duoc doi:
 *   1. tao job kind='reveal'   (ledger can job_id de doi chieu)
 *   2. reserveCredit()          (dat cho truoc, chan hai nguoi cung bam)
 *   3. goi SignalHire
 *   4. commitCredit neu xong, releaseCredit neu hong
 *
 * Buoc 4 phai chay NGAY trong lan goi nay. Khong con callback nao tu ben ngoai
 * de doi nua, nen quen tra credit la credit treo vinh vien.
 */
export async function POST(req: NextRequest) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { categoryId, brandId, brandName, uids, source } = await req.json();

  if (!categoryId) {
    return NextResponse.json({ error: 'Pick a category first.' }, { status: 400 });
  }
  if (!Array.isArray(uids) || uids.length === 0) {
    return NextResponse.json({ error: 'Pick at least one person to reveal.' }, { status: 400 });
  }

  // Dan mot link LinkedIn thi khong bat go ten brand nua. PIC noi dung: da co
  // link nguoi do roi thi ho ten va cong ty deu nam trong ket qua reveal, bat
  // go lai la bat lam mot viec may lam duoc.
  //
  // Chi bo qua duoc o duong link, va chi khi CHI CO MOT link. Duong chon tu ket
  // qua quet van phai co brand: luc do chua goi reveal nen chua biet cong ty, ma
  // brand con dung de gom nguoi vao dung ho so.
  const doanTuLink = !brandName && uids.length === 1 && String(uids[0]).startsWith('http');

  if (!brandName && !doanTuLink) {
    return NextResponse.json({ error: 'This reveal has no brand attached.' }, { status: 400 });
  }

  // Kiem TRUOC damBaoBrand va tao job, khong doi den reserveCredit: reveal
  // mien phi (seed_verified) khong bao gio goi reserveCredit, va damBaoBrand
  // ghi category_id len brand MOI ngay ca khi sau do reserveCredit tu choi.
  if (!(await canUseCategory(db, user.id, categoryId))) {
    return NextResponse.json(
      { error: "That category isn't yours. Ask its owner for credits on the Credits page." },
      { status: 403 },
    );
  }

  // Tu day tro di co the tieu credit va tao job that. Boc try/catch quanh
  // TOAN BO phan con lai: truoc day mot loi khong luong truoc (DB loi la, hoac
  // SignalHire treo qua lau) se lam function crash giua chung, khong bao gio
  // chay toi cac dong releaseCredit()/job.update({status:'failed'}) - job ket
  // o 'running', credit_ledger ket o 'reserved' vinh vien. Xac minh tu du lieu
  // that trong bang job/credit_ledger: nhieu dong nam 'running'/'reserved'
  // nhieu ngay lien, cung mot uid bi thu lai 2-3 lan deu ket qua nhu nhau.
  let jobId: string | null = null;
  let daGiuCho = false;

  try {
  const admin = supabaseAdmin();

  /**
   * Dam bao brand ton tai va MANG DUNG CATEGORY truoc khi tieu credit.
   *
   * /api/ingest cung upsert brand, nhung khong kem category nen brand moi se co
   * category_id = NULL. Ket hop voi policy brand_read (cho phep xem moi brand
   * NULL category), contact vua tra tien roi rot vao mot brand khong thuoc ngan
   * sach nao va hien ra cho ca team. Tao truoc o day thi ingest chi cap nhat,
   * khong tao moi, nen category duoc giu.
   */
  async function damBaoBrand(ten: string) {
    const { error } = await admin
      .from('brand')
      .upsert({ name_key: nameKey(ten), name: ten, category_id: categoryId },
              { onConflict: 'name_key', ignoreDuplicates: true });
    if (error) console.error('[reveal] khong dam bao duoc brand:', error.message);
  }

  // Duong link thi chua biet brand, phai doi reveal tra ve moi biet. Duong con
  // lai tao ngay, TRUOC khi tieu credit, dung nhu truoc.
  let tenBrand = String(brandName ?? '').trim();
  if (!doanTuLink) await damBaoBrand(tenBrand);

  // Nguoi da co contact tren brand nay roi thi lan reveal nay phai mien phi -
  // dung loi UI da hua ("revealing the same person again later is free").
  // Truoc day amount tinh tren TOAN BO uids khong phan biet moi/cu, nen bam
  // lai reveal (vo y bam hai lan, F5 giua chung, hai tab cung mo mot ket qua
  // cu) van bi tru credit lan nua cho nguoi da tra tien roi. Chi loc duoc o
  // duong co brand ro tu dau (doanTuLink chi co dung 1 uid va chua biet brand
  // nen bo qua, giu nguyen hanh vi cu cho truong hop do).
  let uidsMoi = uids.map(String);
  if (!doanTuLink) {
    const { data: brandRow0 } = await admin.from('brand').select('id')
      .eq('name_key', nameKey(tenBrand)).maybeSingle();
    if (brandRow0?.id) {
      const { data: daCo } = await admin.from('contact')
        .select('external_uid, linkedin_url').eq('brand_id', brandRow0.id);
      const daCoSet = new Set((daCo ?? []).map((r: any) => r.external_uid).filter(Boolean));

      // Duong DAN LINK cung phai duoc mien phi lan hai.
      //
      // Bo loc tren so `external_uid`, ma khi PIC dan link thi `uids` chua
      // URL con trong DB la uid hex - khong bao gio khop, nen dan lai link cua
      // nguoi DA CO van bi tru credit lan nua, trai voi dung loi UI da hua.
      //
      // So bang khoa LinkedIn da chuan hoa thi khop duoc: `linkedin_url` cua
      // contact va duong link PIC dan deu tro ve cung mot profile. Do tren du
      // lieu that: 98/107 duong link da dan tim ra dung contact cua no. Phan
      // con lai chi khien lan reveal do bi tinh tien nhu hien nay, khong sinh
      // ra hong moi; con khop nham nguoi khac thi khong xay ra duoc, vi slug
      // LinkedIn la duy nhat cho moi nguoi.
      const linkDaCo = new Set(
        (daCo ?? []).map((r: any) => khoaLinkedin(r.linkedin_url)).filter(Boolean),
      );

      uidsMoi = uidsMoi.filter((u) => {
        if (daCoSet.has(u)) return false;
        const k = khoaLinkedin(u);
        return !(k && linkDaCo.has(k));
      });
    }
  }

  // Contact tu bo da xac minh tay khong goi API, nen khong tinh credit.
  const isFree = source === 'seed_verified';
  const amount = isFree ? 0 : uidsMoi.length;

  const { data: job, error: jobErr } = await admin
    .from('job')
    .insert({
      kind: 'reveal',
      status: 'queued',
      category_id: categoryId,
      payload: {
        brand_id: brandId ?? null, brand: tenBrand || null, uids,
        source: source ?? 'signalhire',
        brand_tu_link: doanTuLink,
      },
      created_by: user.id,
    })
    .select('id')
    .single();
  if (jobErr) throw jobErr;
  jobId = job.id;

  if (amount > 0) {
    const held = await reserveCredit({
      categoryId,
      brandId: brandId ?? null,
      jobId: job.id,
      amount,
      userId: user.id,
    });
    if (held.ok) daGiuCho = true;

    if (!held.ok) {
      await admin.from('job')
        .update({ status: 'failed', error: `credit ${held.reason}` }).eq('id', job.id);

      return NextResponse.json(
        {
          error: held.reason === 'no_budget'
            ? 'This category has no budget for this month yet. Ask an admin to grant one before revealing.'
            : held.reason === 'not_your_category'
            ? "That category isn't yours. Ask its owner for credits on the Credits page."
            : `Not enough credits left. You need ${held.needed} but only ${held.remaining} remain. Use "Request more credits" to ask a teammate or an admin.`,
          remaining: held.remaining,
        },
        { status: 403 },
      );
    }
  }

  await admin.from('job').update({ status: 'running' }).eq('id', job.id);

  // --- Goi SignalHire ngay tai day ----------------------------------------
  const { apikey } = await loadSettings();
  if (!apikey) {
    if (amount > 0) await releaseCredit(job.id, 'chua co SignalHire API key');
    await admin.from('job').update({ status: 'failed', error: 'chua co API key' }).eq('id', job.id);
    return NextResponse.json(
      { error: 'No SignalHire API key is set. Nothing was charged. Ask an admin to add one.' },
      { status: 503 });
  }

  const out = await revealUids(apikey, uids.map(String));

  if (!out.ok) {
    // Tra credit lai NGAY. Khong con callback nao de doi nua.
    if (amount > 0) await releaseCredit(job.id, `SignalHire ${out.status}: ${out.message}`);
    await admin.from('job')
      .update({ status: 'failed', error: `SignalHire ${out.status}` }).eq('id', job.id);
    await baoChoNguoi(user.id, {
      kind: 'reveal_failed',
      title: `Reveal failed for ${tenBrand || 'the pasted LinkedIn link'}`,
      body: `${out.status}: ${out.message}`.trim()
        + `. ${amount > 0 ? 'The credits were put back.' : 'Nothing was charged.'}`,
      link: brandId ? `/brand/${brandId}` : null,
    });
    return NextResponse.json(
      { error: `The lookup failed (${out.status}). Nothing was charged. ${out.message}`.trim() },
      { status: 502 });
  }

  // --- Ghi contact vao brand ----------------------------------------------
  //
  // Duong link: gio moi biet ho lam o dau, nen lay tu ket qua ra lam brand.
  // SignalHire khong tra ve cong ty thi van phai co cho de contact, khong duoc
  // vut di mot nguoi da tra tien. Doi lai phai dat mot cai ten noi that la app
  // khong biet, de PIC nhin thay va doi lai, chu khong am tham nhet vao mot
  // brand nao do.
  if (doanTuLink) {
    tenBrand = String(out.people[0]?.company ?? '').trim() || 'Unsorted from LinkedIn links';
    await damBaoBrand(tenBrand);
    await admin.from('job')
      .update({ payload: { brand_id: null, brand: tenBrand, uids, source: source ?? 'signalhire', brand_tu_link: true } })
      .eq('id', job.id);
  }

  const { data: brandRow } = await admin
    .from('brand').select('id').eq('name_key', nameKey(tenBrand)).maybeSingle();

  // Nguoi nao trong ket qua la do DAN LINK vao, de dat dung `source`.
  //
  // KHONG duoc hoi `person.uid.startsWith('http')` nhu truoc: `person.uid` la
  // uid hex do SignalHire tra ve, con duong link chi nam o `uids` cua REQUEST.
  // Dieu kien cu khong bao gio dung, nen `pasted_linkedin` la mot nhan CHET -
  // da kiem tren DB that: 125 contact vao bang duong dan link deu dang mang
  // nhan 'signalhire', va bang contact khong co lay mot dong pasted_linkedin
  // nao. Phan giai thich "Wasted" tren /admin chi dich danh duong dan link la
  // nguon hut credit chinh, trong khi cot do khong the nao sang len duoc.
  //
  // `doanTuLink` o tren KHONG thay the duoc cho nay: no doi them !brandName,
  // nen chi dung cho 16 job dan link ma chua biet brand. 127 job dan link con
  // lai deu da biet brand tu truoc.
  const uidDaDan = new Set(uids.map(String).filter((u) => u.startsWith('http')));
  const moiUidLaLink = uidDaDan.size > 0 && uidDaDan.size === uids.length;

  let saved = 0;
  if (brandRow?.id) {
    for (const person of out.people) {
      const row = {
        brand_id: brandRow.id,
        full_name: person.name,
        job_title: person.title,
        company: person.company,
        email: person.email,
        phone: person.phone,
        linkedin_url: person.linkedin,
        location: person.location,
        bio: person.bio,
        org_rank: rankOf(person.title ?? ''),
        // `isFree` xet TRUOC: bo seed da xac minh tay thi luon la
        // 'seed_verified', khong duoc de phong doan "dan link" ghi de len.
        source: isFree
          ? 'seed_verified'
          : ((moiUidLaLink || uidDaDan.has(String(person.uid))) ? 'pasted_linkedin' : 'signalhire'),
        external_uid: person.uid || null,
        revealed_by: user.id,
      };

      // contact_uid_idx la partial index nen ON CONFLICT khong tro toi duoc.
      // Tra truoc roi quyet dinh insert hay update, giong /api/ingest.
      let dupId: string | null = null;
      if (row.external_uid) {
        const { data } = await admin.from('contact').select('id')
          .eq('brand_id', brandRow.id).eq('external_uid', row.external_uid).maybeSingle();
        dupId = data?.id ?? null;
      }
      if (!dupId) {
        // So ten KHONG phan biet hoa thuong. `.eq()` phan biet, nen hai dong
        // chi khac moi kieu viet hoa lot qua thanh hai contact: tren DB that
        // brand Iunik dang giu ca "marketing iunik" lan "Marketing iUNIK",
        // hai uid khac nhau, deu khong email khong phone.
        //
        // So TRONG BO NHO chu KHONG dung `.ilike()`. `_` va `%` la ky tu dai
        // dien cua LIKE, va PostgREST nuot dau `\` nen khong escape duoc -
        // da thu tren DB that: `ilike('_arketing iUNIK')` khop ca hai dong
        // "Marketing iUNIK", con `ilike('\_arketing iUNIK')` cho ra y het.
        // Bang contact dang co mot ten chua dau gach duoi, tuc reveal nguoi do
        // co the khop nham mot nguoi khac cung brand va GHI DE len dong cua ho.
        //
        // Cung tranh luon `.maybeSingle()`: no nem loi khi brand da co san hai
        // dong trung hoa thuong nhu Iunik, lam hong ca lan reveal.
        const { data } = await admin.from('contact')
          .select('id, full_name')
          .eq('brand_id', brandRow.id)
          .order('created_at', { ascending: true });
        // Mot brand chi co vai chuc contact nen khong can phan trang o day.
        const chuanTen = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
        const can = chuanTen(person.name);
        dupId = can
          ? ((data ?? []).find((r: any) => chuanTen(r.full_name) === can)?.id ?? null)
          : null;
      }

      const { data: rec, error: cErr } = dupId
        ? await admin.from('contact').update(row).eq('id', dupId).select('id').single()
        : await admin.from('contact').insert(row).select('id').single();

      if (cErr) { console.error('[reveal] khong luu duoc contact:', cErr.message); continue; }
      saved++;

      // Noi nguoc ve ung vien da quet, de man ket qua khoa o tick lai va PIC
      // khong tra credit lan hai cho cung mot nguoi.
      if (rec?.id && row.external_uid) {
        await admin.from('scan_candidate')
          .update({ contact_id: rec.id })
          .eq('external_uid', row.external_uid).is('contact_id', null);
      }
    }
  } else {
    console.error('[reveal] khong tim thay brand sau khi upsert:', tenBrand);
  }

  // --- Hoc alias tu contact vua luu ----------------------------------------
  //
  // Tren LinkedIn nguoi ta khai phap nhan chu quan chu khong khai brand truc
  // thuoc, nen voi brand con thi tim thang bang ten brand tra ve 0 nguoi va
  // duong hoc alias tu ket qua tim kiem khong co gi de hoc. Contact vua luu o
  // tren thi co: `company` cua ho chinh la ten phap nhan can tim.
  //
  // Doc LAI ca brand chu khong chi dung `out.people` cua lan nay: mot lan dan
  // link thuong chi mang ve mot nguoi, khong du dong thuan de ket luan gi.
  //
  // Khong duoc lam hong lan reveal neu buoc nay loi - contact da luu roi, hoc
  // duoc hay khong la chuyen cua lan quet sau.
  if (brandRow?.id && tenBrand) {
    try {
      const { data: dsContact } = await admin
        .from('contact').select('company').eq('brand_id', brandRow.id);
      await hocAliasTuContact({
        brand: tenBrand,
        tenCongTy: (dsContact ?? []).map((r: any) => r.company),
      });
    } catch (e: any) {
      console.error('[reveal] khong hoc duoc alias tu contact:', e?.message ?? e);
    }
  }

  // --- Chot credit ---------------------------------------------------------
  // SignalHire chi tinh tien nguoi co email hoac phone. Nguoi chi co ten la
  // mien phi, nen chi dem nguoi co lien he that vao so tien phai chot.
  // commitCredit tu ha so tien neu thuc te it hon luc dat cho va ghi lai chenh
  // lech vao note.
  // Chi dem nguoi vua duoc TINH TIEN (uidsMoi) - nguoi da co contact tu truoc
  // van co the nam trong out.people (SignalHire lam moi du lieu cho ho), nhung
  // khong duoc gop vao so phai chot vi ho khong nam trong amount da dat cho.
  //
  // `uidsMoi.includes(p.uid)` KHONG dung duoc cho duong dan link: luc do
  // `uids` chua mot URL, con `p.uid` la uid hex SignalHire tra ve, nen phep so
  // luon sai va `billable` ra 0. Hau qua da do duoc tren DB that: 130 lan
  // reveal bang duong dan link luu ve 125 contact, nhung credit_ledger chi chot
  // 4 credit - 126 credit con lai bi tra lai voi ghi chu "nothing billable"
  // trong khi SignalHire van tru tien that.
  //
  // Doi chieu so du xac nhan: so du tut 2000 ke tu moc, tru 1453 cua lan sut
  // khong giai thich duoc hom 01/10 con 547 - khop voi 548 contact co email
  // hoac phone, chu khong khop voi 504 credit so sach dang ghi. Tuc so sach
  // dang thieu khoang 44 credit, dung bang phan cua duong dan link.
  //
  // Voi duong dan link thi moi nguoi tra ve deu la nguoi vua dat cho: bo loc
  // `uidsMoi` o tren cung bo qua nhanh nay (xem ghi chu cho `uidsMoi`), nen
  // khong co ai "da co tu truoc" de phai loai ra.
  const billable = out.people.filter(
    (p) => (moiUidLaLink || uidsMoi.includes(p.uid))
      && ((p.email ?? '').trim() !== '' || (p.phone ?? '').trim() !== '')
  ).length;
  // Khong duoc chot nhieu hon so da dat cho: commitCredit chi ha xuong, khong
  // nang len, nhung chan o day cho ro y.
  if (amount > 0) await commitCredit(job.id, Math.min(billable, amount));

  await admin.from('job').update({
    status: 'done',
    result: { asked: uids.length, found: out.people.length, saved },
    updated_at: new Date().toISOString(),
  }).eq('id', job.id);

  // Da tra tien ma khong ghi duoc vao ho so. Truoc day cho nay chi console.error,
  // tuc la tien di mat ma khong ai o phia nguoi dung biet. Day la loi dat nhat
  // trong ca app nen no phai keu.
  if (saved < out.people.length) {
    await baoChoNguoi(user.id, {
      kind: 'reveal_lost',
      title: `${out.people.length - saved} revealed contact${out.people.length - saved === 1 ? '' : 's'} could not be saved`,
      body: `${tenBrand}: paid for ${out.people.length}, saved ${saved}. `
        + 'The credits were already spent, so tell Khoa before revealing these people again.',
      link: brandId ? `/brand/${brandId}` : null,
    });
  }

  return NextResponse.json({
    jobId: job.id,
    asked: uids.length,
    found: out.people.length,
    charged: isFree ? 0 : out.people.length,
  });
  } catch (err: any) {
    // Luoi an toan cuoi cung. Neu da lo tao job va giu cho credit thi phai
    // don dep NGAY, khong duoc de treo - xem ghi chu o dau try.
    // releaseCredit chi doi status='reserved' nen goi lai o day la an toan du
    // credit da 'committed' tu truoc do (khong khop dieu kien, khong lam gi).
    const loi = String(err?.message ?? err ?? 'unknown error').slice(0, 300);
    console.error('[reveal] loi khong luong truoc, da don dep job/credit:', loi);
    if (jobId) {
      const admin = supabaseAdmin();
      if (daGiuCho) await releaseCredit(jobId, `crash: ${loi}`).catch((e) =>
        console.error('[reveal] khong tra duoc credit sau crash:', e?.message ?? e));
      await admin.from('job')
        .update({ status: 'failed', error: `crash: ${loi}` }).eq('id', jobId)
        .then(({ error }) => { if (error) console.error('[reveal] khong ghi duoc job failed:', error.message); });
    }
    return NextResponse.json(
      { error: 'Something went wrong while revealing. Any reserved credits have been released - nothing was left charged.' },
      { status: 500 },
    );
  }
}
