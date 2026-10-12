-- Xep lai brand tu "Livestream" ve dung nganh hang cua chung.
--
-- Chay sau socom_kenh_rieng.sql.
--   node chay-sql.mjs xep_brand_ve_nganh.sql
--
-- ===========================================================================
-- VI SAO
-- ===========================================================================
--
-- "Livestream" la KENH (SOCOM), khong phai nganh hang. Vi no tung nam chung
-- bang `category`, va `damBaoBrand()` upsert voi ignoreDuplicates - ai reveal
-- truoc chot nganh vinh vien - nen 93 brand doanh nghiep that da ket lai duoi
-- do: Levi's, LG, Olay, Kenvue, AB InBev, Casio, Kymdan, Fahasa.
--
-- Nguon da duoc vit: form scan bat chon nganh rieng khi tra bang ngan sach
-- kenh. File nay don phan da ket lai truoc do.
--
-- ===========================================================================
-- CA 93. KHONG CON CAI NAO KET LAI.
-- ===========================================================================
--
-- Khong cai nao duoc doan. Moi ten deu tra lai nguon that truoc khi xep, va
-- vai cai hoa ra khac han phong doan ban dau:
--
--   halita   - KHONG phai thiet bi dien. La giay dep da nam -> Fashion.
--   masuto   - KHONG phai thoi trang. La hoa pham tay rua -> FMCG.
--   Brushie  - ban chai dien cua Smilee, va "Cong ty Co phan Smilee Viet Nam"
--              DA nam san trong Health & EL.
--   HECATECH - cham soc suc khoe phu nu (coc nguyet san, dung dich ve sinh),
--              cung nhom voi Lavima da co trong Health & EL.
--   JETZT, dodoto - deu la may hut bui, cung nhom voi ecovacs da co san.
--
-- Mot phat hien doi ca cach xep: "Health & EL" la Health & ELECTRONICS. No
-- dang chua Samsung, Epson, sharp, De'Longhi, ecovacs, EZVIZ, western
-- digital, AQUA, Omron, ClickBuy. Nen LG, Casio, Nagakawa, Imou, Samono,
-- Kingsun, Gaabor, Fujihome, HD Hyundai, Di Dong Viet, F.Studio deu co cho -
-- truoc do tuong khong co nganh nao vua va dinh de chung lai.
--
-- 14 cai cuoi, tra ky lai lan hai, va ba cai hoa ra co nganh that:
--
--   Coretests   - kit xet nghiem nhanh y te -> Health & EL.
--   Nesty       - dep/giay Viet Nam -> Fashion. Contact cua no khai cong ty
--                 la "Coteccons" (xay dung), khong khop ten brand chut nao -
--                 do la DU LIEU SAI, khong phai manh moi.
--   lien a chau - cong ty van hanh chuoi Guardian, va "Guardian Vietnam" DA
--                 nam san trong Health & EL.
--
-- 11 cai con lai vao nganh moi "Else":
--
--   sach va xuat ban : fahasa, MCBooks, Nha Nam, Kim Dong,
--                      Kim Dong Publishing House
--   nem              : Kymdan - khong phai hang tieu dung nhanh, khong phai
--                      dien may
--   phu tung o to    : huyndai (that ra la Hyundai Mobis)
--   tra khong ra     : FGH Group Co., Ltd.
--   KHONG PHAI BRAND : Self-employed, Unsorted from LinkedIn links,
--                      linkedin.com/in/nhung-la-...
--
-- Ba dong cuoi la rac that su: hai cai dau la gia tri SignalHire tra ve va
-- ten du phong cua duong dan link, cai thu ba la mot URL bi dung lam ten
-- brand. Chung van duoc dua vao Else chu khong xoa o day, vi muc tieu cua
-- file nay la lam Livestream con ZERO brand - xoa du lieu la viec rieng, can
-- nhin ky va can mot file khac. "Unsorted from LinkedIn links" va URL kia
-- khong co contact nao nen xoa duoc ngay; "Self-employed" con 1 contact.

-- ---------------------------------------------------------------------------
-- PHAN 1 - CHI DOC. Xem truoc 93 dong se doi.
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
    ('Keyshu', 'Beauty'),
    ('C-Store Vietnam', 'Beauty'),
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
    ('halita', 'Fashion'),
    ('Bemine', 'Fashion'),
    ('Rechic', 'Fashion'),
    ('Bbstore''S', 'Fashion'),
    ('Libe', 'Fashion'),
    ('Embes', 'Fashion'),
    ('rabity', 'Fashion'),
    ('Khatoco', 'Fashion'),
    ('Kính Mắt Anna', 'Fashion'),
    ('Visecret', 'Fashion'),
    ('Bebechic', 'Mom & Baby'),
    ('D - Nee', 'Mom & Baby'),
    ('Emoon', 'Mom & Baby'),
    ('vitadiary', 'Mom & Baby'),
    ('Mykingdom', 'Mom & Baby'),
    ('Best Nutrition', 'Health & EL'),
    ('Codeage', 'Health & EL'),
    ('Fresheen Health', 'Health & EL'),
    ('Brushie', 'Health & EL'),
    ('Tranyoo', 'Health & EL'),
    ('GoChek', 'Health & EL'),
    ('JETZT', 'Health & EL'),
    ('dodoto', 'Health & EL'),
    ('HECATECH', 'Health & EL'),
    ('LG', 'Health & EL'),
    ('Casio', 'Health & EL'),
    ('Nagakawa', 'Health & EL'),
    ('Imou', 'Health & EL'),
    ('Samono', 'Health & EL'),
    ('Kingsun', 'Health & EL'),
    ('Gaabor', 'Health & EL'),
    ('Fujihome', 'Health & EL'),
    ('HD Hyundai Electric Co., Ltd.', 'Health & EL'),
    ('Di Động Việt', 'Health & EL'),
    ('F.Studio By FPT', 'Health & EL'),
    ('KAO', 'FMCG'),
    ('kenvue', 'FMCG'),
    ('masuto', 'FMCG'),
    ('Coretests', 'Health & EL'),
    ('liên á châu', 'Health & EL'),
    ('Nesty', 'Fashion'),
    ('fahasa', 'Else'),
    ('MCBooks', 'Else'),
    ('Nhã Nam', 'Else'),
    ('Kim Đồng', 'Else'),
    ('Kim Dong Publishing House', 'Else'),
    ('Kymdan', 'Else'),
    ('FGH Group Co., Ltd.', 'Else'),
    ('huyndai', 'Else'),
    ('Self-employed', 'Else'),
    ('Unsorted from LinkedIn links', 'Else'),
    ('linkedin.com/in/nhung-la-8b8315b4?originalSubdomain=vn', 'Else')
)
select x.ten_nganh as nganh_moi, count(*) as so_brand,
       string_agg(x.ten_brand, ', ' order by x.ten_brand) as cac_brand
from xep x join brand b on b.name = x.ten_brand
group by x.ten_nganh order by count(*) desc;

-- Tong phai ra 93. It hon nghia la co ten khong khop - bao lai, dung chay Phan 2.

-- ---------------------------------------------------------------------------
-- PHAN 2 - DOI. Chay sau khi Phan 1 ra dung 93.
-- ---------------------------------------------------------------------------

begin;

  -- Nganh "Else" cho nhung gi khong thuoc nganh nao dang co: sach va xuat
  -- ban (fahasa, MCBooks, Nha Nam, Kim Dong), nem (Kymdan), phu tung o to
  -- (huyndai la Hyundai Mobis), va vai dong khong tra ra duoc.
  --
  -- kind = 'product': no la mot nganh that de xep brand vao, khong phai kenh.
  -- Co `slug` vi bang category dang co cot do cho moi dong.
  insert into category (name, slug, active, kind)
  select 'Else', 'else', true, 'product'
  where not exists (select 1 from category where name = 'Else');

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
    ('Keyshu', 'Beauty'),
    ('C-Store Vietnam', 'Beauty'),
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
    ('halita', 'Fashion'),
    ('Bemine', 'Fashion'),
    ('Rechic', 'Fashion'),
    ('Bbstore''S', 'Fashion'),
    ('Libe', 'Fashion'),
    ('Embes', 'Fashion'),
    ('rabity', 'Fashion'),
    ('Khatoco', 'Fashion'),
    ('Kính Mắt Anna', 'Fashion'),
    ('Visecret', 'Fashion'),
    ('Bebechic', 'Mom & Baby'),
    ('D - Nee', 'Mom & Baby'),
    ('Emoon', 'Mom & Baby'),
    ('vitadiary', 'Mom & Baby'),
    ('Mykingdom', 'Mom & Baby'),
    ('Best Nutrition', 'Health & EL'),
    ('Codeage', 'Health & EL'),
    ('Fresheen Health', 'Health & EL'),
    ('Brushie', 'Health & EL'),
    ('Tranyoo', 'Health & EL'),
    ('GoChek', 'Health & EL'),
    ('JETZT', 'Health & EL'),
    ('dodoto', 'Health & EL'),
    ('HECATECH', 'Health & EL'),
    ('LG', 'Health & EL'),
    ('Casio', 'Health & EL'),
    ('Nagakawa', 'Health & EL'),
    ('Imou', 'Health & EL'),
    ('Samono', 'Health & EL'),
    ('Kingsun', 'Health & EL'),
    ('Gaabor', 'Health & EL'),
    ('Fujihome', 'Health & EL'),
    ('HD Hyundai Electric Co., Ltd.', 'Health & EL'),
    ('Di Động Việt', 'Health & EL'),
    ('F.Studio By FPT', 'Health & EL'),
    ('KAO', 'FMCG'),
    ('kenvue', 'FMCG'),
    ('masuto', 'FMCG'),
    ('Coretests', 'Health & EL'),
    ('liên á châu', 'Health & EL'),
    ('Nesty', 'Fashion'),
    ('fahasa', 'Else'),
    ('MCBooks', 'Else'),
    ('Nhã Nam', 'Else'),
    ('Kim Đồng', 'Else'),
    ('Kim Dong Publishing House', 'Else'),
    ('Kymdan', 'Else'),
    ('FGH Group Co., Ltd.', 'Else'),
    ('huyndai', 'Else'),
    ('Self-employed', 'Else'),
    ('Unsorted from LinkedIn links', 'Else'),
    ('linkedin.com/in/nhung-la-8b8315b4?originalSubdomain=vn', 'Else')
  )
  -- THU TU QUAN TRONG: ghi brand_channel TRUOC khi doi category_id. Sau khi
  -- doi thi khong con doc duoc kenh cu tu dong brand nua, va SOCOM se mat
  -- quyen xem brand ho vua lam (brand_read chi con ve "nganh cua toi").
  insert into brand_channel (brand_id, category_id)
  select b.id, b.category_id
  from xep x join brand b on b.name = x.ten_brand
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
    ('Keyshu', 'Beauty'),
    ('C-Store Vietnam', 'Beauty'),
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
    ('halita', 'Fashion'),
    ('Bemine', 'Fashion'),
    ('Rechic', 'Fashion'),
    ('Bbstore''S', 'Fashion'),
    ('Libe', 'Fashion'),
    ('Embes', 'Fashion'),
    ('rabity', 'Fashion'),
    ('Khatoco', 'Fashion'),
    ('Kính Mắt Anna', 'Fashion'),
    ('Visecret', 'Fashion'),
    ('Bebechic', 'Mom & Baby'),
    ('D - Nee', 'Mom & Baby'),
    ('Emoon', 'Mom & Baby'),
    ('vitadiary', 'Mom & Baby'),
    ('Mykingdom', 'Mom & Baby'),
    ('Best Nutrition', 'Health & EL'),
    ('Codeage', 'Health & EL'),
    ('Fresheen Health', 'Health & EL'),
    ('Brushie', 'Health & EL'),
    ('Tranyoo', 'Health & EL'),
    ('GoChek', 'Health & EL'),
    ('JETZT', 'Health & EL'),
    ('dodoto', 'Health & EL'),
    ('HECATECH', 'Health & EL'),
    ('LG', 'Health & EL'),
    ('Casio', 'Health & EL'),
    ('Nagakawa', 'Health & EL'),
    ('Imou', 'Health & EL'),
    ('Samono', 'Health & EL'),
    ('Kingsun', 'Health & EL'),
    ('Gaabor', 'Health & EL'),
    ('Fujihome', 'Health & EL'),
    ('HD Hyundai Electric Co., Ltd.', 'Health & EL'),
    ('Di Động Việt', 'Health & EL'),
    ('F.Studio By FPT', 'Health & EL'),
    ('KAO', 'FMCG'),
    ('kenvue', 'FMCG'),
    ('masuto', 'FMCG'),
    ('Coretests', 'Health & EL'),
    ('liên á châu', 'Health & EL'),
    ('Nesty', 'Fashion'),
    ('fahasa', 'Else'),
    ('MCBooks', 'Else'),
    ('Nhã Nam', 'Else'),
    ('Kim Đồng', 'Else'),
    ('Kim Dong Publishing House', 'Else'),
    ('Kymdan', 'Else'),
    ('FGH Group Co., Ltd.', 'Else'),
    ('huyndai', 'Else'),
    ('Self-employed', 'Else'),
    ('Unsorted from LinkedIn links', 'Else'),
    ('linkedin.com/in/nhung-la-8b8315b4?originalSubdomain=vn', 'Else')
  )
  update brand b set category_id = c.id
    from xep x, category c
   where b.name = x.ten_brand and c.name = x.ten_nganh;

  -- Phai ra 93. Khac thi roll back.
  select count(*) as da_doi from brand b
  join brand_channel bc on bc.brand_id = b.id
  join category c on c.id = b.category_id
  where c.kind = 'product';

commit;

-- ---------------------------------------------------------------------------
-- PHAN 3 - KIEM LAI. Livestream phai con ZERO brand.
-- ---------------------------------------------------------------------------

-- 3a. Phai ra 0 dong. Con dong nao la con brand ket duoi mot kenh.
select b.name
from brand b join category c on c.id = b.category_id and c.kind = 'channel'
order by b.name;

-- 3b. Phan bo sau khi xep.
select c.name as nganh, c.kind, count(b.id) as so_brand
from category c left join brand b on b.category_id = c.id
group by c.name, c.kind order by count(b.id) desc;

-- 3c. Hai dong rac KHONG CON contact nao - xoa duoc ngay neu muon:
--   delete from brand where name in (
--     'Unsorted from LinkedIn links',
--     'linkedin.com/in/nhung-la-8b8315b4?originalSubdomain=vn'
--   ) and not exists (select 1 from contact ct where ct.brand_id = brand.id);
--
-- 'Self-employed' con 1 contact nen khong xoa o day - nhin contact do truoc.

-- Va bon cap trung ten can gop, khong lien quan Livestream:
--   Tai Ky Food - Flour Joint Stock / Tai Ky Food Flour JSC / Taiky Food
--   Thien Huong Food Joint Stock Company / Thien Huong Food JSC
--   Kim Dong / Kim Dong Publishing House
--   huyndai / HD Hyundai Electric Co., Ltd.
