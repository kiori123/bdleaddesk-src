-- Them cot `company`: ten cong ty ma chinh PIC ghi tren LinkedIn cua ho.
--
-- Khac voi brand.name (ten noi bo app dung de nhom contact/credit): mot senior
-- co the ghi ten tap doan me tren LinkedIn trong khi brand trong app la chi
-- nhanh dia phuong, hoac nguoc lai. lib/signalhire.ts da lay duoc gia tri nay
-- tu experience hien tai cua ho (Revealed.company, xem signalhire.ts:763) tu
-- lau, nhung truoc gio chi dung de doan brand khi PIC dan link LinkedIn roi
-- vut di - chua bao gio luu vao contact.
--
-- Dung cho mau thu ({{company}} trong lib/template.ts) va hien thi UI, khong
-- anh huong logic brand/credit nao dang co.
--
-- Chay mot lan trong Supabase SQL Editor.

alter table contact add column if not exists company text;
