-- Tinh lai brand.name_key sau khi nameKey() doi dau cau thanh khoang trang.
--
-- Chay TAY qua Supabase SQL Editor, giong can_use_category.sql va
-- fix_alias_priority.sql - du an khong co thu muc migrations, xem ghi chu dau
-- can_use_category.sql.
--
-- ---------------------------------------------------------------------------
-- Vi sao can file nay
-- ---------------------------------------------------------------------------
-- lib/nameKey.ts truoc day GIU dau nhay va dau gach. Bang brand_alias thi
-- duoc nap voi dau cau da thay bang khoang trang, nen hai ben khong bao gio
-- gap nhau:
--
--   PIC go "L'Oreal Paris"   -> khoa "l'oreal paris"
--   brand_alias luu          ->      "l oreal paris" -> "L'Oreal Vietnam"
--
-- Ket qua: app di tim dung chu "L'Oreal Paris" - mot dong san pham, khong phai
-- phap nhan tuyen dung - nen tra ve beauty advisor va chu salon khap the gioi,
-- khong mot ai trong doi L'Oreal Vietnam. 15 brand bi nhu vay (Kiehl's, Lay's,
-- Pond's, McDonald's, Domino's Pizza, Biti's, Nature's Way, Johnson's Baby,
-- Wall's, Beck's, La Roche-Posay, Koala's March, M&M's, P/S, L'Oreal Paris).
--
-- nameKey() nay chuan hoa dau cau thanh khoang trang, nen khoa ham do tinh ra
-- khong con trung voi brand.name_key dang luu cho 16 dong. Phai tinh lai,
-- khong thi:
--   - scan/route.ts (.in('name_key', ...)) khong nhan ra brand da co contact,
--     nen "Skip brands already on file" bo qua sai va dam vao tran 300/ngay;
--   - reveal/route.ts (upsert onConflict: 'name_key') CHEN MOT DONG BRAND THU
--     HAI cho cung mot brand, contact chia doi giua hai dong - dung cai ma ghi
--     chu dau lib/nameKey.ts canh bao.
--
-- ---------------------------------------------------------------------------
-- Vi sao chi can gop dau cau, khong can bo dau tieng Viet
-- ---------------------------------------------------------------------------
-- Vi name_key DANG LUU da do nameKey() cu sinh ra, tuc da bo dau thanh va da
-- lowercase roi. Thu duy nhat con khac la dau cau. Nen phep doi o day chay
-- tren chinh name_key, KHONG chay lai tu brand.name.
--
-- Doi lai la file nay khong can extension unaccent, khong can tao ham nao, va
-- khong de lai trong DB mot ban chuan hoa thu hai de lech voi lib/nameKey.ts
-- ve sau.
--
-- Da doi chieu tren du lieu that ngay 18/09/2026, ca 113 dong brand:
--   - name_key hien tai: 0 dong co ky tu ngoai ASCII (nen [:alnum:] an toan)
--   - phep doi duoi day == nameKey(name) o TypeScript: khop 113/113, 0 sai
--   - so dong se doi: 16;  va cham khoa: 0;  khoa rong: 0
--
-- ---------------------------------------------------------------------------
-- Thu tu chay
-- ---------------------------------------------------------------------------
-- Code moi da deploy luc 2026-09-18T06:19Z. Chay file nay CANG SOM CANG TOT:
-- tu luc deploy den luc chay xong, khoa trong DB va khoa code tinh ra lech
-- nhau o 16 brand duoi day, va mot lan reveal dung mot trong so do se sinh
-- brand trung. Scan thi khong hong du lieu, chi ton them luot.

begin;

-- ---------------------------------------------------------------------------
-- Chan truoc: khoa moi co lam trung nhau khong
-- ---------------------------------------------------------------------------
-- brand.name_key la `not null unique`. Neu hai brand khac nhau dung ve cung
-- mot khoa thi UPDATE se vo giua chung - dung han lai va xu ly tay, KHONG de
-- transaction vo voi mot thong bao kho hieu.
do $$
declare v_trung text;
begin
  select string_agg(k || '  <-  ' || ds, E'\n')
    into v_trung
  from (
    select btrim(regexp_replace(name_key, '[^[:alnum:]]+', ' ', 'g')) as k,
           string_agg(name, ', ') as ds
      from brand
     group by 1
    having count(*) > 1
  ) t;

  if v_trung is not null then
    raise exception E'Khoa moi lam trung brand, chua doi gi ca. Gop tay cac dong nay truoc:\n%', v_trung;
  end if;
end $$;

-- Khoa rong khong dung duoc (name_key not null, va app coi khoa rong la
-- "khong co ten"). Xay ra khi ten brand khong co mot chu/so nao.
do $$
declare v_rong text;
begin
  select string_agg(name, ', ')
    into v_rong
    from brand
   where btrim(regexp_replace(name_key, '[^[:alnum:]]+', ' ', 'g')) = '';

  if v_rong is not null then
    raise exception 'Ten brand nay chuan hoa ra chuoi rong, chua doi gi ca: %', v_rong;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Doi
-- ---------------------------------------------------------------------------
update brand
   set name_key = btrim(regexp_replace(name_key, '[^[:alnum:]]+', ' ', 'g'))
 where name_key <> btrim(regexp_replace(name_key, '[^[:alnum:]]+', ' ', 'g'));

commit;


-- ---------------------------------------------------------------------------
-- Kiem tra sau khi chay (chay rieng, sau khi commit)
-- ---------------------------------------------------------------------------

-- 1. Khong con khoa nao chua dau cau. Phai tra ve 0.
select count(*) as con_dau_cau
  from brand
 where name_key ~ '[^[:alnum:] ]';

-- 2. L'Oreal Paris da noi lai duoc voi alias cua no chua.
--    Cot employer phai ra "L'Oreal Vietnam"; truoc khi chay thi no null.
select b.name, b.name_key, a.alias, a.employer
  from brand b
  left join brand_alias a
    on btrim(regexp_replace(lower(a.alias), '[^[:alnum:]]+', ' ', 'g')) = b.name_key
 where b.name_key = 'l oreal paris';

-- 3. Khong sinh brand trung trong khe giua deploy va luc chay file nay.
--    Phai tra ve 0 dong.
select name_key, string_agg(name, ', ') as cac_dong, count(*)
  from brand
 group by name_key
having count(*) > 1;

-- KHONG can sua brand_alias.alias: gomAliasTheoUuTien() goi nameKey() tren
-- chinh gia tri luu trong bang, nen "l oreal paris" va "l'oreal paris" deu ve
-- cung mot khoa khi doc. De nguyen du lieu goc thi con doc duoc admin da nhap
-- gi.
