/**
 * Hang so tran quy mo scan, tach RIENG khoi lib/scanQuota.ts va
 * lib/signalhire.ts.
 *
 * Ly do tach: ca hai file do deu keo theo lib/supabase/admin.ts (qua
 * @supabase/supabase-js), va lib/signalhire.ts con mang trang thai module-level
 * (hang doi cua goiSignalHire) nen bundler khong tree-shake bo duoc du chi
 * dung mot hang so - ca file se theo vao goi client. Results.tsx (client
 * component) can doc MAX_BRAND_MOI_LAN de hien dung so trong copy "N brand
 * chua duoc quet", nen hang so phai nam o mot file KHONG import gi tu phia may
 * chu - giong ly do lib/regions.ts da tach rieng khoi lib/signalhire.ts (xem
 * ghi chu o dau file do).
 */

/**
 * Moi cong ty tim toi da 2 lan goi SignalHire (kham pha + thu hep, xem
 * searchBrand() trong lib/signalhire.ts). Dung khi uoc luong so luot
 * brand-han-muc ma mot brand co the chiem (mot brand co alias tro toi N cong
 * ty, cong them mot lan thu lai bang ten brand khi TAT CA N cong ty deu khong
 * co trong chi muc).
 */
export const CALLS_PER_COMPANY_WORST_CASE = 2;

/**
 * Tran so brand moi lan goi /api/scan - KHONG phai han muc ngay.
 *
 * 8, truoc day la 5. Con so 5 duoc chot bang mot phep nhan worst-case:
 * 5 brand * 2 lan goi / 3 dong thoi = 4 dot, nhan voi 14.93s (lan goi cham
 * nhat tung quan sat duoc) ~ 60s. Phep do chong hai cai te nhat doc lap len
 * nhau - gia dinh MOI brand deu can 2 lan goi VA moi lan goi deu cham bang
 * ky luc.
 *
 * Do lai tren 384 lan quet that (job.created_at -> updated_at, da loai job
 * treo): moi brand p50 2.3s, p90 6.0s, p99 10.8s. Rieng 79 lan quet du 5
 * brand: p50 4.8s, CHAM NHAT 32.8s. Tuc muc 5 dang dung chua toi mot nua
 * ngan sach 60s. Va chi 25% brand that su can den lan goi thu hai, khong phai
 * 100% nhu phep nhan kia gia dinh.
 *
 * Voi 8 brand o muc p99 cho MOI brand: 8 * 10.8 / 3 ~ 29s, van trong
 * NGAN_SACH_TIM_MS. Nhung con so nay khong con phai la thu giu an toan nua -
 * NGAN_SACH_TIM_MS moi la, va no chan theo DONG HO THAT chu khong theo uoc
 * luong. Vuot gio thi brand chua chay roi vao `notRun`, khong con bo lai job
 * ket o 'running' vinh vien.
 */
export const MAX_BRAND_MOI_LAN = 8;

/**
 * Bao lau ke tu luc bat dau thi NGUNG nhan brand moi vao tim.
 *
 * Day moi la thu giu cho mot lan quet khong bao gio vuot maxDuration, chu
 * khong phai MAX_BRAND_MOI_LAN. Brand nao chua kip bat dau khi qua moc nay se
 * khong chay va duoc tra ve trong `notRun` - man ket qua da co san cho hien
 * chung ("N brands were not searched at all"), va PIC quet lai mot lan nua.
 *
 * Co cai chan nay thi tran brand moi lan khong con phai la mot con so doan
 * cho an toan: vuot gio thi xuong thang em, khong con bo lai mot job ket o
 * 'running' vinh vien nhu truoc.
 *
 * 40 giay tren ngan sach 60: phan con lai danh cho cham diem, ghi
 * scan_candidate, cap nhat job va tra ve. Nhung viec do chay sau khi tim xong
 * va khong duoc tinh vao day.
 */
export const NGAN_SACH_TIM_MS = 40_000;

/**
 * So brand chay song song. Bang dung gioi han 3 dong thoi that su cua tai
 * khoan SignalHire (SO_DONG_THOI_TOI_DA trong lib/signalhire.ts), nen khong
 * mat thong luong so voi cach cu la bung het mot luot roi de hang doi ben
 * trong tu chen.
 *
 * Doi sang chay theo tho CO LY DO: `Promise.all(dsBrand.map(...))` goi het
 * cac ham ngay lap tuc, nen moi phep kiem gio deu chay o giay 0 va khong chan
 * duoc gi. Chay theo tho thi moi tho kiem gio TRUOC khi nhan brand tiep theo,
 * tuc moc gio o tren moi co tac dung that.
 */
export const SO_BRAND_SONG_SONG = 3;

/**
 * Chay mot danh sach viec bang `soTho` tho song song, va NGUNG NHAN viec moi
 * khi qua `hanChot`.
 *
 * Viec da bat dau thi chay cho xong, khong cat ngang: voi mot lan tim brand,
 * cat giua chung se vut di nhung lan goi SignalHire da tieu luot trong tran
 * ngay roi.
 *
 * Vi sao phai la tho chu khong phai `Promise.all(ds.map(...))`: cach kia goi
 * het cac ham NGAY LAP TUC, nen moi phep kiem gio dat o dau ham deu chay o
 * giay 0 va khong bao gio dung duoc gi. Tho thi kiem gio TRUOC moi lan nhan
 * viec tiep theo, tuc han chot moi co tac dung that.
 *
 * `now` de test tiem dong ho gia vao - han chot la thu khong the kiem bang
 * cach ngoi doi that.
 */
export async function chayTheoTho<T, R>(
  dsViec: T[],
  lam: (viec: T) => Promise<R>,
  opts: { hanChot: number; soTho: number; now?: () => number },
): Promise<{ xong: R[]; quaGio: T[] }> {
  const now = opts.now ?? Date.now;
  const hangDoi = [...dsViec];
  const xong: R[] = [];
  const quaGio: T[] = [];

  async function tho() {
    for (;;) {
      const viec = hangDoi.shift();
      if (viec === undefined) return;
      if (now() > opts.hanChot) { quaGio.push(viec); continue; }
      xong.push(await lam(viec));
    }
  }

  const soTho = Math.max(1, Math.min(opts.soTho, dsViec.length));
  await Promise.all(Array.from({ length: soTho }, () => tho()));

  return { xong, quaGio };
}

/**
 * Tran so nguoi HIEN RA cho moi brand tren man ket qua scan.
 *
 * Chi cat o cho HIEN. Khong dong nao bi xoa va khong lan goi SignalHire nao
 * bot di: `scan_candidate` van giu nguyen tat ca, va tran ngay (300 brand /
 * 6000 profile) van dem y het nhu truoc, vi no dem nguoi SignalHire TRA VE
 * chu khong dem nguoi PIC nhin thay.
 *
 * 20 la con so PIC chon. Tac dong do duoc tren du lieu that (07/10/2026):
 * trong 605 nhom (job x brand) dang co, 255 nhom - tuc 42% - nhieu hon 20
 * nguoi, va tran nay giau di 11.071 trong 18.716 dong, gan 59%.
 *
 * Vi cat nhieu nhu vay nen cho nao cat PHAI noi ra "20 of 63", khong duoc im
 * lang: mot danh sach dung 20 nguoi khong kem con so tong doc het suc giong
 * mot brand chi co 20 nguoi that. Xem lai ThongKe o Results.tsx - cai
 * bay nay da duoc viet ra o do tu truoc, cho ba tinh huong "khong co trong
 * SignalHire / cong ty nho da lay het / cong ty lon bi loc o nguon".
 *
 * Cat SAU khi xep hang, khong phai truoc: thu tu da la trong-vung-truoc roi
 * moi den diem (xepTrongVungLenTruoc o lib/rank.ts), nen 20 nguoi giu lai la
 * 20 nguoi tot nhat theo dung thu tu man hinh vua dung, khong phai 20 nguoi
 * dau tien cua chi muc.
 */
export const MAX_PROFILE_MOI_BRAND = 20;

/**
 * Cat danh sach ung vien con `tran` nguoi moi brand, va dem lai tong that su
 * cua tung brand truoc khi cat.
 *
 * GIU NGUYEN THU TU da duoc xep tu truoc. Ham nay khong sap xep gi: no nhan
 * mot danh sach DA xep (trong-vung-truoc, roi den diem - xem
 * xepTrongVungLenTruoc o lib/rank.ts) va chi giu lai `tran` nguoi dau tien
 * cua moi brand. Tu sap lai o day se lang le pha thu tu ma man hinh dua vao
 * de ke duong "Outside <vung>".
 *
 * Danh sach vao CO THE xen ke nhieu brand - xepTrongVungLenTruoc sap toan cuc
 * theo inRegion chu khong gom theo brand - nen phai dem rieng tung brand chu
 * khong duoc cat mot lat theo vi tri.
 *
 * Tach ra khoi actions.ts de test duoc: phep cat nay giau 59% so dong tren du
 * lieu that, nen no sai mot cai la PIC mat nguoi ma khong co gi bao.
 */
export function catTheoBrand<T extends { brand_name: string }>(
  ds: T[],
  tran: number = MAX_PROFILE_MOI_BRAND,
): { hien: T[]; tongTheoBrand: Record<string, number> } {
  // Dem bang Map, KHONG bang object thuong. `dem[ten] ?? 0` tren object se doc
  // trung thuoc tinh ke thua tu Object.prototype khi brand ten dung la
  // "constructor" hay "toString": gia tri lay ra la mot ham chu khong phai
  // undefined, nen `?? 0` khong cuu duoc va phep cong ra rac. Ten brand do PIC
  // go tay vao form scan nen gia tri nhu vay toi duoc.
  const tong = new Map<string, number>();
  const daLay = new Map<string, number>();
  const hien: T[] = [];

  for (const c of ds) {
    const ten = c.brand_name;
    tong.set(ten, (tong.get(ten) ?? 0) + 1);

    const n = daLay.get(ten) ?? 0;
    if (n < tran) {
      hien.push(c);
      daLay.set(ten, n + 1);
    }
  }

  // Tra ve object vi ket qua nay di qua ranh gioi server action -> client, noi
  // Map khong serialize duoc. Moi brand co mat deu thanh thuoc tinh RIENG nen
  // che duoc prototype khi man hinh doc ra.
  return { hien, tongTheoBrand: Object.fromEntries(tong) };
}
