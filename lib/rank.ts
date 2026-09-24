import { rankOf, rankLabel, RANK_EXEC, RANK_DIR, RANK_MGR } from '@/lib/orgRank';
import { timVung } from '@/lib/regions';

/**
 * Xep hang ung vien TAI CHO, sau khi SignalHire da tra ket qua ve.
 *
 * Ly do khong day mo uoc nay sang SignalHire lam dieu kien tim: bo loc ben do la
 * CONG CHAN. Go "trade marketing" vao o title thi mot nguoi ten chuc danh la
 * "Head of Digital Commerce" bi loai thang, du do dung la nguoi can tim. Chuc
 * danh o Viet Nam von lon xon, nua Anh nua Viet, moi cong ty dat mot kieu.
 *
 * Search khong ton credit va team moi dung 4% tran, nen lay ve rong roi tu sap
 * la lua chon dung: 47 nguoi tu xep hang tot hon 8 nguoi bi chan san.
 *
 * Moi diem cong deu kem mot cau ly do, vi man hinh phai giai thich duoc vi sao
 * mot nguoi nam o vi tri do. Xep hang khong giai thich duoc thi khong ai tin.
 *
 * BAT BIEN, khong duoc pha: ham scoreCandidate() va noi goi no (rows.flatMap
 * trong app/api/scan/route.ts) chi duoc CONG DIEM, khong bao gio LOAI ung vien
 * ra khoi danh sach. Dat mo uoc nao khong khop thi diem thap hon, khong phai
 * bien mat. Truoc day dieu nay do rankAll() dam nhiem va co test rieng; ham do
 * da bi xoa vi khong con noi nao goi (scan/route.ts tu goi scoreCandidate()
 * roi tu sap, khong qua rankAll()), nhung bat bien thi VAN CON hieu luc o noi
 * dang thuc su chay.
 */

export type Prefs = {
  department?: string | null;
  /**
   * Nhieu nhom chuc vu cung luc. Khop MOT trong so do la duoc diem, khong phai
   * khop het: nguoi vua lam marketing vua lam sales gan nhu khong ton tai, doi
   * khop het la khong ai duoc diem nao.
   *
   * Giu lai truong department mot gia tri o tren cho nhung job cu da luu.
   */
  departments?: string[] | null;
  titleWords?: string[];
  /**
   * Ten mot nguoi cu the dang duoc duoi (man "Get a contact").
   * Cong diem that nang de nguoi do noi len dau, nhung VAN chi la mo uoc: ten
   * viet thieu dau hay dao thu tu ho-ten la chuyen thuong, khong duoc lay lam
   * dieu kien loai nguoi.
   */
  chasing?: string | null;
  /**
   * Cum tu tu do PIC go o o Keywords (xem SearchForm.tsx). Luu nguyen van de
   * hasPrefs() va job.payload doc lai duoc - KHONG dung truong nay de xep hang
   * truc tiep, xem keywordTerms.
   */
  keywords?: string | null;
  /**
   * Danh sach cum tu DA TACH, dung de doi chieu voi skills[] va experience[]
   * luc xep hang. scan/route.ts tu tinh truong nay cho tung brand (tach
   * keywords bang extractTerms() roi them ten brand dang tim vao), KHONG gui
   * tu client va KHONG luu vao job.payload.
   */
  keywordTerms?: string[];
  /**
   * Vung PIC da chon luc quet (VUNG.key trong lib/regions.ts). scan/route.ts
   * tu them truong nay luc xep hang, KHONG luu vao job.payload vi da co san
   * trong payload.location roi.
   */
  region?: string | null;
};

export type Candidate = {
  external_uid: string;
  full_name: string;
  job_title?: string | null;
  company?: string | null;
  location?: string | null;
  years_in_role?: number | null;
  open_to_work?: boolean | null;
  skills?: string[] | null;
  /** Cac cong ty/chuc danh TRONG QUA KHU, tu SignalHire experience[]. */
  experience?: { company: string | null; title: string | null }[] | null;
};

export type Scored = { score: number; reasons: string[] };

/** Bo dau tieng Viet va ha chu thuong, de "Kenh MT" khop "kênh mt". */
export function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tach cum "Keywords" thanh danh sach cum tu THUAN de doi chieu voi skills[]
 * va experience[] luc xep hang.
 *
 * Truong Keywords gui THANG sang SignalHire nen PIC duoc go ca OR/AND/ngoac
 * (vi du `"ecommerce" OR "e-commerce"`) - do la cu phap truy van cua ho, khong
 * phai cua ham nay. O day chi can mot danh sach cum de so KHOP CHUOI CON,
 * khong can hieu dung logic boolean: tach tren OR/AND/ngoac la du, "ecommerce
 * OR e-commerce" thanh hai cum doc lap, khop cum nao cung duoc diem nhu nhau.
 */
export function extractTerms(raw: string | null | undefined): string[] {
  return String(raw ?? '')
    .split(/\bOR\b|\bAND\b|[()]/i)
    .map((w) => w.replace(/"/g, '').trim())
    .filter(Boolean);
}

const W = {
  title: 30,
  department: 20,
  openToWork: -25,
  // Cao han moi thu khac cong lai. Khi da biet ro minh duoi ai thi khong the de
  // mot Giam doc ngau nhien nam tren dung nguoi do.
  name: 120,
  namePart: 60,
  // Ky nang va kinh nghiem qua khu: tin hieu that nhung rong hon chuc danh
  // hien tai, nen thap hon W.title. Kinh nghiem qua khu nhinh hon skill vi no
  // neu dich danh ten cong ty/chuc danh, cu the hon mot tu khoa ky nang chung
  // chung.
  skill: 15,
  experience: 25,
  // Dia diem CHI la diem thuong, khong bao gio la bo loc - xem ghi chu o
  // scoreCandidate. Brand China Project / Cross Border thuong co nguoi quyet
  // dinh nam ngoai vung mac dinh, nen loc cung se mat dung nguoi can tim.
  location: 15,
};

/**
 * Diem thuong theo thang bac, suy tu chinh chuc danh.
 * rankOf tra SO CANG NHO CANG CAO (exec 15, director 30, manager 45, staff 60),
 * nen phai anh xa nguoc lai. Viet thang r * 3 la dao ca bang xep hang.
 */
function seniorityBonus(title: string | null | undefined): { pts: number; label: string | null } {
  const r = rankOf(title);
  if (r <= RANK_EXEC) return { pts: 15, label: rankLabel(r) };
  if (r <= RANK_DIR) return { pts: 12, label: rankLabel(r) };
  if (r <= RANK_MGR) return { pts: 8, label: rankLabel(r) };
  return { pts: 0, label: null };
}

/**
 * Vung PIC chon co khop voi dia diem SignalHire tra ve khong. Chi doi chieu,
 * KHONG loc gi ca - tra ve nhan cua vung khi khop, null khi khong.
 *
 * EXPORT vi man ket qua cung phai tra loi dung cau hoi nay de xep nguoi trong
 * vung len truoc (xem results/[jobId]/actions.ts). Mot ban thu hai cua phep so
 * nay la dung cai bay ma chinh lib/regions.ts da canh bao: hai ban lech nhau
 * thi khong hong ngay, no hong lang le.
 *
 * Dang tin duoc voi du lieu that: SignalHire LUON kem ten quoc gia trong
 * location. Kiem tren 1000 dong scan_candidate dang co (225 dia diem khac
 * nhau): "Viet Nam", "Ho Chi Minh City, Viet Nam", "Hanoi Capital Region, Viet
 * Nam", "Binh Duong, Viet Nam"... - KHONG mot dong nao la ten tinh/thanh tran
 * trui khong co quoc gia, nen khong co nguoi Viet Nam nao bi xep nham ra ngoai
 * vung. Neu ho doi cach ghi thi cho nay la cho hong dau tien.
 */
export function khopVung(location: string | null | undefined, regionKey: string | null | undefined) {
  if (!regionKey || !location) return null;
  const vung = timVung(regionKey);
  if (!vung?.nuoc?.length) return null; // Global / Group headquarters: khong co nuoc de so
  const loc = norm(location);
  return vung.nuoc.some((n) => loc.includes(norm(n))) ? vung.label : null;
}

/**
 * Vung nay co the chia "trong vung / ngoai vung" duoc khong.
 *
 * "Global" va "Group headquarters" CO Y khong co danh sach nuoc (nuoc: null),
 * nen moi nguoi deu "ngoai vung" theo khopVung - chia nhom o do la dung mot
 * tieu de sai cho ca danh sach. Man ket qua phai hoi ham nay truoc khi chia.
 */
export function vungCoChiaDuoc(regionKey: string | null | undefined): boolean {
  if (!regionKey) return false;
  return Boolean(timVung(regionKey)?.nuoc?.length);
}

/**
 * Xep nguoi TRONG VUNG len truoc, giu nguyen thu tu diem ben trong tung nhom.
 *
 * Vi sao can den nhom thay vi chi mot con diem: dia diem duoc 15 diem
 * (W.location) trong khi chuc danh duoc 30, kinh nghiem 25, chuc nang 20 va
 * cap bac tuy 15 - nen mot Marketing Director o Singapore LUON nam tren mot
 * Marketing Executive o TP HCM. Voi cong cu ma cau hoi dau tien la "ho lam
 * viec o dau" thi thu tu do la nguoc.
 *
 * KHONG giai bang cach nang W.location: con so du lon de thang moi to hop diem
 * khac (can khoang 100) se dim het tin hieu con lai thanh tieng on, va diem da
 * luu cua job cu se khong con so sanh duoc voi job moi.
 *
 * Day la XEP LAI THU TU, khong phai loc - dung bat bien o dau file: khong ai
 * bien mat khoi danh sach. inRegion === null nghia la cau hoi khong ap dung
 * (vung Global/Group headquarters, hoac job cu khong luu vung); luc do ham nay
 * khong doi gi ca.
 *
 * sort() cua JS on dinh theo chuan (ES2019 tro di), nen thu tu diem co san
 * duoc giu nguyen ben trong moi nhom - goi ham nay KHONG duoc lam mat thu tu
 * diem, va do dung la thu test kiem.
 */
export function xepTrongVungLenTruoc<T extends { inRegion: boolean | null }>(ds: T[]): T[] {
  if (!ds.some((c) => c.inRegion !== null)) return ds;
  return [...ds].sort((a, b) => Number(b.inRegion === true) - Number(a.inRegion === true));
}

export function scoreCandidate(c: Candidate, p: Prefs): Scored {
  const reasons: string[] = [];
  let score = 0;

  // --- dang duoi mot nguoi cu the -----------------------------------------
  // So khop tung tieng, khong so ca chuoi: "Nguyen Van A" va "A Nguyen Van" la
  // cung mot nguoi voi mat nguoi doc, nhung khac nhau voi phep so sanh chuoi.
  if (p.chasing) {
    const muon = norm(p.chasing).split(' ').filter(Boolean);
    const co = norm(c.full_name).split(' ').filter(Boolean);
    const trungHet = muon.length > 0 && muon.every((w) => co.includes(w));

    // Ten dem pho bien khong noi len dieu gi. Ke ca hai nguoi hoan toan xa la
    // cung chung chu "van" hay "thi", nen neu tinh ca chung thi nua danh sach
    // deu "trung ten mot phan".
    const rong = new Set(['van', 'thi', 'ngoc', 'minh', 'duc', 'huu', 'quoc', 'the', 'dinh', 'xuan']);
    const trungRieng = muon.filter((w) => !rong.has(w) && co.includes(w)).length;

    if (trungHet) {
      score += W.name;
      reasons.push('This is who you are looking for');
    } else if (trungRieng >= 2) {
      score += W.namePart;
      reasons.push('Name partly matches');
    }
  }

  // --- chuc danh hien tai: khop tu nao cong tu do, khong khop thi thoi ----
  const title = norm(c.job_title);
  const words = (p.titleWords ?? []).filter(Boolean);
  const titleHit = words.filter((w) => title.includes(norm(w)));
  if (titleHit.length) {
    score += W.title;
    reasons.push(`Matches ${titleHit.join(', ')}`);
  }

  // --- Function (department) PIC da tick: khop CHUC DANH, khong phai
  // c.department -------------------------------------------------------
  //
  // Truoc day dieu kien la `c.department` - khong noi nao trong toan bo pipeline
  // (toCandidate() trong lib/signalhire.ts) tung ghi truong nay, nen nhanh nay
  // KHONG BAO GIO chay duoc voi du lieu that. Sua: khop CHUOI CON vao job_title,
  // giong het cach titleWords lam - Function va Title words gio doi chieu CUNG
  // mot truong.
  //
  // Khop TUNG CUM cua nhan, khong phai ca nhan nguyen van. "E-commerce and
  // digital" va "Export and international" la nhan TU DAT cua app (xem
  // DEPARTMENTS trong SearchForm.tsx), khong phai cach nguoi that viet chuc
  // danh - ca cum do gan nhu khong bao gio xuat hien nguyen van trong mot
  // job_title that. Khop ca nhan (ban truoc) nen "Founder & E-commerce
  // manager" tick "E-commerce and digital" van ra 0 diem Function, du chu
  // "E-commerce" nam ngay trong ca hai. Tach tren " and " (bo tu noi, khong
  // de no tu khop bat cu title nao co chua chu "and") roi khop tung cum rieng
  // - "E-commerce and digital" gio khop duoc "E-commerce" hoac "digital",
  // "Export and international" khop duoc "Export" hoac "international". Nhan
  // khong co "and" (Marketing, Sales, Business Development, Human
  // Resources...) khong doi, van la mot cum duy nhat.
  //
  // Chong dem hai lan: mot cum tach ra TRUNG (theo chuan hoa) voi tu PIC da go
  // o Title words HOAC Keywords thi bo qua, du no co khop title hay khong -
  // day la CUNG MOT bang chung van ban ("e-commerce" nguoi dung go mot lan,
  // du go o o nao), khong phai hai tin hieu doc lap. Cum KHAC (vi du Title
  // words go "ecommerce", Function tick "Marketing", ca hai cung khop mot
  // title) van duoc cong ca hai, vi do la hai bang chung that su khac nhau.
  function tachNhanBoPhan(nhan: string): string[] {
    return nhan.split(/\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
  }

  const dsDept = (p.departments?.length ? p.departments : (p.department ? [p.department] : []))
    .filter(Boolean);
  const daYeuCauNoiKhac = new Set(
    [...(p.titleWords ?? []), ...(p.keywordTerms ?? [])].map(norm).filter(Boolean),
  );
  const deptHit = dsDept.filter((d) =>
    tachNhanBoPhan(d).some((cum) => {
      const c2 = norm(cum);
      return c2 && !daYeuCauNoiKhac.has(c2) && title.includes(c2);
    }));
  if (deptHit.length) {
    score += W.department;
    reasons.push(`Function: ${deptHit.join(', ')}`);
  }

  // --- ky nang va kinh nghiem qua khu: khop CHUOI CON voi keywordTerms ----
  // keywordTerms gom ca tu Keywords cua PIC LAN ten brand dang tim (them tai
  // scan/route.ts) - nguoi lam "Financial Planning - Seasoning (Nam Ngu,
  // Chin-su, Tam Thai Tu)" phai duoc tinh cho brand Chin-su du cong ty hien
  // tai cua ho la Masan.
  const terms = (p.keywordTerms ?? []).map(norm).filter(Boolean);
  if (terms.length) {
    const skillHit = (c.skills ?? []).find((s) => terms.some((t) => norm(s).includes(t)));
    if (skillHit) {
      score += W.skill;
      reasons.push(`Skill: ${skillHit}`);
    }

    // Doi chieu CA chuc danh lan cong ty cua tung dong kinh nghiem, khong chi
    // dong hien tai - do chinh la cho "Financial Planning - Seasoning
    // (..., Chin-su, ...)" duoc bat, vi no nam trong title cua mot dong
    // experience (co the la dong hien tai, tuy SignalHire xep), khong phai o
    // ten cong ty.
    const expHit = (c.experience ?? []).find((e) =>
      terms.some((t) => norm(e?.title).includes(t) || norm(e?.company).includes(t)));
    if (expHit) {
      score += W.experience;
      const nhan = expHit.title || expHit.company || '';
      if (nhan) reasons.push(`Past role: ${nhan}`);
    }
  }

  // --- dia diem: diem thuong khi khop vung PIC da chon, KHONG BAO GIO loc -
  // China Project / Cross Border la ly do chinh dieu nay khong duoc la bo
  // loc: nguoi quyet dinh cua cac brand do thuong ngoi ngoai vung mac dinh.
  const vungKhop = khopVung(c.location, p.region);
  if (vungKhop) {
    score += W.location;
    reasons.push(`Works in ${vungKhop}`);
  }

  // Bat duoc nguoi cap cao ma SignalHire phan loai level khong chuan.
  const sen = seniorityBonus(c.job_title);
  score += sen.pts;
  if (sen.label && sen.pts >= 12) reasons.push(sen.label);

  // Nguoi dang tim viec moi sap roi cong ty do. Lay contact de ban hop tac gan
  // nhu chac chan phi. Nhung van GIU LAI, chi day xuong duoi.
  if (c.open_to_work) {
    score += W.openToWork;
    reasons.push('Open to work, may be leaving');
  }

  return { score, reasons };
}

/** Nhan hien tren the ung vien. */
export function strengthOf(score: number): 'strong' | 'fair' | 'weak' {
  if (score >= 45) return 'strong';
  if (score >= 20) return 'fair';
  return 'weak';
}

/** Co dat mo uoc nao khong. Khong co thi man hinh an cot ly do di cho gon. */
export function hasPrefs(p: Prefs): boolean {
  return Boolean(
    p.department || (p.departments ?? []).length || (p.titleWords ?? []).length
    || (p.keywords ?? '').trim(),
  );
}
