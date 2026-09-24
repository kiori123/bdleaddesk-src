# OnPoint Lead Desk

Đọc `CLAUDE.md` trước — nó ghi ranh giới giữa app và n8n.

## Chạy lần đầu

```bash
npm install
cp .env.example .env.local   # điền giá trị vào
npm run dev
```

Trước đó phải chạy `schema.sql` trong Supabase SQL Editor và tạo ít nhất một
tài khoản admin.

## Đã có sẵn

- Đăng nhập bằng Supabase Auth, middleware chặn mọi trang chưa đăng nhập
- Danh sách brand lọc theo category qua RLS ở tầng database
- Trang admin: xem credit từng category, danh sách người dùng
- `lib/credit.ts` — đặt chỗ / chốt sổ / hoàn credit
- `app/api/scan` — chặn scan khi category hết credit
- `app/api/webhooks/n8n` — nhận callback, chống ghi trùng

## Làm tiếp

- Form scan (chọn category, nhập brand)
- Màn chọn người sau khi search xong, rồi gọi `/api/reveal`
- Trang chi tiết brand: org chart, stage, note, tài liệu
- Admin: sửa hạn mức credit, mời người dùng, gán category
- Luồng xin thêm credit + mail duyệt
- Upload tài liệu qua Supabase Storage (hoặc giữ Google Drive qua n8n)

## Lưu ý

`SUPABASE_SERVICE_ROLE_KEY` bỏ qua toàn bộ RLS. Chỉ dùng trong `lib/supabase/admin.ts`
và chỉ ở server. Đừng bao giờ đặt tiền tố `NEXT_PUBLIC_`.
