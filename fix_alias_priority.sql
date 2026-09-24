-- Part 1b: mot admin sua tay khong the de duoc mot alias tu hoc sai.
--
-- Khong co thu muc migrations trong du an. File nay dat rieng, ten ro rang,
-- chay tay qua Supabase SQL Editor - giong cach schema.sql va
-- can_use_category.sql da lam.
--
-- Truoc doi nay, brand_alias.priority mang y nghia:
--   0 = tu hoc qua duong tim lai (ghiAliasHocDuoc, fellBack = true)
--   1 = nhap tay qua Admin > Aliases (gia tri MAC DINH cua cot - saveAlias()
--       khong he ghi ro priority)
--   2 = tu hoc lan dau thanh cong (ghiAliasHocDuoc, fellBack = false)
-- loadSettings() doc theo "priority asc, updated_at desc" va chi giu dong DAU
-- TIEN cho moi alias, nen thu tu THANG THUA that su la: fallback-learned (0)
-- > nhap tay (1) > first-success-learned (2). Mot admin sua lai mot alias
-- ma ghiAliasHocDuoc da hoc sai qua duong fallback se LUON THUA, vi 0 < 1.
--
-- Sau doi nay (code da sua trong lib/signalhire.ts va
-- app/(app)/admin/actions.ts de ghi dung cac gia tri moi):
--   0 = nhap tay qua Admin > Aliases (saveAlias() gio ghi ro priority: 0)
--   1 = tu hoc qua duong tim lai (ghiAliasHocDuoc, fellBack = true)
--   2 = tu hoc lan dau thanh cong (ghiAliasHocDuoc, fellBack = false)
-- Nhap tay LUON THANG ca hai loai tu hoc.
--
-- File nay chi doi DU LIEU DA CO va GIA TRI MAC DINH cua cot cho khop voi
-- nghia moi. Ba gia tri 0/1/2 chi tung duoc ghi boi dung ba nguon tren, nen
-- doi cho an toan: MOI dong priority=0 hien co chac chan la tu hoc qua duong
-- tim lai (can chuyen thanh 1), MOI dong priority=1 hien co chac chan la
-- nhap tay (can chuyen thanh 0, vi khong con nguon nao khac ghi gia tri nay
-- ngoai gia tri mac dinh cua cot).
--
-- Doi qua mot gia tri tam (9) truoc, tranh ghi de len nhau giua hai buoc.
begin;

update brand_alias set priority = 9 where priority = 1;  -- nhap tay -> tam
update brand_alias set priority = 1 where priority = 0;  -- tu hoc (fallback) -> 1
update brand_alias set priority = 0 where priority = 9;  -- nhap tay (tam) -> 0

alter table brand_alias alter column priority set default 1;

commit;

-- Kiem lai sau khi chay: dem xem con dong nao priority nam ngoai {0,1,2}
-- khong (khong nen co, nhung kiem cho chac).
-- select priority, count(*) from brand_alias group by priority order by priority;
