-- Xep lai 11 brand da roi vao "Livestream" trong ngay 12/10/2026.
--
-- Chay:  node chay-sql.mjs xep_11_brand_12_10.sql
--
-- ===========================================================================
-- VI SAO LAI CO 11 BRAND NUA
-- ===========================================================================
--
-- xep_brand_ve_nganh.sql da don sach 93 brand cu va de Livestream ve 0. Sang
-- cung ngay, 11 brand moi lai roi vao do - deu tao SAU khi ban va deploy:
--
--   06:21 Nuvi        06:47 Enic Vietnam   06:55 Rejuvaskin  07:21 Snickers
--   07:23 Sokfarm     07:29 Anker          07:32 (mot URL)   07:33 Thai Minh
--   07:46 UUcare      08:01 Want ~ Want    08:11 Ecovas
--
-- Nguyen nhan KHONG phai cai da vit. Man /scan (SearchForm) co hoi "These
-- brands belong to" va gui `productCategoryId` dung. Nhung man /scan/person
-- - duong dan link LinkedIn va duong tim theo ten + cong ty - thi KHONG hoi,
-- nen request den /api/reveal khong mang `productCategoryId`, `damBaoBrand()`
-- lui ve `categoryId` (= cai kenh), va brand lai ket duoi Livestream y het cu.
--
-- Da vit o PersonForm.tsx + person/page.tsx: man do gio hoi dung cau hoi do,
-- va chan khong cho chay khi chua tra loi. File nay chi don phan du lieu da
-- lo sinh ra truoc khi vit.
--
-- ===========================================================================
-- XEP VAO DAU, VA CAN CU NAO
-- ===========================================================================
--
-- Khong doan. Moi dong duoi day deu bam theo mot brand CUNG LOAI da nam san
-- trong DB, nen danh muc giu duoc su nhat quan cua chinh team:
--
--   Nuvi        -> F&B          sua chua Nutifood; `Nutifood` dang o F&B
--   Snickers    -> F&B          banh keo (Mars)
--   Sokfarm     -> F&B          mat hoa dua Tra Vinh
--   Want ~ Want -> F&B          banh keo / sua Dai Loan (Want Want)
--   Rejuvaskin  -> Beauty       duong da; `Wonderskin`, `Clean Skin Club` o Beauty
--   Anker       -> Health & EL  dien tu tieu dung; `ecovacs` o Health & EL
--   Ecovas      -> Health & EL  cung loai `ecovacs` (xem ghi chu trung ten cuoi file)
--   Enic Vietnam-> Health & EL  thiet bi nha thong minh / thiet bi ve sinh (Enic Group, SG)
--   Thai Minh   -> Health & EL  duoc pham; `Pharmacity` o Health & EL
--   UUcare      -> Health & EL  bang ve sinh / dung dich ve sinh; `Diana Unicharm` o Health & EL
--
-- Rieng dong thu 11 khong phai brand: mot duong link LinkedIn bi dan vao o
-- ten brand o man /scan. No khong co contact nao. Xoa o PHAN 3, tach rieng.

-- ---------------------------------------------------------------------------
-- PHAN 1 - CHI DOC. Xem truoc khi doi.
-- ---------------------------------------------------------------------------

select b.name, c.name as nganh_hien_tai, count(ct.id) as so_contact, b.created_at
from brand b
join category c on c.id = b.category_id and c.kind = 'channel'
left join contact ct on ct.brand_id = b.id
group by b.id, b.name, c.name, b.created_at
order by b.created_at;

-- ---------------------------------------------------------------------------
-- PHAN 2 - XEP LAI. Mot cau duy nhat, chay mot lan.
-- ---------------------------------------------------------------------------
--
-- Mot cau chu khong phai 11 cau update: CTE `giu_dau_vet` phai doc
-- `b.category_id` o trang thai TRUOC khi update chay. Tach ra thanh nhieu cau
-- thi cau thu hai doc phai gia tri da doi, va dau vet "SOCOM da lam brand nay"
-- mat sach - tuc SOCOM mat luon quyen xem brand ho vua lam xong.
--
-- Thu tu ghi: brand_channel TRUOC, brand.category_id SAU. Day la dieu kien de
-- `brand_qua_kenh()` trong brand_read tiep tuc cho SOCOM thay brand.

with xep(ten, nganh) as (
  values
    ('Nuvi',                      'F&B'),
    ('Snickers',                  'F&B'),
    ('Sokfarm',                   'F&B'),
    ('Want ~ Want',               'F&B'),
    ('Rejuvaskin',                'Beauty'),
    ('Anker',                     'Health & EL'),
    ('Ecovas',                    'Health & EL'),
    ('Enic Vietnam',              'Health & EL'),
    ('Thai Minh Pharmaceuticals', 'Health & EL'),
    ('UUcare',                    'Health & EL')
),
can_xep as (
  select b.id as brand_id, b.category_id as kenh_cu, c.id as nganh_moi
  from xep x
  join brand b on lower(btrim(b.name)) = lower(btrim(x.ten))
  join category c on lower(btrim(c.name)) = lower(btrim(x.nganh))
  -- chi dong nao dang nam duoi mot KENH moi phai xep lai. Chay lai file nay
  -- lan hai thi khong con dong nao khop, va khong co gi bi dong vao.
  where b.category_id in (select id from category where kind = 'channel')
),
giu_dau_vet as (
  insert into brand_channel (brand_id, category_id)
  select brand_id, kenh_cu from can_xep
  on conflict (brand_id, category_id) do nothing
  returning brand_id
),
dong_dau as (
  -- Contact da ve qua kenh thi phai mang nhan kenh, neu chua co. Khong ghi de
  -- dong da co channel_id: co the no den tu mot kenh khac.
  update contact ct
     set channel_id = cx.kenh_cu
    from can_xep cx
   where ct.brand_id = cx.brand_id and ct.channel_id is null
  returning ct.id
)
update brand b
   set category_id = cx.nganh_moi
  from can_xep cx
 where b.id = cx.brand_id;

-- ---------------------------------------------------------------------------
-- PHAN 3 - XOA DONG RAC. Tach rieng, co y.
-- ---------------------------------------------------------------------------
--
-- Mot duong link LinkedIn bi dan vao o "brand name" o man /scan. No khong co
-- contact nao nen xoa la an toan, nhung van de rieng mot cau de nguoi chay
-- nhin thay minh dang xoa cai gi. `where not exists` la chot an toan: con du
-- mot contact thi cau nay khong xoa gi het.

delete from brand b
 where b.name like 'https://%linkedin.com/in/%'
   and not exists (select 1 from contact ct where ct.brand_id = b.id);

-- ---------------------------------------------------------------------------
-- PHAN 4 - KIEM LAI
-- ---------------------------------------------------------------------------

-- 4a. Khong con brand nao nam duoi mot kenh. Phai ra 0 dong.
select b.name, c.name as kenh
from brand b join category c on c.id = b.category_id
where c.kind = 'channel';

-- 4b. Dau vet kenh con nguyen (phai TANG them 10 so voi truoc khi chay).
select count(*) as so_dau_vet_kenh from brand_channel;

-- 4c. 10 brand do gio nam dung cho, va SOCOM van thay duoc.
select b.name, c.name as nganh,
       (select count(*) from contact ct where ct.brand_id = b.id) as so_contact,
       (select count(*) from brand_channel bc where bc.brand_id = b.id) as qua_kenh
from brand b join category c on c.id = b.category_id
where lower(btrim(b.name)) in (
  'nuvi','snickers','sokfarm','want ~ want','rejuvaskin',
  'anker','ecovas','enic vietnam','thai minh pharmaceuticals','uucare')
order by c.name, b.name;

-- ---------------------------------------------------------------------------
-- CON LAI CHO NGUOI QUYET DINH
-- ---------------------------------------------------------------------------
--
-- `Ecovas` (1 contact) va `ecovacs` (2 contact) nhieu kha nang la cung mot
-- cong ty, go thieu mot chu. File nay KHONG gop ho: gop brand la doi brand_id
-- cua contact, va neu doan sai thi khong lui lai duoc. Hai dong deu da ve
-- Health & EL nen khong con sai nganh nua; muon gop thi kiem hai contact do
-- truoc roi gop tay.
--
-- `Chilux` dang o F&B va `Xiaomi Southeast Asia` cung o F&B. Ca hai deu kho
-- dung - Chilux la do dung tre em (Mom & Baby), Xiaomi la dien tu
-- (Health & EL). Khong dong vao o day vi chung khong lien quan den dot nay,
-- nhung dang mot lan ra soat rieng.
