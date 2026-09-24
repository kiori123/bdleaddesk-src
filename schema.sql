-- OnPoint Lead Desk - Postgres schema (Supabase)
-- Chay mot lan trong SQL Editor. Idempotent o muc tao bang.
--
-- Nguyen tac:
--   1. Postgres la nguon that. Google Sheets tut xuong thanh ban mirror.
--   2. Credit tru o app, khong tru o n8n. n8n chi bao lai thuc te de doi soat.
--   3. Moi thu doc/ghi deu qua RLS. Khong co duong vong nao cho client.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Nguoi dung
-- ---------------------------------------------------------------------------

create type user_role as enum ('admin', 'pic');

create table profile (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text not null default '',
  role        user_role not null default 'pic',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Tao profile tu dong khi co user moi trong auth.users.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profile (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Category - admin them/bot tuy y, khong hardcode nhu ben n8n
-- ---------------------------------------------------------------------------

create table category (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  slug        text not null unique,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Ai phu trach category nao. Day la truc phan quyen duy nhat.
create table profile_category (
  profile_id  uuid not null references profile(id) on delete cascade,
  category_id uuid not null references category(id) on delete cascade,
  primary key (profile_id, category_id)
);

-- ---------------------------------------------------------------------------
-- Brand + lien he
-- ---------------------------------------------------------------------------

create type brand_stage as enum (
  'first_meeting', 'internal_review', 'bp_pitch', 'negotiating', 'live'
);

create table brand (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  -- Khoa chuan hoa: bo dau, thuong hoa, gom khoang trang. Dung de chong trung.
  name_key          text not null unique,
  category_id       uuid references category(id) on delete restrict,
  tier              int not null default 1,
  stage             brand_stage,
  stage_changed_at  timestamptz,
  drive_folder_id   text,
  drive_folder_link text,
  created_by        uuid references profile(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index brand_category_idx on brand(category_id);

-- Lich su doi stage. Bang brand chi giu trang thai hien tai.
create table brand_stage_event (
  id          uuid primary key default uuid_generate_v4(),
  brand_id    uuid not null references brand(id) on delete cascade,
  from_stage  brand_stage,
  to_stage    brand_stage,
  changed_by  uuid references profile(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Note doi tu "mot o text de ghi de" sang "nhieu dong noi tiep".
-- Ben n8n moi brand chi co dung mot note, sua la mat ban cu.
create table brand_note (
  id          uuid primary key default uuid_generate_v4(),
  brand_id    uuid not null references brand(id) on delete cascade,
  body        text not null,
  created_by  uuid references profile(id) on delete set null,
  created_at  timestamptz not null default now()
);

create type contact_source as enum (
  'signalhire', 'seed_verified', 'pasted_linkedin', 'manual'
);

create table contact (
  id            uuid primary key default uuid_generate_v4(),
  brand_id      uuid not null references brand(id) on delete cascade,
  full_name     text not null,
  job_title     text,
  email         text,
  phone         text,
  linkedin_url  text,
  location      text,
  -- Thu hang trong org chart, so cang nho cang cao. Giu nguyen thang do cu.
  org_rank      int,
  source        contact_source not null default 'signalhire',
  external_uid  text,
  revealed_by   uuid references profile(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index contact_brand_idx on contact(brand_id);
create unique index contact_uid_idx on contact(brand_id, external_uid)
  where external_uid is not null;

-- ---------------------------------------------------------------------------
-- Credit
-- ---------------------------------------------------------------------------

-- Han muc cap theo thang. Khong cong don: moi thang mot dong rieng, het thang
-- la het, phan chua dung khong mang sang.
create table credit_budget (
  id           uuid primary key default uuid_generate_v4(),
  category_id  uuid not null references category(id) on delete cascade,
  -- Luon la ngay mung 1 cua thang do.
  period_month date not null,
  granted      int not null default 0 check (granted >= 0),
  updated_by   uuid references profile(id) on delete set null,
  updated_at   timestamptz not null default now(),
  unique (category_id, period_month)
);

-- So giao dich. Ghi tung lan tieu thay vi cong don vao mot o dem.
-- Ly do: doi category cua brand ve sau khong lam so lieu da tieu nhay lung tung,
-- va co san bao cao "thang nay cate nao tieu bao nhieu, ai tieu".
create type ledger_status as enum ('reserved', 'committed', 'released');

create table credit_ledger (
  id           uuid primary key default uuid_generate_v4(),
  category_id  uuid not null references category(id) on delete restrict,
  brand_id     uuid references brand(id) on delete set null,
  job_id       uuid,
  amount       int not null check (amount > 0),
  status       ledger_status not null default 'reserved',
  -- Contact lay tu seed khong goi API nen amount = 0 se khong tao dong nao.
  note         text,
  created_by   uuid references profile(id) on delete set null,
  created_at   timestamptz not null default now(),
  settled_at   timestamptz
);

create index ledger_period_idx on credit_ledger(category_id, created_at);

-- Con lai bao nhieu trong thang hien tai.
create or replace view category_credit_status as
select
  c.id            as category_id,
  c.name          as category_name,
  date_trunc('month', now())::date as period_month,
  coalesce(b.granted, 0) as granted,
  coalesce(sum(l.amount) filter (
    where l.status in ('reserved', 'committed')
      and l.created_at >= date_trunc('month', now())
  ), 0)::int      as used,
  coalesce(b.granted, 0) - coalesce(sum(l.amount) filter (
    where l.status in ('reserved', 'committed')
      and l.created_at >= date_trunc('month', now())
  ), 0)::int      as remaining
from category c
left join credit_budget b
  on b.category_id = c.id and b.period_month = date_trunc('month', now())::date
left join credit_ledger l on l.category_id = c.id
group by c.id, c.name, b.granted;

create type request_status as enum ('pending', 'approved', 'rejected', 'expired');

create table credit_request (
  id            uuid primary key default uuid_generate_v4(),
  category_id   uuid not null references category(id) on delete cascade,
  brand_name    text,
  amount        int not null check (amount > 0),
  reason        text,
  status        request_status not null default 'pending',
  requested_by  uuid references profile(id) on delete set null,
  decided_by    uuid references profile(id) on delete set null,
  decided_at    timestamptz,
  -- Token dung mot lan trong mail duyet, het han sau 48 tieng.
  action_token  text not null unique,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Job - moi lan goi sang n8n la mot job co trang thai
-- ---------------------------------------------------------------------------

create type job_status as enum ('queued', 'running', 'done', 'failed');

create table job (
  id           uuid primary key default uuid_generate_v4(),
  kind         text not null,
  status       job_status not null default 'queued',
  category_id  uuid references category(id) on delete set null,
  payload      jsonb not null default '{}'::jsonb,
  result       jsonb,
  error        text,
  created_by   uuid references profile(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index job_status_idx on job(status, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profile
    where id = auth.uid() and role = 'admin' and active
  );
$$;

create or replace function my_categories()
returns setof uuid language sql stable security definer set search_path = public as $$
  select category_id from profile_category where profile_id = auth.uid();
$$;

alter table profile           enable row level security;
alter table category          enable row level security;
alter table profile_category  enable row level security;
alter table brand             enable row level security;
alter table brand_stage_event enable row level security;
alter table brand_note        enable row level security;
alter table contact           enable row level security;
alter table credit_budget     enable row level security;
alter table credit_ledger     enable row level security;
alter table credit_request    enable row level security;
alter table job               enable row level security;

create policy profile_self_read on profile for select
  using (id = auth.uid() or is_admin());
create policy profile_admin_all on profile for all
  using (is_admin()) with check (is_admin());

create policy category_read on category for select using (true);
create policy category_admin on category for all
  using (is_admin()) with check (is_admin());

create policy pc_read on profile_category for select
  using (profile_id = auth.uid() or is_admin());
create policy pc_admin on profile_category for all
  using (is_admin()) with check (is_admin());

-- Brand chua gan category chi admin thay. Fail-closed o day la co chu dich:
-- brand khong co category thi khong tinh vao han muc nao ca, de mo cho moi
-- nguoi la mo luon duong ne credit.
create policy brand_read on brand for select
  using (is_admin() or (category_id is not null and category_id in (select my_categories())));
create policy brand_write on brand for all
  using (is_admin() or (category_id is not null and category_id in (select my_categories())))
  with check (is_admin() or (category_id is not null and category_id in (select my_categories())));

create policy note_rw on brand_note for all
  using (exists (select 1 from brand b where b.id = brand_id))
  with check (exists (select 1 from brand b where b.id = brand_id));

create policy stage_rw on brand_stage_event for all
  using (exists (select 1 from brand b where b.id = brand_id))
  with check (exists (select 1 from brand b where b.id = brand_id));

create policy contact_rw on contact for all
  using (exists (select 1 from brand b where b.id = brand_id))
  with check (exists (select 1 from brand b where b.id = brand_id));

create policy budget_read on credit_budget for select using (true);
create policy budget_admin on credit_budget for all
  using (is_admin()) with check (is_admin());

create policy ledger_read on credit_ledger for select
  using (is_admin() or category_id in (select my_categories()));
-- Ghi so chi qua service role o server. Client khong duoc tu them dong.
create policy ledger_admin on credit_ledger for all
  using (is_admin()) with check (is_admin());

create policy request_read on credit_request for select
  using (is_admin() or requested_by = auth.uid());
create policy request_create on credit_request for insert
  with check (requested_by = auth.uid());
create policy request_admin on credit_request for all
  using (is_admin()) with check (is_admin());

create policy job_read on job for select
  using (is_admin() or created_by = auth.uid());
create policy job_create on job for insert
  with check (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Du lieu khoi tao
-- ---------------------------------------------------------------------------

insert into category (name, slug) values
  ('Mom & Baby', 'mom-baby'),
  ('FMCG', 'fmcg'),
  ('F&B', 'f-and-b'),
  ('Beauty', 'beauty'),
  ('Fashion', 'fashion'),
  ('Health & EL', 'health-el')
on conflict (name) do nothing;
