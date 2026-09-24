-- Mot nguon su that duy nhat cho "nguoi nay dung duoc category nay".
--
-- Khong co thu muc migrations nao trong du an, va schema.sql cung khong con
-- dung voi DB that (nhieu bang/ham da them thang qua SQL Editor ma khong ghi
-- lai vao schema.sql - vi du search_usage, quota_config, my_quota(),
-- app_setting deu KHONG nam trong schema.sql du app dang dung hang ngay). Vi
-- vay file nay dat rieng, ten ro rang, chay tay qua Supabase SQL Editor
-- giong het cach README noi ve schema.sql, KHONG gia vo co he thong migration
-- nao dang ton tai.
--
-- Truoc day co BA noi tu dinh nghia lai "admin dang hoat dong" / "PIC so huu
-- category nao": is_admin(), my_categories(), va canUseCategory() ben
-- lib/credit.ts (doc thang bang profile/profile_category). Gio chi con MOT:
-- can_use_category() duoi day. is_admin()/my_categories() va canUseCategory()
-- (TypeScript) deu goi lai ham nay hoac cac ham phu no dung.

-- ---------------------------------------------------------------------------
-- Cac dinh nghia goc, dung chung
-- ---------------------------------------------------------------------------

-- "Dang hoat dong" - dieu kien ma CA hai nhanh (admin va PIC) deu phai qua.
-- Khoa tai khoan (active = false) phai cat quyen bat ke quyen do la admin hay
-- chi so huu mot category, va bat ke dong profile_category co con nguyen hay
-- khong.
create or replace function is_active_profile(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profile where id = p_user and active
  );
$$;

-- "Admin dang hoat dong" - dung chung cho is_admin() (khong tham so, doc
-- auth.uid()) va can_use_category() (co tham so, dung duoc ca duoi service
-- role, noi khong co auth.uid()).
create or replace function is_active_admin(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profile where id = p_user and role = 'admin' and active
  );
$$;

-- "PIC (dang hoat dong) so huu category nay" - KHONG kiem active o day, ham
-- goi (can_use_category) da kiem is_active_profile truoc roi.
create or replace function owns_category(p_user uuid, p_category uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profile_category
    where profile_id = p_user and category_id = p_category
  );
$$;

-- ---------------------------------------------------------------------------
-- Cac ham cong khai, dung is_active_profile/is_active_admin/owns_category
-- ---------------------------------------------------------------------------

-- Khong doi chu ky: cho khac dang goi is_admin() ma khong truyen tham so.
-- Truoc day ham nay tu viet lai dieu kien, gio chi uy quyen cho
-- is_active_admin.
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select is_active_admin(auth.uid());
$$;

-- Truoc day KHONG kiem active, nen mot PIC bi khoa tai khoan nhung con phien
-- dang nhap hop le (JWT chua het han) van thay category cua ho qua RLS
-- (brand_read, ledger_read deu dua vao my_categories()). Them
-- is_active_profile de dong bo voi can_use_category: bi khoa la mat quyen
-- ngay, khong doi den luc dang xuat/dang nhap lai.
create or replace function my_categories()
returns setof uuid language sql stable security definer set search_path = public as $$
  select category_id from profile_category
  where profile_id = auth.uid() and is_active_profile(auth.uid());
$$;

-- Ham chinh: is_admin() OR PIC so huu category do, ca hai deu doi active.
-- Nhan p_user RO RANG (khong doc auth.uid()) vi reserveCredit goi ham nay
-- (qua canUseCategory ben TypeScript) duoi supabaseAdmin() - service role
-- khong mang theo phien dang nhap nao, auth.uid() se la null.
--
-- Vi nhan p_user tuy y, ham nay co the bi dung de do xem NGUOI KHAC co thuoc
-- category nao (thong tin noi bo, khong nhay cam nhu credit/contact nhung
-- van la thong tin phan cong noi bo). Chan bang IF: role authenticated (PIC
-- dang dang nhap qua RLS-scoped client) chi duoc hoi ve CHINH HO; chi
-- service_role (goi tu server, khong co phien) moi duoc hoi ve nguoi bat ky.
-- Xem phan GRANT/REVOKE o cuoi file.
create or replace function can_use_category(p_user uuid, p_category uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if auth.role() = 'authenticated' and p_user is distinct from auth.uid() then
    return false;
  end if;

  return is_active_admin(p_user) or (
    is_active_profile(p_user) and owns_category(p_user, p_category)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Quyen thuc thi
-- ---------------------------------------------------------------------------
--
-- Cac ham phu (is_active_profile, is_active_admin, owns_category) CHI duoc
-- goi tu ben trong cac ham SECURITY DEFINER khac trong file nay - Postgres
-- kiem EXECUTE theo NGUOI SO HUU ham goi (definer), khong phai nguoi dung
-- cuoi, nen khong can GRANT rieng cho authenticated/service_role o day. Thu
-- hoi EXECUTE mac dinh tu PUBLIC de tranh ai do goi thang, vong qua kiem tra
-- p_user o can_use_category.
revoke execute on function is_active_profile(uuid) from public;
revoke execute on function is_active_admin(uuid) from public;
revoke execute on function owns_category(uuid, uuid) from public;

-- Ba ham nay la cho app thuc su goi qua .rpc(): can ca authenticated
-- (RLS-scoped client trong /api/scan, /api/reveal) lan service_role
-- (supabaseAdmin trong reserveCredit).
revoke execute on function is_admin() from public;
revoke execute on function my_categories() from public;
revoke execute on function can_use_category(uuid, uuid) from public;

grant execute on function is_admin() to authenticated, service_role;
grant execute on function my_categories() to authenticated, service_role;
grant execute on function can_use_category(uuid, uuid) to authenticated, service_role;
