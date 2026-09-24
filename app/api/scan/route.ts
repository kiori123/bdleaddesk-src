import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { loadSettings, searchBrand, ghiAliasHocDuoc } from '@/lib/signalhire';
import { scoreCandidate, extractTerms, type Prefs } from '@/lib/rank';
import { nameKey } from '@/lib/nameKey';
import { baoChoNguoi } from '@/lib/notify';
import { canUseCategory } from '@/lib/credit';
import {
  planScan, resetsAtFromPeriodStart, CALLS_PER_COMPANY_WORST_CASE, MAX_BRAND_MOI_LAN,
} from '@/lib/scanQuota';

// Moi brand la mot lan goi SignalHire, moi lan chung 1 den 3 giay. Mac dinh 10s
// cua Vercel khong du cho vai brand.
export const maxDuration = 60;

// MAX_BRAND_MOI_LAN: xem lib/scanQuota.ts. Dat o do, khong phai o day, vi
// Results.tsx can dung con so nay trong copy "N brand chua duoc quet".

/**
 * BD bam scan. Chan o cua vao: category het credit thi khong cho chay,
 * chua ton credit nao ca.
 *
 * Reveal la mot duong rieng (/api/reveal), vi do moi la luc credit bi tieu.
 *
 * Ngoai han muc credit theo thang, con HAI tran theo cua so 24 gio truot,
 * dung chung ca team:
 *   - 300 brand   : biet ngay tai day
 *   - 6000 profile: chi biet khi n8n callback ve, nen dong search_usage tao o
 *                   day voi profiles = 0 roi /api/webhooks/n8n cap nhat sau
 *
 * Hai tran nay khong phai de tiet kiem tien. Search khong ton credit. Chung de
 * khong dam vao quota ngay cua SignalHire va khong bi chan giua buoi.
 */
export async function POST(req: NextRequest) {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { categoryId, brands, location, role, keywords, linkedinUrls, prefs, skipScanned }
    = await req.json();
  if (!categoryId) return NextResponse.json({ error: 'Pick a category first.' }, { status: 400 });
  if (!Array.isArray(brands) || brands.length === 0) {
    return NextResponse.json({ error: 'No brand was given.' }, { status: 400 });
  }

  // Scan khong ton credit, nhung ton tran ngay cua SignalHire (300 brand,
  // 6000 profile) dung chung ca team. Khong the de mot PIC dam tran do duoi
  // nhan mot category khong phai cua ho.
  if (!(await canUseCategory(db, user.id, categoryId))) {
    return NextResponse.json(
      { error: "That category isn't yours. Pick one of your own categories to scan under." },
      { status: 403 });
  }

  // role nhan ca chuoi lan mang, vi ban cu gui mot chuoi. Sau khi moi nguoi da
  // dung ban moi thi nhanh chuoi coi nhu thua, nhung bo no ngay bay gio thi mot
  // tab dang mo tu truoc luc deploy se lang le tim sai nhom chuc vu.
  const dsRole: string[] = Array.isArray(role)
    ? role.map(String).filter(Boolean)
    : (typeof role === 'string' && role.trim() && role !== 'Decision makers, all functions'
      ? [role.trim()] : []);

  // --- Bo qua brand da co nguoi tren he thong -------------------------------
  //
  // Form n8n cu co lua chon nay va mac dinh bat. Bo di la moi lan quet lai mot
  // danh sach cu deu dam vao tran 300 brand mot ngay, va co the reveal lai
  // dung nguoi da tra tien roi.
  //
  // Loc TRUOC khi kiem tra han muc, vi brand bi bo qua thi khong goi SignalHire,
  // nen khong duoc tinh vao so brand dem so voi tran.
  const boQua = skipScanned !== false;
  const tenGoc = (brands as any[]).map((b) => String(b?.name ?? '').trim()).filter(Boolean);
  const daCo = new Set<string>();

  if (boQua && tenGoc.length) {
    const khoa = tenGoc.map(nameKey).filter(Boolean);
    // Chi tinh la "da quet" khi brand co it nhat mot contact. Brand tao ra roi
    // de trong khong tinh, vi do dung la truong hop can quet lai.
    const { data: coSan } = await db
      .from('brand')
      .select('name_key, contact(id)')
      .in('name_key', khoa);

    for (const b of (coSan ?? []) as any[]) {
      if (Array.isArray(b.contact) && b.contact.length > 0) daCo.add(String(b.name_key));
    }
  }

  const brandsCanQuet = (brands as any[])
    .filter((b) => !daCo.has(nameKey(String(b?.name ?? ''))));
  const tenBiBoQua = tenGoc.filter((n) => daCo.has(nameKey(n)));

  // Bo qua het thi dung han o day. Khong tao job, khong dem han muc, khong goi
  // SignalHire. Quan trong nhat la phai NOI RA: mot man hinh khong ket qua ma
  // khong giai thich thi PIC tuong app hong va bam lai lan nua.
  if (brandsCanQuet.length === 0) {
    return NextResponse.json(
      {
        error:
          `Nothing to search. ${tenBiBoQua.length === 1 ? 'This brand is' : 'These brands are'} `
          + `already on file with contacts: ${tenBiBoQua.join(', ')}. `
          + `Open the brand to see who is there, or untick "Skip brands already on file" to search again.`,
        skipped: tenBiBoQua,
      },
      { status: 409 });
  }

  const { data: status } = await db
    .from('category_credit_status')
    .select('category_name, granted, remaining')
    .eq('category_id', categoryId).single();

  if (!status || status.granted === 0) {
    return NextResponse.json(
      { error: `${status?.category_name ?? 'This category'} has no budget for this month yet. Ask an admin to grant one before scanning.` },
      { status: 403 });
  }
  if (status.remaining <= 0) {
    return NextResponse.json(
      { error: `${status.category_name} has used up its credits for this month. Use "Request more credits" to ask an admin.` },
      { status: 403 });
  }

  // --- hai tran cua SignalHire ---------------------------------------------
  // Cham mot trong hai la HO khoa ca tai khoan 24 tieng, khong phai nha dan.
  // Nen o day chan truoc, de team khong tu dam vao tuong.
  const { data: quota, error: quotaErr } = await db.rpc('my_quota');

  // KHONG BAO GIO thay so con lai chua biet bang Infinity. RPC loi, hoac tra
  // ve mot hinh dang khac ky vong (thieu brand/profile/dang_khoa/ky_bat_dau),
  // thi phai dung han lai (503) chu khong duoc coi nhu "khong gioi han" -
  // that bai kieu do se mo toang scan khong tran.
  const quotaHopLe = !quotaErr && quota
    && typeof quota.dang_khoa === 'boolean'
    && typeof quota.ky_bat_dau === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(quota.ky_bat_dau)
    && quota.brand && typeof quota.brand.team_con_lai === 'number'
    && quota.profile && typeof quota.profile.team_con_lai === 'number';

  if (!quotaHopLe) {
    return NextResponse.json(
      { error: 'Could not check the daily scan limit right now. Nothing was scanned. Try again in a moment.' },
      { status: 503 });
  }

  if (quota.dang_khoa) {
    const moKhoa = new Date(quota.mo_khoa_luc);
    const conLai = Math.max(0, Math.ceil((moKhoa.getTime() - Date.now()) / 3_600_000));
    return NextResponse.json(
      {
        error:
          `Searching is locked because the team hit the ${quota.khoa_vi === 'brand' ? 'brand' : 'profile'} limit. ` +
          `SignalHire locks the whole account for 24 hours once either limit is reached. ` +
          `It unlocks in about ${conLai} hour${conLai === 1 ? '' : 's'}, at ${moKhoa.toLocaleString('vi-VN')}. ` +
          `Revealing contacts already found still works.`,
        lockedUntil: quota.mo_khoa_luc,
      },
      { status: 429 });
  }

  // ky_bat_dau la DB tinh (ngay lich VN cua ky hien tai) - chi cong 1 ngay
  // vao gia tri do, khong tu hoi lai "bay gio la may gio o VN" mot lan nua.
  const resetsAt = resetsAtFromPeriodStart(quota.ky_bat_dau);

  // Doc key va bang alias SOM, truoc khi kiem tran. Ly do: brand co alias co the
  // ton HAI luot chu khong phai mot, vi neu alias tra ve rong thi searchBrand se
  // tim lai bang chinh ten brand. Dem thieu o day thi lan quet cuoi cung lam ca
  // team bi khoa 24 tieng, dung cai ma cho chan nay sinh ra de tranh.
  const { apikey, aliases } = await loadSettings();

  // Cach nay khong chan atomically: hai request cung luc co the cung doc
  // cung mot so con lai, cung thay du cho, roi cong lai vuot tran. check_quota_trip
  // (trigger AFTER tren search_usage) van la luoi chan cuoi cho truong hop do -
  // xem ghi chu o /can_use_category.sql va bao cao kem theo ve item nay.
  const plan = planScan({
    brands: brandsCanQuet,
    // TRUONG HOP XAU NHAT so lan goi SignalHire brand nay co the ton, KHONG
    // phai so luot-han-muc co y nghia rieng nhu ban cu (1 hoac 2). Thiet ke
    // hai lan goi moi cong ty (kham pha + thu hep, xem searchBrand()): brand
    // khong alias toi da CALLS_PER_COMPANY_WORST_CASE lan (tim 1 cong ty);
    // brand co alias tro toi N cong ty toi da N * CALLS_PER_COMPANY_WORST_CASE,
    // cong them CALLS_PER_COMPANY_WORST_CASE cho lan thu lai bang ten brand
    // (chi xay ra khi TAT CA N cong ty deu khong co trong chi muc SignalHire -
    // uoc luong o day khong biet truoc dieu do nen phai gia dinh co the xay ra).
    costOfBrand: (b: any) => {
      const ds = aliases.get(nameKey(String(b?.name ?? '')));
      const soCongTy = ds?.length || 1;
      const coAlias = Boolean(ds?.length);
      return soCongTy * CALLS_PER_COMPANY_WORST_CASE + (coAlias ? CALLS_PER_COMPANY_WORST_CASE : 0);
    },
    quota: {
      brandRemaining: quota.brand.team_con_lai,
      // profileRemaining tinh tu costOfBrand (so luot goi) nhan PROFILES_PER_CALL
      // ngay trong planScan() - xem ghi chu o lib/scanQuota.ts. Day van chi la
      // uoc luong TRUOC KHI SignalHire tra ve, khong phai so that.
      profileRemaining: quota.profile.team_con_lai,
    },
    maxBrandsPerRequest: MAX_BRAND_MOI_LAN,
    resetsAt,
  });

  if (plan.status === 'blocked') {
    return NextResponse.json(
      {
        error:
          `No brand scans are left today (${Math.max(0, Math.floor(plan.brandRemaining))} remaining). ` +
          `It resets at midnight Vietnam time.`,
        resetsAt: plan.resetsAt,
      },
      { status: 429 });
  }

  if (plan.status === 'confirm') {
    // Chua quet gi ca. PIC phai tu bam xac nhan, gui lai dung danh sach da
    // duoc de xuat (wouldScan) - lan gui lai do se chay qua LAI chinh doan
    // logic nay, doc lai my_quota() moi tinh, khong tin bat cu gi tu lan nay.
    return NextResponse.json({
      needsConfirmation: true,
      asked: plan.asked,
      wouldScan: plan.wouldScanNames,
      remaining: { brands: plan.brandRemaining, profiles: plan.profileRemaining },
      resetsAt: plan.resetsAt,
    });
  }

  const admin = supabaseAdmin();
  const { data: job, error } = await admin
    .from('job')
    .insert({
      kind: 'search', status: 'queued', category_id: categoryId,
      // prefs nam trong payload chu KHONG di sang n8n. Do la mo uoc de xep hang
      // tai cho luc ket qua ve, khong phai dieu kien tim. Cat cung job vi diem
      // phai gan lien voi thu nguoi ta da hoi trong chinh lan quet nay.
      // Giu ca danh sach PIC go vao lan danh sach thuc su quet, va ten bi bo
      // qua. Sau nay nhin lai mot job cu ma chi thay danh sach da loc thi khong
      // hieu duoc vi sao thieu brand.
      payload: {
        brands, location, role, linkedinUrls,
        prefs: { ...(prefs ?? {}), keywords: keywords ?? null },
        scanned: brandsCanQuet.map((b: any) => b?.name),
        skipped: tenBiBoQua,
        roles: dsRole,
      },
      created_by: user.id,
    })
    .select('id').single();
  if (error) throw error;

  await admin.from('job').update({ status: 'running' }).eq('id', job.id);

  // --- Goi SignalHire ngay tai day, khong qua n8n --------------------------
  if (!apikey) {
    await admin.from('job')
      .update({ status: 'failed', error: 'chua co SignalHire API key' }).eq('id', job.id);
    await baoChoNguoi(user.id, {
      kind: 'scan_failed',
      title: 'Search could not run: no API key',
      body: 'There is no SignalHire API key saved. An admin needs to add one under Admin, Settings. '
        + 'Nothing was charged.',
      link: '/admin',
    });
    return NextResponse.json(
      { error: 'No SignalHire API key is set. Ask an admin to add one under Admin, Settings.' },
      { status: 503 });
  }

  // Cat bot cho lan quet ket thuc kip maxDuration. Truoc day cat trong im lang:
  // upload mot file 40 dong thi 32 dong bien mat, man ket qua khoe 8 brand va
  // khong co gi noi 32 cai kia da di dau. Nay ke ten ra.
  //
  // plan.status === 'fits' den day: hai nhanh 'blocked'/'confirm' da return o
  // tren. planScan da tu ap tran MAX_BRAND_MOI_LAN ben trong roi (dsBrand
  // KHONG duoc slice lai o day nua - lam vay la hai tang cat chong len nhau,
  // banner "Scan these N now" se hua nhieu hon so thuc su chay). dsBrand =
  // plan.toScan nguyen ven; conLai la phan con lai cua brandsCanQuet, tinh
  // theo DO DAI THUC TE cua plan.toScan chu khong phai hang so
  // MAX_BRAND_MOI_LAN, vi han muc ngay co the da cat ngan hon ca con so do.
  const dsBrand = plan.toScan;
  const conLai = brandsCanQuet.slice(plan.toScan.length)
    .map((b: any) => String(b?.name ?? '').trim()).filter(Boolean);

  // Chay song song. Moi brand mot lan goi doc lap, khong ai cho ai.
  const vungTim = String(location ?? 'Vietnam and Southeast Asia');
  const tuKhoa = String(keywords ?? '').trim();

  const ketQua = await Promise.all(dsBrand.map((b: any) => searchBrand({
    apikey,
    brand: String(b?.name ?? '').trim(),
    tier: Number.isFinite(Number(b?.tier)) ? Number(b.tier) : 1,
    aliases,
    region: vungTim,
    roles: dsRole,
    keywords: tuKhoa,
  })));

  // Hoc alias tu ket qua that. Chay song song va khong duoc phep lam hong lan
  // quet: ket qua da nam trong tay roi, hoc duoc hay khong la chuyen cua lan sau.
  const aliasMoi = (await Promise.all(
    ketQua
      .filter((r) => !r.problem && r.candidates.length > 0)
      .map((r) => ghiAliasHocDuoc({
        brand: r.brand,
        candidates: r.candidates,
        fellBack: r.fellBack,
        aliasCompany: r.aliasCompany,
      }).catch(() => null)),
  )).filter(Boolean) as { alias: string; employer: string; n: number }[];

  // Cham diem NGAY LUC NAY. Mo uoc nam trong payload cua chinh lan quet do, nen
  // diem gan lien voi thu nguoi ta da hoi. Sua trong so ve sau khong lam xao
  // tron thu tu cua nhung lan quet cu.
  //
  // BAT BIEN, chuyen tu rankAll() (lib/rank.ts, da xoa vi khong con noi nao
  // goi) sang day - day moi la noi THAT SU cham diem: chi duoc CONG DIEM,
  // khong bao gio LOAI ung vien ra khoi rows. Mot brand it nguoi thi PIC muon
  // thay HET, khong phan biet chuc danh/vung/tu khoa - moi mo uoc duoi day chi
  // doi thu tu, khong bao gio lam mot candidate trong r.candidates bien mat
  // khoi rows.
  const p = (prefs ?? {}) as Prefs;
  const keywordTermsChung = extractTerms(tuKhoa);
  const rows = ketQua.flatMap((r) => r.candidates.map((c) => {
    // Rieng cho brand nay: them chinh ten brand vao danh sach cum tu khop
    // skills/experience - nguoi lam "Financial Planning - Seasoning (Nam Ngu,
    // Chin-su, Tam Thai Tu)" phai duoc tinh cho brand Chin-su du cong ty hien
    // tai la Masan Consumer (ten cong ty da mapped, khac ten brand).
    const pBrand: Prefs = { ...p, region: vungTim, keywordTerms: [...keywordTermsChung, r.brand] };
    const { score, reasons } = scoreCandidate(c as any, pBrand);
    return {
      job_id: job.id,
      brand_id: null,
      brand_name: r.brand,
      external_uid: c.external_uid,
      full_name: c.full_name,
      job_title: c.job_title,
      company: c.company,
      location: c.location,
      years_in_role: c.years_in_role,
      open_to_work: c.open_to_work,
      skills: c.skills,
      raw: c.raw,
      score,
      score_reasons: reasons,
    };
  }));

  // Link LinkedIn dan tay: khong qua search nen khong an vao tran ngay.
  for (const u of (Array.isArray(linkedinUrls) ? linkedinUrls : [])) {
    const url = String(u ?? '').trim();
    if (!url) continue;
    rows.push({
      job_id: job.id, brand_id: null,
      brand_name: dsBrand[0]?.name ?? 'Pasted links',
      external_uid: url, full_name: url,
      job_title: 'From a pasted LinkedIn link',
      company: null, location: null, years_in_role: null,
      open_to_work: false, skills: null, raw: { pasted: true },
      score: 0, score_reasons: [],
    } as any);
  }

  if (rows.length) {
    const { error: candErr } = await admin
      .from('scan_candidate')
      .upsert(rows, { onConflict: 'job_id,external_uid', ignoreDuplicates: true });
    if (candErr) console.error('[scan] khong ghi duoc scan_candidate:', candErr.message);
  }

  // Ca loat deu hong thi bao that bai. Mot vai brand hong ma van co nguoi ve thi
  // van la thanh cong: PIC thay duoc phan tim duoc, phan hong ghi trong error.
  const hong = ketQua.filter((r) => r.problem);
  const totalNguoi = rows.length;
  // Rieng cho tran ngay cua SignalHire (search_usage.profiles, xem duoi): CHI
  // dem nguoi SignalHire that su tra ve. totalNguoi o tren dung cho response/
  // scan_candidate va CO GOM link dan tay - neu dung chung ca cho profiles thi
  // moi lan dan link se lam dong ho tran ngay chay nhanh hon that, trai voi
  // dung y "link dan tay khong an vao tran ngay" o vong for ben duoi.
  const profilesTuSignalHire = ketQua.reduce((n, r) => n + r.candidates.length, 0);
  const thatBai = hong.length > 0 && totalNguoi === 0;

  // MOT cho duy nhat dinh dang loi cho nguoi doc (job.error + hai thong bao
  // ben duoi) - truoc day ba noi tu viet lai `message || status`, tuc mat
  // status bat cu khi nao message co chu. Gio LUON in ca hai: khong biet duoc
  // SignalHire tra 429 (nen cho, tu rut lui) hay 500 (khong lien quan toc do
  // goi) neu status bi giau di dang sau mot cau chu, dung nhu vu SHEGLAM -
  // job.error rong khong phai vi khong co loi, ma vi ban cu (da sua) nuot mat
  // loi do truoc khi kip ghi.
  const taLoi = (r: (typeof ketQua)[number]) =>
    `${r.brand}: [${r.problem!.status}] ${r.problem!.message || '(no message)'}`;

  await admin.from('job').update({
    status: thatBai ? 'failed' : 'done',
    error: hong.length
      ? hong.map(taLoi).join(' · ').slice(0, 500)
      : null,
    result: {
      brands: ketQua.map((r) => ({
        brand: r.brand, mapped: r.mapped, found: r.candidates.length,
        company: r.company, fellBack: r.fellBack, aliasCompany: r.aliasCompany,
        // total/outcome: de PIC phan biet "khong co trong SignalHire" voi
        // "cong ty nho, da lay het" voi "cong ty lon, da loc o nguon" - xem
        // Results.tsx. total null nghia la khong biet (moi lan goi deu loi).
        total: r.total, outcome: r.outcome,
        // filterSkipped: co hua loc ma khong loc duoc khong - xem
        // CongTyResult.filterSkipped. Man ket qua can no de khong noi
        // "narrowed at the source" cho mot danh sach chua he duoc loc.
        filterSkipped: r.filterSkipped,
        // status: ma HTTP that SignalHire tra ve khi co loi, null khi khong
        // co loi. Truoc day khong duoc luu o dau ca - job.error chi giu status
        // khi message rong (xem taLoi o tren), nen khong the biet duoc vi du
        // loi "concurrency" (xem CLAUDE.md/bao cao SHEGLAM) tra ve 429 hay 500
        // ma khong doc lai tung dong error bang tay. Chua co man hinh nao doc
        // truong nay - dat san de tra cuu/phan tich sau nay (vi du dung nhu
        // cach dieu tra vu SHEGLAM: doc lai job.result qua PostgREST).
        status: r.problem?.status ?? null,
      })),
      skipped: tenBiBoQua,
      notRun: conLai,
      aliasHoc: aliasMoi,
    },
    updated_at: new Date().toISOString(),
  }).eq('id', job.id);

  // Nhat ky han muc. Ghi SAU khi da goi xong nen so profile la so that, khong
  // phai so uoc. Hong o buoc nay khong duoc lam ca lan quet that bai theo.
  const { error: usageErr } = await admin.from('search_usage').insert({
    profile_id: user.id,
    category_id: categoryId,
    job_id: job.id,
    // So luot THAT SU goi di, ke ca lan tim lai. Ghi theo so brand thi dong ho
    // chay cham hon thuc te, va cai chan tran o tren se cho di qua dung luc
    // khong con cho, roi ca team nghi 24 tieng.
    brands: ketQua.reduce((n, r) => n + r.calls, 0),
    profiles: profilesTuSignalHire,
  });
  if (usageErr) console.error('[scan] khong ghi duoc search_usage:', usageErr.message);

  // --- Bao vao chuong -------------------------------------------------------
  //
  // Ba chuyen dang bao, va chi ba chuyen nay. Bao qua nhieu thi PIC quen nhin
  // chuong, luc do bao that cung troi mat.
  //
  // Lan quet thanh cong tron ven KHONG bao: PIC dang dung nhin man hinh ket qua,
  // bao them mot dong nua la thua.
  const rongKhong = ketQua.filter((r) => !r.problem && r.candidates.length === 0);

  if (thatBai) {
    await baoChoNguoi(user.id, {
      kind: 'scan_failed',
      title: `Search failed for ${dsBrand.length === 1 ? dsBrand[0]?.name : `${dsBrand.length} brands`}`,
      body: hong[0].problem!.status === 429
        ? 'The provider daily limit was reached. Nothing was charged. It resets on their side.'
        : hong.map(taLoi).join(' · '),
      link: `/scan/results/${job.id}`,
    });
  } else if (hong.length) {
    // Mot phan hong ma van co nguoi ve. Man hinh ket qua chi khoe phan tim duoc,
    // nen phan hong phai co cho khac noi ra, khong thi no bien mat.
    await baoChoNguoi(user.id, {
      kind: 'scan_partial',
      title: `${hong.length} of ${dsBrand.length} brands could not be searched`,
      body: hong.map(taLoi).join(' · ')
        + '. The rest went through, nothing was charged for the ones that failed.',
      link: `/scan/results/${job.id}`,
    });
  } else if (rongKhong.length) {
    // Thay cho node "Send Manual Review Notification" ben n8n cu.
    await baoChoNguoi(user.id, {
      kind: 'scan_empty',
      title: `No one found for ${rongKhong.length === 1 ? rongKhong[0].brand : `${rongKhong.length} brands`}`,
      body: `${rongKhong.map((r) => r.brand).join(', ')} came back with nobody. `
        + 'Usually the brand is not mapped to the company people actually list as their employer. '
        + 'Add the mapping under Admin, Aliases, then search again. Looking costs nothing.',
      link: '/admin',
    });
  }

  if (thatBai) {
    return NextResponse.json(
      { error: hong[0].problem!.status === 429
          ? 'The daily search limit was reached. Nothing was charged, and it resets on the provider side.'
          : `The lookup failed: ${hong[0].problem!.message || hong[0].problem!.status}` },
      { status: 502 });
  }

  return NextResponse.json({
    jobId: job.id, found: totalNguoi, skipped: tenBiBoQua, notRun: conLai,
  });
}
