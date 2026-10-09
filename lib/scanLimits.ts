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
 * Tran so brand moi lan goi /api/scan - KHONG phai han muc ngay, ma de dam
 * bao mot lan quet chac chan xong truoc maxDuration (60s).
 *
 * 5, khong phai 8: voi gioi han 3 dong thoi that su cua SignalHire (xem
 * SO_DONG_THOI_TOI_DA o lib/signalhire.ts) va toi da CALLS_PER_COMPANY_WORST_CASE
 * lan goi moi brand, truong hop xau nhat la 5 * 2 = 10 lan goi, chia 3 dong
 * thoi = 4 dot. Doi chieu lich su that (job.created_at/updated_at cua cac lan
 * quet mot-brand-mot-lan-goi cu, doc truc tiep tu DB): trung binh 3.14s, cham
 * nhat quan sat duoc 14.93s moi lan goi. 4 dot * 14.93s ~ 60s - sat tran nhung
 * song duoc; 8 brand (16 lan goi / 3 = 6 dot) o muc cham nhat se ra ~90s,
 * chac chan qua maxDuration va bo lai mot job ket o status 'running' vinh vien
 * - hong hon nhieu so voi mot lo nho hon.
 */
export const MAX_BRAND_MOI_LAN = 5;

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
