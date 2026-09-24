-- Part C1 + C2 cua bao cao "Search rework + cleanup".
--
-- Khong co thu muc migrations trong du an. File nay dat rieng, ten ro rang,
-- chay tay qua Supabase SQL Editor - giong cach schema.sql, can_use_category.sql
-- va fix_alias_priority.sql da lam.
--
-- Da xac minh truoc khi viet file nay (doc qua PostgREST OpenAPI va goi RPC
-- CHI-DOC, khong ghi gi - xem CLAUDE.md phan "Ranh gioi truy cap database"):
--   - quota_config hien co: id, updated_by, updated_at, measure_since,
--     daily_brand_limit (300), daily_profile_limit (6000), period_started_at,
--     locked_until, locked_reason. KHONG co cot rieng cho "ai/luc nao sua
--     daily_brand_limit" - updated_at/updated_by la CHUNG cho ca dong, va cron
--     ghi de ca hai moi dem.
--   - quota_period_start() DA TON TAI va goi duoc (RPC doc, khong tham so).
--     Goi that: tra ve "2026-09-10T17:00:00.298993+00:00", TRUNG KHOP tuyet
--     doi voi quota_config.period_started_at hien tai. Day gan nhu chac chan
--     la dinh nghia canonical ma check_quota_trip dang dung (hoac nen dung).
--   - credit_ledger.job_id: cot uuid, KHONG co <fk/> trong OpenAPI - xac nhan
--     dung nhu [user] da noi, chua co foreign key.
--
-- CHUA xac minh duoc (khong co ket noi Postgres truc tiep, chi co PostgREST -
-- xem CLAUDE.md): noi dung THAT SU cua check_quota_trip(). Vi vay file nay
-- KHONG dong cham vao ham do - xem lap luan o Phan 1 duoi day ve ly do va he
-- qua cua gioi han nay.
begin;

-- ---------------------------------------------------------------------------
-- Phan 1: cron co nen tu reset nua khong - LAP LUAN, khong tu chon thay
-- ---------------------------------------------------------------------------
--
-- Hien co HAI noi dat lai ky han cua quota_config:
--   A) pg_cron "reset-quota-daily" (0 17 * * * UTC = 00:00 VN), chay nhu
--      postgres: `update quota_config set period_started_at = now(),
--      locked_until = null, locked_reason = null, updated_at = now()`.
--   B) trigger check_quota_trip (AFTER tren search_usage), theo mo ta cua
--      [user]: dat period_started_at bang
--      greatest(coalesce(locked_until, now()), nua-dem-gio-VN-hom-nay).
--
-- HAI VAN DE, khong phai mot:
--   1. Cong thuc period_started_at LECH NHAU (now() thuan tuy o cron, mot
--      cong thuc co dieu kien o trigger) - dung loai loi ky_bat_dau/
--      resetsAtFromPeriodStart da bi mot lan trong tuan nay.
--   2. NANG HON: cron xoa locked_until/locked_reason VO DIEU KIEN luc 00:00.
--      Cong thuc greatest(coalesce(locked_until, now()), ...) o trigger ham y
--      MOT khoa dang con hieu luc (locked_until nam SAU nua dem) khong duoc
--      xoa som - do la ly do no dung greatest() thay vi gan thang nua dem.
--      Cron hien tai KHONG ton trong dieu do: mot khoa dat luc 23:00 keo dai
--      24 tieng (het han 23:00 hom sau) se bi cron xoa mat luc 00:00, tuc con
--      chua day 1 tieng sau khi bi khoa - som hon du dinh gan mot ngay.
--
-- HAI LUA CHON de sua, va tai sao chon phuong an ben duoi:
--
--   (a) Cron goi MOT ham dung chung (vi du sua check_quota_trip de tach phan
--       reset ra rieng, cron goi lai chinh ham do). Uu diem: van co "reset
--       dung gio", khong phai doi den luot quet dau tien cua ngay moi. Nhuoc
--       diem LON: doi hoi viet lai toan bo logic reset cho DUNG voi
--       check_quota_trip - ke ca phan "khong xoa khoa dang hieu luc" o Van De
--       2 - MA KHONG DOC DUOC MA NGUON THAT CUA check_quota_trip() (PostgREST
--       khong lo dieu do, xem CLAUDE.md). Doan mo lai mot cong thuc chua thay
--       tan mat chinh la kieu gia dinh da gay ra vu ky_bat_dau.
--
--   (b) BO LICH CRON NAY, de check_quota_trip la noi DUY NHAT dat lai ky han.
--       Trigger nay chay tren MOI dong search_usage moi ghi, tuc dung LUC
--       quota that su duoc dung toi - khong can mot cron rieng chi de "don
--       dep dung gio". Doi voi mot ngay khong ai quet gi, quota_config se
--       "tre" mot chut (van mang trang thai ky truoc) cho den luot quet dau
--       tien cua ngay moi - nhung do CHI la ve mat hinh thuc (bang so trong
--       SQL Editor/UsagePanel), khong anh huong dung/sai cua viec cho phep
--       hay khoa mot luot quet, vi trigger luon chay TRUOC KHI luot quet do
--       duoc dem.
--
--   CHON (b). Ly do quyet dinh: (b) khong doi hoi doan lai mot dong logic
--   chua tung thay, con (a) thi co - va Van De 2 (xoa khoa som) cho thay doan
--   sai la co that, khong phai ly thuyet. An toan hon la bo bot mot nguoi ghi,
--   khong phai viet them mot ban sao thu ba.
--
--   Neu [user] van muon giu cron (uu tien "so lieu luon tuoi" hon "khong doan
--   mo"), lenh thay the nam o cuoi file, DA CO GHI CHU RO RANG no van con giu
--   nguyen Van De 2 cho den khi check_quota_trip duoc doc va sap xep lai cho
--   dung.
select cron.unschedule('reset-quota-daily');

-- ---------------------------------------------------------------------------
-- Phan 2: cot rieng cho "ai/luc nao sua han muc tay", cron khong dung toi duoc
-- ---------------------------------------------------------------------------
--
-- Khong co duong app nao ghi daily_brand_limit/daily_profile_limit (da kiem
-- toan bo app/ - khong tim thay). Moi lan sua deu qua SQL Editor, tuc
-- auth.uid() se la NULL trong phien do - limits_updated_by vi vay THUONG SE
-- NULL cho lan sua tiep theo, va DUNG NHU VAY: no dung noi that "khong ro ai,
-- vi khong qua app", con hon la ngam dinh sai mot nguoi. Neu ve sau co man
-- hinh admin sua han muc qua app (RLS-scoped client), cot nay se tu dien dung.
alter table quota_config
  add column if not exists limits_updated_at timestamptz,
  add column if not exists limits_updated_by uuid references profile(id) on delete set null;

create or replace function quota_config_limits_audit()
returns trigger language plpgsql as $$
begin
  -- CHI dong khi chinh hai cot han muc doi - cron reset (period_started_at,
  -- locked_until, locked_reason) khong cham vao day nen khong lam dong nay
  -- chay, dung nhu yeu cau "cron khong duoc xoa dau vet".
  if new.daily_brand_limit is distinct from old.daily_brand_limit
     or new.daily_profile_limit is distinct from old.daily_profile_limit then
    new.limits_updated_at := now();
    new.limits_updated_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists quota_config_limits_audit_trg on quota_config;
create trigger quota_config_limits_audit_trg
  before update on quota_config
  for each row execute function quota_config_limits_audit();

-- ---------------------------------------------------------------------------
-- Phan 3 (C2): credit_ledger.job_id -> job.id
-- ---------------------------------------------------------------------------
-- [user] da xac nhan khong co job_id mo coi nao, nen them thang duoc.
-- on delete set null: giu dong ledger lam ho so tien da tieu ke ca khi job
-- (ban ghi trang thai tam thoi, khong phai so lieu tai chinh) bi xoa - cung
-- kieu on delete set null nhu cac cot created_by/... khac trong schema.sql.
alter table credit_ledger
  add constraint credit_ledger_job_id_fkey
  foreign key (job_id) references job(id) on delete set null;

commit;

-- ---------------------------------------------------------------------------
-- Kiem lai sau khi chay
-- ---------------------------------------------------------------------------
-- select limits_updated_at, limits_updated_by, daily_brand_limit, daily_profile_limit
--   from quota_config;
-- select jobname, schedule, command from cron.job where jobname = 'reset-quota-daily';
--   (phai KHONG con dong nao neu chon phuong an (b) o tren)

-- ---------------------------------------------------------------------------
-- Neu muon giu cron thay vi bo han (phuong an (a) o Phan 1) - CHUA sua Van De
-- 2 (xoa khoa som), can doc check_quota_trip truoc khi tin dong nay du:
-- select cron.schedule('reset-quota-daily', '0 17 * * *',
--   $$update quota_config set period_started_at = quota_period_start()$$);
