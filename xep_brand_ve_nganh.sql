-- Xep lai brand tu "Livestream" ve dung nganh hang cua chung.
--
-- Chay sau socom_kenh_rieng.sql (can bang brand_channel va cot category.kind).
--   node chay-sql.mjs xep_brand_ve_nganh.sql
--
-- ===========================================================================
-- VI SAO
-- ===========================================================================
--
-- "Livestream" la KENH (SOCOM), khong phai nganh hang. Nhung vi no tung nam
-- chung bang `category`, va `damBaoBrand()` upsert voi ignoreDuplicates - ai
-- reveal truoc chot nganh vinh vien - nen 93 brand doanh nghiep that da ket
-- lai duoi do: Levi's, LG, Olay, Kenvue, AB InBev, Casio, Kymdan, Fahasa.
--
-- Nguon da duoc vit (form scan bat chon nganh rieng khi tra bang ngan sach
-- kenh). File nay don phan da ket lai truoc do.
--
-- ===========================================================================
-- CHI 46 TRONG 93. CON LAI KHONG TU DONG DUOC.
-- ===========================================================================
--
-- 46 brand duoi day la nhung cai doc ten la biet nganh: Olay la Beauty,
-- Levi's la Fashion, Budweiser la F&B. Khong doan cai nao.
--
-- 47 brand con lai KHONG dong vao day, vi hai ly do khac nhau:
--
--   a) KHONG CO NGANH NAO VUA. Danh sach nganh hien co la Mom & Baby, FMCG,
--      F&B, Beauty, Fashion, Health & EL, China Project. Khong co cho cho
--      dien may (LG, Casio, Nagakawa, Imou, Samono, Kingsun, Gaabor,
--      Fujihome, HD Hyundai), ban le (Di Dong Viet, F.Studio, fahasa),
--      xuat ban (MCBooks, Nha Nam, Kim Dong), do choi (Mykingdom), hay
--      nem (Kymdan). Nhet dai vao FMCG la tao ra dung loai sai ma ca dot
--      nay di don. Can mot nganh moi, va do la quyet dinh cua nguoi.
--
--   b) TOI KHONG BIET BRAND DO. Keyshu, halita, masuto, Emoon, dodoto,
--      Libe, Bbstore'S, Embes, Bemine, Rechic, HECATECH, JETZT, GoChek,
--      Coretests, C-Store, FGH Group, Nesty, lien a chau. Doan la xep sai.
--
-- Xem Phan 3 de lay danh sach day du cua 47 cai do.
--
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- PHAN 1 - CHI DOC. Xem truoc 46 dong se doi.
-- ---------------------------------------------------------------------------

with xep (ten_brand, ten_nganh) as (values
    ('82x', 'Beauty'),
    ('evoluderm', 'Beauty'),
    ('Lanbena', 'Beauty'),
    ('Lemonade', 'Beauty'),
    ('Moroccanoil', 'Beauty'),
    ('Naruko', 'Beauty'),
    ('olay', 'Beauty'),
    ('Phấn Nụ Hoàng Cung', 'Beauty'),
    ('SVR', 'Beauty'),
    ('THORAKAO COSMETICS LTD.,', 'Beauty'),
    ('Wonjin', 'Beauty'),
    ('kosmen', 'Beauty'),
    ('ファイントゥデイ FineToday Co., Ltd.', 'Beauty'),
    ('Ăn Cùng Bà Tuyết', 'F&B'),
    ('AB InBev Southeast Asia', 'F&B'),
    ('budweiser', 'F&B'),
    ('Hạt Dinh Dưỡng Tây Nguyên', 'F&B'),
    ('goody', 'F&B'),
    ('i.soup', 'F&B'),
    ('Lothamilk', 'F&B'),
    ('oatside', 'F&B'),
    ('sanest', 'F&B'),
    ('Star Kombucha', 'F&B'),
    ('Tai Ky Food - Flour Joint Stock', 'F&B'),
    ('Tai Ky Food Flour JSC', 'F&B'),
    ('Taiky Food', 'F&B'),
    ('Thien Huong Food Joint Stock Company', 'F&B'),
    ('Thien Huong Food JSC', 'F&B'),
    ('Vietinter', 'F&B'),
    ('Cchat Clothes', 'Fashion'),
    ('Cocomay', 'Fashion'),
    ('Hagoo', 'Fashion'),
    ('Levi''s', 'Fashion'),
    ('Nón Sơn', 'Fashion'),
    ('Routine Vietnam', 'Fashion'),
    ('semir', 'Fashion'),
    ('Sixdo', 'Fashion'),
    ('Thiều Hoa', 'Fashion'),
    ('Tingoan', 'Fashion'),
    ('Bebechic', 'Mom & Baby'),
    ('D - Nee', 'Mom & Baby'),
    ('Best Nutrition', 'Health & EL'),
    ('Codeage', 'Health & EL'),
    ('Fresheen Health', 'Health & EL'),
    ('KAO', 'FMCG'),
    ('kenvue', 'FMCG')
)
select
  x.ten_brand,
  c_cu.name  as nganh_hien_tai,
  x.ten_nganh as nganh_moi,
  (select count(*) from contact ct where ct.brand_id = b.id) as so_contact
from xep x
join brand b on b.name = x.ten_brand
left join category c_cu on c_cu.id = b.category_id
left join category c_moi on c_moi.name = x.ten_nganh
order by x.ten_nganh, x.ten_brand;

-- Phai ra dung 46 dong, cot nganh_hien_tai deu la Livestream.
-- It hon 46 nghia la co ten brand khong khop - bao lai, dung chay Phan 2.

-- ---------------------------------------------------------------------------
-- PHAN 2 - DOI. Chay sau khi Phan 1 ra dung.
-- ---------------------------------------------------------------------------

begin;

  with xep (ten_brand, ten_nganh) as (values
    ('82x', 'Beauty'),
    ('evoluderm', 'Beauty'),
    ('Lanbena', 'Beauty'),
    ('Lemonade', 'Beauty'),
    ('Moroccanoil', 'Beauty'),
    ('Naruko', 'Beauty'),
    ('olay', 'Beauty'),
    ('Phấn Nụ Hoàng Cung', 'Beauty'),
    ('SVR', 'Beauty'),
    ('THORAKAO COSMETICS LTD.,', 'Beauty'),
    ('Wonjin', 'Beauty'),
    ('kosmen', 'Beauty'),
    ('ファイントゥデイ FineToday Co., Ltd.', 'Beauty'),
    ('Ăn Cùng Bà Tuyết', 'F&B'),
    ('AB InBev Southeast Asia', 'F&B'),
    ('budweiser', 'F&B'),
    ('Hạt Dinh Dưỡng Tây Nguyên', 'F&B'),
    ('goody', 'F&B'),
    ('i.soup', 'F&B'),
    ('Lothamilk', 'F&B'),
    ('oatside', 'F&B'),
    ('sanest', 'F&B'),
    ('Star Kombucha', 'F&B'),
    ('Tai Ky Food - Flour Joint Stock', 'F&B'),
    ('Tai Ky Food Flour JSC', 'F&B'),
    ('Taiky Food', 'F&B'),
    ('Thien Huong Food Joint Stock Company', 'F&B'),
    ('Thien Huong Food JSC', 'F&B'),
    ('Vietinter', 'F&B'),
    ('Cchat Clothes', 'Fashion'),
    ('Cocomay', 'Fashion'),
    ('Hagoo', 'Fashion'),
    ('Levi''s', 'Fashion'),
    ('Nón Sơn', 'Fashion'),
    ('Routine Vietnam', 'Fashion'),
    ('semir', 'Fashion'),
    ('Sixdo', 'Fashion'),
    ('Thiều Hoa', 'Fashion'),
    ('Tingoan', 'Fashion'),
    ('Bebechic', 'Mom & Baby'),
    ('D - Nee', 'Mom & Baby'),
    ('Best Nutrition', 'Health & EL'),
    ('Codeage', 'Health & EL'),
    ('Fresheen Health', 'Health & EL'),
    ('KAO', 'FMCG'),
    ('kenvue', 'FMCG')
  )
  -- THU TU QUAN TRONG: ghi brand_channel TRUOC khi doi category_id.
  -- Sau khi doi, khong con doc duoc kenh cu tu chinh dong brand nua, va SOCOM
  -- se mat quyen xem brand ho vua lam (brand_read chi con ve "nganh cua toi").
  insert into brand_channel (brand_id, category_id)
  select b.id, b.category_id
  from xep x
  join brand b on b.name = x.ten_brand
  where b.category_id is not null
  on conflict do nothing;

  with xep (ten_brand, ten_nganh) as (values
    ('82x', 'Beauty'),
    ('evoluderm', 'Beauty'),
    ('Lanbena', 'Beauty'),
    ('Lemonade', 'Beauty'),
    ('Moroccanoil', 'Beauty'),
    ('Naruko', 'Beauty'),
    ('olay', 'Beauty'),
    ('Phấn Nụ Hoàng Cung', 'Beauty'),
    ('SVR', 'Beauty'),
    ('THORAKAO COSMETICS LTD.,', 'Beauty'),
    ('Wonjin', 'Beauty'),
    ('kosmen', 'Beauty'),
    ('ファイントゥデイ FineToday Co., Ltd.', 'Beauty'),
    ('Ăn Cùng Bà Tuyết', 'F&B'),
    ('AB InBev Southeast Asia', 'F&B'),
    ('budweiser', 'F&B'),
    ('Hạt Dinh Dưỡng Tây Nguyên', 'F&B'),
    ('goody', 'F&B'),
    ('i.soup', 'F&B'),
    ('Lothamilk', 'F&B'),
    ('oatside', 'F&B'),
    ('sanest', 'F&B'),
    ('Star Kombucha', 'F&B'),
    ('Tai Ky Food - Flour Joint Stock', 'F&B'),
    ('Tai Ky Food Flour JSC', 'F&B'),
    ('Taiky Food', 'F&B'),
    ('Thien Huong Food Joint Stock Company', 'F&B'),
    ('Thien Huong Food JSC', 'F&B'),
    ('Vietinter', 'F&B'),
    ('Cchat Clothes', 'Fashion'),
    ('Cocomay', 'Fashion'),
    ('Hagoo', 'Fashion'),
    ('Levi''s', 'Fashion'),
    ('Nón Sơn', 'Fashion'),
    ('Routine Vietnam', 'Fashion'),
    ('semir', 'Fashion'),
    ('Sixdo', 'Fashion'),
    ('Thiều Hoa', 'Fashion'),
    ('Tingoan', 'Fashion'),
    ('Bebechic', 'Mom & Baby'),
    ('D - Nee', 'Mom & Baby'),
    ('Best Nutrition', 'Health & EL'),
    ('Codeage', 'Health & EL'),
    ('Fresheen Health', 'Health & EL'),
    ('KAO', 'FMCG'),
    ('kenvue', 'FMCG')
  )
  update brand b
     set category_id = c.id
    from xep x, category c
   where b.name = x.ten_brand
     and c.name = x.ten_nganh;

  -- Phai ra 46. Khac thi roll back.
  select count(*) as da_doi
  from brand b join category c on c.id = b.category_id
  where c.name in ('Beauty','F&B','Fashion','Mom & Baby','Health & EL','FMCG')
    and exists (select 1 from brand_channel bc where bc.brand_id = b.id);

commit;

-- ---------------------------------------------------------------------------
-- PHAN 3 - CHI DOC. 47 brand con lai, de nguoi quyet.
-- ---------------------------------------------------------------------------

select
  b.name,
  (select count(*) from contact ct where ct.brand_id = b.id) as so_contact,
  (select string_agg(distinct ct.company, ' / ')
     from contact ct where ct.brand_id = b.id and ct.company is not null) as cong_ty_nguoi_ta_khai
from brand b
join category c on c.id = b.category_id and c.kind = 'channel'
group by b.id, b.name
order by 2 desc, b.name;

-- Ba dong duoi day la RAC, khong phai brand. Xoa duoc neu khong con contact:
--   'Self-employed'
--   'Unsorted from LinkedIn links'
--   'linkedin.com/in/nhung-la-8b8315b4?originalSubdomain=vn'
--
-- Va may cap trung ten can gop, khong lien quan Livestream:
--   Tai Ky Food - Flour Joint Stock / Tai Ky Food Flour JSC / Taiky Food
--   Thien Huong Food Joint Stock Company / Thien Huong Food JSC
--   Kim Dong / Kim Dong Publishing House
--   huyndai / HD Hyundai Electric Co., Ltd.
