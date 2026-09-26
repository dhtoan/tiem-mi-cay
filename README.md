# Tiệm Mì Cay

Game quản lý tiệm mì cay chạy trên Cloudflare Workers, dùng D1 cho dữ liệu online và hỗ trợ PWA/offline.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dhtoan/tiem-mi-cay)

## One-click deploy

Bấm **Deploy to Cloudflare** ở trên.

Cloudflare sẽ:

1. Clone repo này sang tài khoản Git của bạn.
2. Tạo Worker mới.
3. Tự provision D1 cho binding `DB`.
4. Điền `database_id` phù hợp vào cấu hình được tạo.
5. Chạy command deploy của repo.
6. Command deploy chạy D1 migrations trước, sau đó publish Worker.
7. Kết nối Workers Builds để các push tiếp theo có thể tự build/deploy.

Repo dùng:

```bash
npm run db:remote
wrangler deploy
```

thông qua script:

```json
"deploy": "npm run build && npm run db:remote && wrangler deploy"
```

## Tính năng production

- Game web đầy đủ, responsive.
- PWA + service worker + asset local.
- Cloudflare Worker cùng origin cho frontend và API.
- Cloudflare D1.
- Bảng xếp hạng.
- Giải mì hằng ngày/tuần.
- Chọc quán / gửi quà.
- Review reply API.
- Tài khoản người chơi.
- Đăng ký / đăng nhập / đăng xuất.
- Password hash PBKDF2-SHA256.
- Session cookie HttpOnly, SameSite=Lax, Secure trên HTTPS.
- Cloud save đa thiết bị.
- Revision conflict protection để tránh thiết bị cũ ghi đè bản mới.
- Local save vẫn hoạt động khi chưa đăng nhập.
- GitHub Actions smoke test.
- Workers observability.
- Preview URLs.
- Security headers cơ bản.

## Cloud save

Trong game có nút **☁️ Tài khoản**.

Người chơi có thể:

- tạo tài khoản;
- đăng nhập;
- lưu tiến trình hiện tại lên cloud;
- tải bản cloud về thiết bị khác;
- đăng xuất mà không mất bản local.

API:

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me

GET  /api/save
PUT  /api/save
POST /api/save
```

Cloud save dùng revision number. Nếu hai thiết bị cùng chỉnh một bản lưu, server trả `409 Conflict` thay vì âm thầm ghi đè.

## Các API game

```text
GET  /api/health
GET/POST /api/lb
GET/POST /api/chal
GET/POST /api/prank
POST /api/ai
```

## D1 schema

Migrations:

```text
migrations/0001_init.sql
migrations/0002_auth_cloud_save.sql
```

Các bảng chính:

- `players`
- `leaderboard`
- `challenge_runs`
- `pranks`
- `accounts`
- `sessions`
- `cloud_saves`

## Chạy local

Yêu cầu Node.js 20+.

```bash
npm install
npm run db:local
npm run dev
```

Mặc định Wrangler sẽ in URL local, thường là:

```text
http://localhost:8787
```

## Test

```bash
npm run check
npm run db:local
npm run dev
```

Ở terminal khác:

```bash
npm run test:smoke
```

Smoke test kiểm tra:

- health endpoint;
- frontend game;
- register;
- session;
- cloud save write/read;
- revision conflict;
- leaderboard;
- challenge;
- social/prank API;
- logout.

GitHub Actions chạy các bước này tự động cho push vào `main` và pull request.

## Deploy thủ công

Đăng nhập:

```bash
npx wrangler login
```

Tạo D1 nếu bạn không dùng nút one-click:

```bash
npx wrangler d1 create tiem-mi-cay
```

Sau đó thay `database_id` trong `wrangler.toml` bằng ID Cloudflare trả về.

Deploy:

```bash
npm install
npm run deploy
```

`npm run deploy` tự chạy migrations trước khi publish Worker.

## Domain

Sau deploy, Worker có thể chạy ngay bằng domain `workers.dev`.

Để dùng custom domain:

1. Cloudflare Dashboard.
2. Workers & Pages.
3. Chọn Worker **tiem-mi-cay**.
4. Mở **Settings → Domains & Routes**.
5. Chọn **Add → Custom Domain**.
6. Chọn hostname thuộc zone Cloudflare của bạn.
7. Xác nhận.

Không cần sửa frontend vì API dùng cùng origin.

## Cấu trúc repo

```text
.github/workflows/
  ci.yml

migrations/
  0001_init.sql
  0002_auth_cloud_save.sql

public/
  index.html
  manifest.webmanifest
  sw.js
  icon-192.png
  icon-512.png
  apple-touch-icon.png
  assets/media/
  music/

scripts/
  smoke.sh

src/
  worker.js

package.json
wrangler.toml
```

## Security Mode

Production được build qua `scripts/build.mjs`:

- HTML + inline JS/CSS được minify/mangle;
- comment bị loại bỏ;
- không tạo source map;
- Cloudflare chỉ serve thư mục `dist/`;
- mọi request đi qua Worker trước khi lấy static asset;
- hostname ngoài danh sách cho phép bị trả `403`;
- chặn iframe bằng `X-Frame-Options: DENY` và CSP `frame-ancestors 'none'`;
- static resource áp dụng `Cross-Origin-Resource-Policy: same-origin`;
- client chặn thao tác View Source/Save Page phổ biến ở mức UI.

Hostname production mặc định:

```text
tiem-mi-cay.aunomay.workers.dev
```

Nếu thêm custom domain, đặt Worker variable:

```text
ALLOWED_HOSTS=tiemmicay.aunomay.com
```

Nhiều hostname phân tách bằng dấu phẩy.

Lưu ý: code chạy trong browser không thể được che tuyệt đối khỏi một người có đủ kỹ năng. Muốn source repo không công khai thì phải chuyển GitHub repository sang private; điều đó xung đột với việc dùng repo như public one-click template.

## Security

- Cookie session không được JavaScript đọc.
- Server chỉ lưu hash của session token.
- Password không lưu plaintext.
- Cloud save giới hạn kích thước.
- Write request auth/save có same-origin check.
- Challenge dùng token server có thời hạn.
- D1 enforce quota challenge/social.
- CSP, Permissions-Policy, Referrer-Policy và nosniff được gửi từ Worker.

Game logic vẫn chạy phần lớn ở client nên đây không phải mô hình chống cheat tuyệt đối. Nếu sau này có giải thưởng tiền thật, nên chuyển scoring/event verification quan trọng sang server.

## License / media

Ảnh và media runtime được đóng gói local trong repo. Thông tin attribution của nhạc nằm tại:

```text
public/music/CREDITS.md
```


## Brand & Support

**Publisher / operator:** Aunomay LLC  
**Website:** https://aunomay.com  
**Support:** support@aunomay.com

Các thành phần gốc của Tiệm Mì Cay do Aunomay LLC phát hành và vận hành. Tài sản bên thứ ba vẫn tuân theo giấy phép riêng được ghi nhận trong repo.
