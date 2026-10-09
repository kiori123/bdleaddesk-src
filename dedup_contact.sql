-- Ra soat va gop contact trung tren bang `contact`.
--
-- Khong co thu muc migrations trong du an. File nay dat rieng, ten ro rang,
-- chay tay qua Supabase SQL Editor - giong cach schema.sql,
-- can_use_category.sql va fix_alias_priority.sql da lam.
--
-- ===========================================================================
-- DOC CAI NAY TRUOC KHI CHAY BAT KY DONG NAO
-- ===========================================================================
--
-- Ket qua ra soat tren du lieu that (07/10/2026):
--
--   993 dong contact  =  979 con nguoi
--   14 nguoi xuat hien tren nhieu hon mot dong  ->  14 dong "thua"
--
-- Trong 14 cap do, 13 cap KHONG PHAI LOI va KHONG DUOC XOA:
--
--   Tan Phu Plastic / Inochi        (Inochi la brand cua Tan Phu Plastic)
--   Xuong Giang Paper / Posy
--   Fani / TopGia  va  Fani Trading / TopGia
--   Asia Master Trade / Axix-Y
--   Sunlight / Vim                  (hai brand Unilever)
--   Sachi / Sohaco
--
-- Deu la mot nguoi that o cong ty me dong thoi la dau moi cua brand con. Bang
-- `contact` la (nguoi x brand) chu khong phai (nguoi): xoa dong thu hai la cat
-- mat duong lien he cua ca mot brand. Chung PHAI o lai.
--
-- Cach xu ly da chon KHONG phai la xoa, ma la DEM CHO DUNG: trang /admin gio
-- hien ca "Leads" (so dong) lan "People" (so nguoi), dinh nghia o
-- lib/contactIdentity.ts. Mot nguoi phu trach hai brand khong con doc ra nhu
-- hai lead moi, va cung khong mat dong nao.
--
-- Chi con HAI cap la trung that su - cung mot brand, hai dong. Ca hai deu
-- KHONG chac chan, nen de o Phan 2 duoi day cho nguoi quyet dinh, khong gop
-- tu dong. Gop nham hai nguoi that thanh mot thi khong co gi bao lai.
--
-- Hang rao san co van dung: unique index contact_uid_idx tren
-- (brand_id, external_uid) da chan san truong hop cung uid trung brand - do
-- cung la ly do moi cap trung con lai deu la trung CHEO brand.
--
-- Hai lo thung da vit lai o app/api/reveal/route.ts trong cung lan sua nay:
--   - so ten khi tim dong cu da chuyen sang KHONG phan biet hoa thuong
--     (truoc day hai ten chi khac kieu viet hoa bi coi la hai nguoi)
--   - khong dung .maybeSingle() nua, vi no nem loi khi da ton tai dung cap
--     trung hoa thuong noi tren

-- ---------------------------------------------------------------------------
-- PHAN 1 - CHI DOC. Chay lai bat cu luc nao de ra soat.
-- ---------------------------------------------------------------------------

-- 1a. Trung that su: cung brand, cung uid.
-- Phai luon tra ve 0 dong - contact_uid_idx chan san. Ra khac 0 nghia la
-- index da bi bo o dau do.
select brand_id, external_uid, count(*), array_agg(id) as cac_dong
from contact
where external_uid is not null
group by brand_id, external_uid
having count(*) > 1;

-- 1b. Trung that su: cung brand, ten chi khac kieu viet hoa / khoang trang.
select c.brand_id, b.name as brand, lower(btrim(c.full_name)) as ten,
       count(*), array_agg(c.id) as cac_dong, array_agg(c.job_title) as chuc_danh
from contact c join brand b on b.id = c.brand_id
where c.full_name is not null
group by c.brand_id, b.name, lower(btrim(c.full_name))
having count(*) > 1;

-- 1c. Trung that su: cung brand, cung email.
-- CAN THAN: mot hop thu dung chung cua ca cong ty (info@, sales@, cskh@...)
-- lam hai nguoi KHAC NHAU hien ra o day. Phai nhin chuc danh va LinkedIn
-- truoc khi ket luan, dung gop theo email khong.
select c.brand_id, b.name as brand, lower(btrim(c.email)) as email,
       count(*), array_agg(c.id) as cac_dong,
       array_agg(c.full_name) as ten, array_agg(c.linkedin_url) as linkedin
from contact c join brand b on b.id = c.brand_id
where c.email is not null and btrim(c.email) <> ''
group by c.brand_id, b.name, lower(btrim(c.email))
having count(*) > 1;

-- 1d. Cung mot nguoi nam o NHIEU BRAND. Day la bao cao tham khao, KHONG phai
-- danh sach can xoa - xem phan dau file. Huu ich de biet brand nao dang dung
-- chung dau moi voi brand nao.
select c.external_uid, min(c.full_name) as ten,
       count(*) as so_dong, array_agg(b.name order by b.name) as cac_brand
from contact c join brand b on b.id = c.brand_id
where c.external_uid is not null
group by c.external_uid
having count(distinct c.brand_id) > 1
order by count(*) desc;

-- 1e. Dong nao khong co gi de nhan dang (khong uid, khong LinkedIn, khong
-- email). Nhung dong nay khong bao gio gop duoc voi dong khac, nen moi dong
-- luon tinh la mot nguoi rieng.
select count(*) as khong_nhan_dang_duoc
from contact
where coalesce(btrim(external_uid), '') = ''
  and coalesce(btrim(linkedin_url), '') = ''
  and coalesce(btrim(email), '') = '';

-- ---------------------------------------------------------------------------
-- PHAN 2 - GOP. Hai truong hop, moi truong hop la mot quyet dinh cua nguoi.
--
-- Chay tung khoi mot, sau khi da nhin ky du lieu. Khong chay ca file.
-- Moi khoi boc trong transaction va co san mot cau select de xem truoc.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 2a. Cap A  -  brand F&B, hai dong dung CHUNG mot hop thu cong ty
-- ===========================================================================
--
-- Du lieu that KHONG ghi o day: repo nay cong khai, ma day la email/phone cua
-- nguoi that. Chay cau select "Xem truoc" ben duoi de nhin tan mat.
--
--   fa4826d8-2c63-482d-bdc7-40ad285cd40f   (goi la A1)
--     chuc danh kieu "Sales Manager", co email, CO phone
--     LinkedIn slug dat theo SAN PHAM, khong phai ten nguoi
--
--   a5fef863-5811-4fdc-b7bc-c17d719f2353   (goi la A2)
--     chuc danh kieu "Manager Sales", cung email do, KHONG phone
--     LinkedIn slug dat theo TEN NGUOI
--
-- Hai dong cung brand, cung email, tao cung ngay, cung org_rank, cung
-- location. Nhung HAI LinkedIn profile khac nhau va HAI uid khac nhau.
--
-- VI SAO KHONG TU DONG GOP: doc nhu mot nguoi ban hang co mot trang ca nhan
-- va mot trang gioi thieu san pham - nhung cung co the la hai nhan vien dung
-- chung mot hop thu cong ty. Chi nguoi tung lam viec voi brand nay tra loi
-- duoc.
--
-- NEU LA MOT NGUOI: giu A1 (co phone, day du hon) va bo A2. Ca hai deu ton
-- credit roi, xoa khong lay lai duoc dong nao.

-- Xem truoc:
-- select id, full_name, job_title, email, phone, linkedin_url, external_uid, created_at
-- from contact where id in ('fa4826d8-2c63-482d-bdc7-40ad285cd40f',
--                           'a5fef863-5811-4fdc-b7bc-c17d719f2353');

-- begin;
--   -- Neu ten tren dong A2 moi la ten nguoi that su dung thi chep no sang
--   -- A1 truoc khi xoa. Lay ten that tu cau select "Xem truoc" o tren.
--   -- update contact set full_name = '<ten tren A2>'
--   --  where id = 'fa4826d8-2c63-482d-bdc7-40ad285cd40f';
--
--   -- scan_candidate tro toi dong sap xoa thi tro lai dong duoc giu, dung de
--   -- no thanh null: man ket qua scan dua vao cot nay de khoa tick va khong
--   -- bat PIC tra credit lan hai cho cung mot nguoi.
--   update scan_candidate
--      set contact_id = 'fa4826d8-2c63-482d-bdc7-40ad285cd40f'
--    where contact_id = 'a5fef863-5811-4fdc-b7bc-c17d719f2353';
--
--   delete from contact where id = 'a5fef863-5811-4fdc-b7bc-c17d719f2353';
-- commit;

-- ===========================================================================
-- 2b. Cap B  -  brand my pham Han, hai dong ten chi khac kieu viet hoa
-- ===========================================================================
--
--   a44ffb25-9b5f-42f3-9cf3-275e3fc636fb   (goi la B1)
--     chuc danh "Marketing Manager", CO LinkedIn
--     location ghi chi tiet toi quan
--
--   c2a7b4a1-4315-43cd-99a5-a15ad227958a   (goi la B2)
--     chuc danh "Assistant Manager", KHONG co LinkedIn
--     location chi ghi toi thanh pho
--
-- Hai ten chi khac moi kieu viet hoa, nen 1b o tren bat duoc. Ca hai deu
-- KHONG co email, KHONG co phone - tuc hai credit nay da mat trang du gop hay
-- khong.
--
-- VI SAO KHONG TU DONG GOP: CHUC DANH KHAC NHAU (Marketing Manager vs
-- Assistant Manager). Nhieu kha nang day la HAI nhan vien marketing khac nhau
-- ma SignalHire deu ghi ten tai khoan giong nhau, chu khong phai mot nguoi bi
-- luu hai lan. Neu dung vay thi KHONG duoc gop - cu de nguyen hai dong.
--
-- Chi chay khoi duoi neu da xac nhan day dung la mot nguoi.

-- Xem truoc:
-- select id, full_name, job_title, location, linkedin_url, external_uid, created_at
-- from contact where id in ('a44ffb25-9b5f-42f3-9cf3-275e3fc636fb',
--                           'c2a7b4a1-4315-43cd-99a5-a15ad227958a');

-- begin;
--   update scan_candidate
--      set contact_id = 'a44ffb25-9b5f-42f3-9cf3-275e3fc636fb'
--    where contact_id = 'c2a7b4a1-4315-43cd-99a5-a15ad227958a';
--
--   -- Giu B1: no co LinkedIn, tuc van con duong lien he.
--   delete from contact where id = 'c2a7b4a1-4315-43cd-99a5-a15ad227958a';
-- commit;

-- ---------------------------------------------------------------------------
-- PHAN 3 - KHONG SUA LICH SU `source`, va vi sao
-- ---------------------------------------------------------------------------
--
-- app/api/reveal/route.ts tung xet "contact nay co phai do dan link vao
-- khong" bang `person.uid.startsWith('http')`. `person.uid` la uid hex do
-- SignalHire TRA VE, con duong link chi nam o `uids` cua request - nen dieu
-- kien do khong bao gio dung mot lan nao. Hau qua: 125 contact vao bang duong
-- dan link deu bi ghi `source = 'signalhire'`, va bang contact hien khong co
-- lay mot dong `pasted_linkedin` nao.
--
-- Cho ghi moi da sua. Lich su thi KHONG sua, vi khong lan nguoc lai duoc mot
-- cach dang tin: bang contact khong giu job_id, nen muon biet dong nao sinh ra
-- tu job nao chi con cach doi chieu brand + thoi diem. Thu roi: trong 130 job
-- dan link da xong, chi 52 job doi ra duoc dung mot contact; 45 job dinh nhieu
-- contact cung luc va 33 job khong dinh dong nao. Sua theo kieu do la doan
-- tren qua nua so dong - dung loai sai im lang ma ca lan ra soat nay dang di
-- don.
--
-- Pham vi anh huong co gioi han ro rang: `isByCredit()`
-- (lib/contactOrigin.ts) xep `signalhire` va `pasted_linkedin` VAO CUNG MOT
-- NHOM, nen moi con so lien quan den tien - Spent, Gained, Wasted, By credit,
-- Full rate (paid) - deu khong he bi anh huong. Cai sai chi nam o phan quy
-- nguon, va chi voi du lieu TRUOC lan sua nay.
--
-- Nho: `pasted_linkedin` bang 0 trong giai doan truoc 07/10/2026 KHONG co
-- nghia la team chua bao gio dan link. Nguoc lai: 143 job dan link.
