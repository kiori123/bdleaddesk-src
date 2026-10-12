-- Tach KENH (SOCOM) ra khoi NGANH HANG.
--
-- Khong co thu muc migrations trong du an. File nay dat rieng, ten ro rang,
-- chay tay qua Supabase SQL Editor - giong can_use_category.sql,
-- fix_alias_priority.sql, don_alias_hoc_sai.sql.
--
-- ===========================================================================
-- VAN DE
-- ===========================================================================
--
-- "Livestream" dang nam trong bang `category`, canh F&B va Beauty. Nhung no
-- khong phai mot nganh hang - no la KENH ban hang (SOCOM). Hau qua do duoc
-- tren DB that:
--
--   - 81 brand bi xep vao do deu la brand doanh nghiep that: Levi's, LG,
--     Casio, Olay, KAO, Kenvue, AB InBev, Kymdan, Fahasa. Khong mot KOL nao.
--     Mot dot day live cho Huggies van la Mom & Baby, nhung no bi ghi la
--     Livestream vinh vien.
--
--   - `damBaoBrand()` upsert voi ignoreDuplicates, nen AI REVEAL TRUOC thi
--     chot nganh cua brand mai mai. PIC sau reveal dung nganh cung khong doi
--     duoc. Day la ly do "lau lau bo vao live, lau lau bo vao cate dung".
--
--   - Ngan sach va nganh bi tron lam mot. 36 credit da bi tru vao ngan sach
--     mot nganh trong khi contact roi vao nganh khac, va khong chi Livestream:
--     F&B sang Mom & Baby 7, FMCG sang Mom & Baby 6, Beauty sang FMCG 4.
--
-- ===========================================================================
-- CACH CHUA
-- ===========================================================================
--
-- Giu NGUYEN cot `credit_ledger.category_id` va `brand.category_id`. Schema da
-- tach san hai chieu nay tu dau, chi la khong ai dung dung:
--
--   credit_ledger.category_id  = NGAN SACH nao tra tien   (SOCOM tra duoc)
--   brand.category_id          = brand thuoc NGANH nao    (luon la nganh that)
--
-- File nay them ba thu de hai chieu do song duoc canh nhau:
--
--   1. `category.kind`    - danh dau dong nao la kenh, dong nao la nganh hang.
--   2. `brand_channel`    - kenh nao da lam brand nao. Can cho QUYEN XEM.
--   3. `contact.channel_id` - contact nay do kenh nao tim ra.
--
-- Va sua `brand_read`/`brand_write` de SOCOM van xem duoc brand ho vua lam,
-- du brand do nam duoi Mom & Baby.

-- ---------------------------------------------------------------------------
-- PHAN 1 - CHI DOC. Xem hien trang truoc.
-- ---------------------------------------------------------------------------

-- 1a. Cac category dang co, va bao nhieu brand moi cai.
select c.name, c.active, count(b.id) as so_brand
from category c left join brand b on b.category_id = c.id
group by c.id, c.name, c.active
order by count(b.id) desc;

-- 1b. 81 brand dang nam duoi Livestream - day la danh sach se phai xep lai.
select b.name, count(ct.id) as so_contact
from brand b
join category c on c.id = b.category_id and c.name = 'Livestream'
left join contact ct on ct.brand_id = b.id
group by b.id, b.name
order by count(ct.id) desc, b.name;

-- ---------------------------------------------------------------------------
-- PHAN 2 - THEM CAU TRUC. An toan, khong doi mot dong du lieu nao.
-- ---------------------------------------------------------------------------

begin;

  -- 2a. Danh dau kenh va nganh hang.
  --
  -- Mac dinh 'product' nen MOI dong dang co giu nguyen y nghia cu - khong
  -- dong nao doi hanh vi cho den khi duoc danh dau ro la kenh.
  alter table category
    add column if not exists kind text not null default 'product';

  alter table category
    drop constraint if exists category_kind_check;
  alter table category
    add constraint category_kind_check check (kind in ('product', 'channel'));

  -- Livestream la kenh. Ten co the khac hoa thuong tuy luc nhap.
  update category set kind = 'channel' where lower(btrim(name)) = 'livestream';

  -- 2b. Kenh nao da lam brand nao.
  --
  -- Can cho QUYEN XEM: sau khi xep Huggies ve Mom & Baby, brand_read chi cho
  -- chu Mom & Baby thay no, va SOCOM se mat quyen xem chinh brand ho vua lam.
  -- Bang nay la cho ghi lai "kenh nay co phan trong brand nay".
  create table if not exists brand_channel (
    brand_id    uuid not null references brand(id) on delete cascade,
    category_id uuid not null references category(id) on delete cascade,
    created_at  timestamptz not null default now(),
    primary key (brand_id, category_id)
  );
  create index if not exists brand_channel_cat_idx on brand_channel(category_id);

  -- 2c. Contact nay do kenh nao tim ra.
  --
  -- NULL = duong thuong, khong qua kenh nao. Khong dat mac dinh: mot gia tri
  -- mac dinh se gan nhan cho ca 1.193 dong cu ma khong ai kiem duoc dung sai.
  alter table contact
    add column if not exists channel_id uuid references category(id);
  create index if not exists contact_channel_idx on contact(channel_id)
    where channel_id is not null;

commit;

-- ---------------------------------------------------------------------------
-- PHAN 3 - QUYEN XEM. Doc ky truoc khi chay.
-- ---------------------------------------------------------------------------
--
-- Ham SECURITY DEFINER, khong viet thang subquery vao policy: brand_channel
-- se co RLS cua chinh no, va mot policy doc bang khac ben trong policy de
-- sinh de quy. Du an da dung dung cach nay cho is_admin()/my_categories()
-- (xem can_use_category.sql), nen giu nguyen loi do.

begin;

  create or replace function brand_qua_kenh(p_brand uuid)
  returns boolean language sql stable security definer set search_path = public as $$
    select exists (
      select 1 from brand_channel bc
      where bc.brand_id = p_brand
        and bc.category_id in (select my_categories())
    );
  $$;

  revoke execute on function brand_qua_kenh(uuid) from public;
  grant execute on function brand_qua_kenh(uuid) to authenticated, service_role;

  -- Them MOT ve "hoac da lam qua kenh". Hai ve cu giu nguyen chu khong viet
  -- lai: ai dang thay gi hom nay thi mai van thay dung the.
  drop policy if exists brand_read on brand;
  create policy brand_read on brand for select
    using (
      is_admin()
      or (category_id is not null and category_id in (select my_categories()))
      or brand_qua_kenh(id)
    );

  drop policy if exists brand_write on brand;
  create policy brand_write on brand for all
    using (
      is_admin()
      or (category_id is not null and category_id in (select my_categories()))
      or brand_qua_kenh(id)
    )
    with check (
      is_admin()
      or (category_id is not null and category_id in (select my_categories()))
      or brand_qua_kenh(id)
    );

  -- brand_channel: doc duoc neu la kenh cua minh hoac la admin. Chi app ghi
  -- (qua service role), nen khong mo duong ghi cho nguoi dung.
  alter table brand_channel enable row level security;
  drop policy if exists brand_channel_read on brand_channel;
  create policy brand_channel_read on brand_channel for select
    using (is_admin() or category_id in (select my_categories()));

commit;

-- `contact` KHONG can sua policy: contact_rw da an theo brand
-- (exists (select 1 from brand b where b.id = brand_id)), nen he SOCOM thay
-- duoc brand thi tu dong thay contact cua no.

-- ---------------------------------------------------------------------------
-- PHAN 4 - KIEM LAI SAU KHI CHAY
-- ---------------------------------------------------------------------------

-- 4a. Livestream da thanh kenh chua. Phai ra dung mot dong, kind = 'channel'.
select name, kind, active from category where kind = 'channel';

-- 4b. Cau truc moi da co chua.
select
  (select count(*) from information_schema.columns
    where table_name = 'category' and column_name = 'kind') as co_cot_kind,
  (select count(*) from information_schema.columns
    where table_name = 'contact' and column_name = 'channel_id') as co_cot_channel_id,
  (select count(*) from information_schema.tables
    where table_name = 'brand_channel') as co_bang_brand_channel;

-- 4c. Chua ai mat quyen xem gi: so brand moi nguoi thay duoc phai KHONG GIAM.
--     Chay bang tai khoan admin thi ra tong so brand.
select count(*) as brand_toi_thay_duoc from brand;

-- ---------------------------------------------------------------------------
-- PHAN 5 - XEP LAI 81 BRAND. KHONG tu dong, co y.
-- ---------------------------------------------------------------------------
--
-- Khong co cach nao doan dung nganh cua mot brand bang code: Olay la Beauty,
-- D-Nee la Mom & Baby, Budweiser la F&B, Levi's la Fashion - do la kien thuc
-- cua nguoi lam BD, khong nam trong du lieu.
--
-- App se co man gan hang loat (Admin > Brands) de lam viec nay bang chuot.
-- Neu muon lam bang SQL thi theo mau duoi, tung brand mot:
--
--   -- giu dau vet la SOCOM da lam brand nay, TRUOC khi doi nganh
--   insert into brand_channel (brand_id, category_id)
--   select b.id, b.category_id from brand b where b.name = 'Huggies'
--   on conflict do nothing;
--
--   update brand set category_id = (select id from category where name = 'Mom & Baby')
--   where name = 'Huggies';
--
-- Thu tu quan trong: ghi brand_channel TRUOC, vi sau khi doi category_id thi
-- khong con doc duoc kenh cu tu chinh dong brand nua.
