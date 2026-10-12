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
-- 79 TRONG 93. CON 14 CAI KHONG XEP.
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
-- 14 cai con lai van KHONG xep, vi ba ly do:
--
--   a) RAC, khong phai brand (3):
--        Self-employed
--        Unsorted from LinkedIn links
--        linkedin.com/in/nhung-la-8b8315b4?originalSubdomain=vn
--      Hai cai dau la gia tri SignalHire tra ve va ten du phong cua duong dan
--      link. Cai thu ba la mot URL bi dung lam ten brand.
--
--   b) THAT SU KHONG CO NGANH NAO VUA (6):
--        fahasa, MCBooks, Nha Nam, Kim Dong, Kim Dong Publishing House - sach
--        va xuat ban. Khong co nganh nao gan.
--        Kymdan - nem. Khong phai FMCG (hang tieu dung nhanh), khong phai
--        dien may. Nhet dai vao la tao ra dung loai sai dang di don.
--
--   c) TRA KHONG RA (5):
--        Coretests, Nesty, lien a chau, FGH Group Co., Ltd., huyndai
--      "Nesty" co contact khai cong ty la Coteccons (xay dung) - khong khop
--      ten brand, co the la du lieu sai. "huyndai" la mot alias viet sai cua
--      Hyundai va trung voi HD Hyundai Electric.
--
-- Xem Phan 3 de lay danh sach 14 cai do kem so contact.

-- ---------------------------------------------------------------------------
-- PHAN 1 - CHI DOC. Xem truoc 79 dong se doi.
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
    ('masuto', 'FMCG')
)
select x.ten_nganh as nganh_moi, count(*) as so_brand,
       string_agg(x.ten_brand, ', ' order by x.ten_brand) as cac_brand
from xep x join brand b on b.name = x.ten_brand
group by x.ten_nganh order by count(*) desc;

-- Tong phai ra 79. It hon nghia la co ten khong khop - bao lai, dung chay Phan 2.

-- ---------------------------------------------------------------------------
-- PHAN 2 - DOI. Chay sau khi Phan 1 ra dung 79.
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
    ('masuto', 'FMCG')
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
    ('masuto', 'FMCG')
  )
  update brand b set category_id = c.id
    from xep x, category c
   where b.name = x.ten_brand and c.name = x.ten_nganh;

  -- Phai ra 79. Khac thi roll back.
  select count(*) as da_doi from brand b
  join brand_channel bc on bc.brand_id = b.id
  join category c on c.id = b.category_id
  where c.kind = 'product';

commit;

-- ---------------------------------------------------------------------------
-- PHAN 3 - CHI DOC. 14 cai con lai, de nguoi quyet.
-- ---------------------------------------------------------------------------

select b.name,
  (select count(*) from contact ct where ct.brand_id = b.id) as so_contact,
  (select string_agg(distinct ct.company, ' / ')
     from contact ct where ct.brand_id = b.id and ct.company is not null) as cong_ty_nguoi_ta_khai
from brand b join category c on c.id = b.category_id and c.kind = 'channel'
group by b.id, b.name order by 2 desc, b.name;

-- Va bon cap trung ten can gop, khong lien quan Livestream:
--   Tai Ky Food - Flour Joint Stock / Tai Ky Food Flour JSC / Taiky Food
--   Thien Huong Food Joint Stock Company / Thien Huong Food JSC
--   Kim Dong / Kim Dong Publishing House
--   huyndai / HD Hyundai Electric Co., Ltd.
