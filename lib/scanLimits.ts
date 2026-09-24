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
