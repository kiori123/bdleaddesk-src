-- Hai loi phat hien khi audit toan bo logic app theo yeu cau nguoi dung,
-- 2026-09-15. Chay tay qua Supabase SQL Editor, giong cach schema.sql,
-- can_use_category.sql, fix_alias_priority.sql da lam.

begin;

-- ---------------------------------------------------------------------------
-- Phan 1: contact_rw / note_rw / stage_rw thieu kiem tra category
-- ---------------------------------------------------------------------------
--
-- Ca ba policy nay (schema.sql:279-289) chi kiem "brand nay co ton tai
-- khong", khong kiem category_id nhu brand_read/brand_write da lam. Vi
-- brand_id la foreign key nen dieu kien do LUON DUNG cho moi dong - tuc la
-- BAT KY nguoi da dang nhap nao cung doc/sua/xoa duoc MOI contact, note,
-- stage event tren MOI brand, ke ca brand chua co category (fail-closed,
-- chi admin duoc thay theo CLAUDE.md) va brand thuoc category nguoi khac.
--
-- Sua theo dung mau brand_write: is_admin() HOAC brand co category va
-- category do nam trong my_categories() cua nguoi goi.

drop policy if exists contact_rw on contact;
create policy contact_rw on contact for all
  using (exists (
    select 1 from brand b where b.id = contact.brand_id
      and (is_admin() or (b.category_id is not null and b.category_id in (select my_categories())))
  ))
  with check (exists (
    select 1 from brand b where b.id = contact.brand_id
      and (is_admin() or (b.category_id is not null and b.category_id in (select my_categories())))
  ));

drop policy if exists note_rw on brand_note;
create policy note_rw on brand_note for all
  using (exists (
    select 1 from brand b where b.id = brand_note.brand_id
      and (is_admin() or (b.category_id is not null and b.category_id in (select my_categories())))
  ))
  with check (exists (
    select 1 from brand b where b.id = brand_note.brand_id
      and (is_admin() or (b.category_id is not null and b.category_id in (select my_categories())))
  ));

drop policy if exists stage_rw on brand_stage_event;
create policy stage_rw on brand_stage_event for all
  using (exists (
    select 1 from brand b where b.id = brand_stage_event.brand_id
      and (is_admin() or (b.category_id is not null and b.category_id in (select my_categories())))
  ))
  with check (exists (
    select 1 from brand b where b.id = brand_stage_event.brand_id
      and (is_admin() or (b.category_id is not null and b.category_id in (select my_categories())))
  ));

-- ---------------------------------------------------------------------------
-- Phan 2: reserveCredit() (lib/credit.ts) khong atomic
-- ---------------------------------------------------------------------------
--
-- reserveCredit doc category_credit_status.remaining bang mot SELECT, kiem
-- du han muc, roi INSERT credit_ledger o mot round-trip PostgREST khac. Hai
-- request cung category, cung luc, deu doc thay con du (vi khong ai da
-- INSERT xong), deu qua duoc kiem tra, deu insert - tong hai dong co the
-- vuot han muc that su, dung dieu ma thiet ke "dat cho truoc" (xem ghi chu
-- dau lib/credit.ts) sinh ra de chan.
--
-- Gom ca doc + kiem + insert vao MOT ham Postgres, khoa bang
-- pg_advisory_xact_lock theo category_id de serialize cac lan goi cung
-- category trong pham vi mot transaction - ham nay chi ton tai trong thoi
-- gian request, khoa tu nha khi transaction ket thuc (commit hoac rollback),
-- khong can don dep rieng.

create or replace function reserve_credit(
  p_category_id uuid,
  p_brand_id uuid,
  p_job_id uuid,
  p_amount int,
  p_user_id uuid
) returns table(ok boolean, reason text, remaining int, ledger_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status record;
  v_ledger_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(p_category_id::text));

  -- Phai qualify ccs.granted/ccs.remaining: cot OUT "remaining" cua chinh ham
  -- nay (xem "returns table(...)" o tren) trung ten voi cot remaining cua
  -- view, PL/pgSQL bao "column reference is ambiguous" (ma loi 42702) neu
  -- khong ghi ro nguon - da bat duoc loi nay khi kiem lai sau khi user chay
  -- ban dau, truoc khi kip deploy code goi ham nay.
  select ccs.granted, ccs.remaining into v_status
  from category_credit_status ccs
  where ccs.category_id = p_category_id;

  if v_status.granted is null or v_status.granted = 0 then
    return query select false, 'no_budget'::text, 0, null::uuid;
    return;
  end if;

  if v_status.remaining < p_amount then
    return query select false, 'insufficient'::text, v_status.remaining, null::uuid;
    return;
  end if;

  insert into credit_ledger (category_id, brand_id, job_id, amount, status, created_by)
  values (p_category_id, p_brand_id, p_job_id, p_amount, 'reserved', p_user_id)
  returning id into v_ledger_id;

  return query select true, null::text, v_status.remaining - p_amount, v_ledger_id;
end;
$$;

revoke execute on function reserve_credit(uuid, uuid, uuid, int, uuid) from public;
grant execute on function reserve_credit(uuid, uuid, uuid, int, uuid) to service_role;

commit;

-- ---------------------------------------------------------------------------
-- Kiem lai sau khi chay
-- ---------------------------------------------------------------------------
-- select policyname, qual from pg_policies
--   where tablename in ('contact','brand_note','brand_stage_event') order by tablename;
-- select proname from pg_proc where proname = 'reserve_credit';
--
-- Sau khi chay file nay, deploy code moi cua lib/credit.ts (da sua
-- reserveCredit() de goi RPC reserve_credit thay vi tu lam hai buoc rieng) -
-- hai ben phai len cung luc, khong thi reserveCredit cu se goi mot ham chua
-- ton tai va crash.
