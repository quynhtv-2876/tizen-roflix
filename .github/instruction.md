## Repo overview

This repository runs a small Express server that scrapes and proxies video streams from a target site using Puppeteer + Cheerio.

Key files

- `server.js` — the entire application (no other modules). Contains server setup, Puppeteer helpers, route handlers and a proxy for .m3u8/.vtt responses.
- `package.json` — dependencies and scripts. Use `npm start` (added) to run.

Big-picture architecture (what an AI agent should know)

- Single-process Express app exposing endpoints under `/api` (protected by an API key header `x-api-key`). The public root (`/`) returns a health string.
- Puppeteer is used to render pages and extract DOM content or network responses; Cheerio is used to parse the rendered HTML for list/details endpoints.
- The `/api/watch` route opens an episode page, clicks the embedded player, listens for network responses to capture `.m3u8` (HLS) and `.vtt` subtitle requests, then returns proxied URLs pointing back to `/api/proxy` on this server.
- `/api/proxy` fetches either text playlists/subtitle files or streams media and rewrites playlist segment URLs to route back through the proxy.

Why it's designed this way

- Puppeteer + stealth plugin is required because the target site serves content via JS and may try to detect automated scraping.
- Proxying HLS playlists ensures clients can fetch segments with correct Referer/User-Agent headers.

Environment and runtime

- The app expects environment variables in a `.env` file loaded via `dotenv` at the top of `server.js`.
  - `API_KEY` (required) — server will exit if not present. Used to authenticate requests via header `x-api-key`.
  - `PORT` (optional) — port to listen on (defaults to 3000).
  - `BASE_URL` (optional) — target site base URL (defaults to `https://rophim.mx`).

How to run locally (developer flows)

- Create a `.env` file in the repo root with at least:

  API_KEY=your-test-key
  PORT=3000
  BASE_URL=<https://rophim.mx>

- Start server:

  npm install
  npm start

- Call endpoints with header `x-api-key: <API_KEY>`; example:
  - GET `/api/list` — returns an array of { title, link, imageUrl }
  - GET `/api/details?movieUrl=/path` — returns { description, episodes }
  - GET `/api/watch?episodeUrl=/path` — returns proxied video/subtitle URLs
  - The proxy endpoint: `/api/proxy?videoUrl=<encoded>&referer=<encoded>`

Project-specific conventions and patterns

- Single-file app: everything is in `server.js`. When editing, keep helper functions (launchBrowser, autoScroll) near the top; route handlers follow.
- Error messages, logs, and comments must be in English — use clear, professional language for all code documentation and user-facing messages.
- API auth: every `/api` route is behind `authenticateKey` middleware. When adding new API routes, mount them onto `apiRouter` to inherit auth.
- Puppeteer configuration: browser launch uses a set of flags optimized for headless/container environments (`--no-sandbox`, `--disable-dev-shm-usage`, etc.). Keep these flags for Docker or server usage.
- Proxy rewriting: the proxy rewrites non-# playlist lines into `/api/proxy?videoUrl=...&referer=...`. When changing this logic, ensure absolute/relative URLs are handled the same way.

Examples from code to copy/pattern-match

- Auth middleware (use header `x-api-key` and compare to `process.env.API_KEY`): see `authenticateKey` in `server.js`.
- Capturing network responses in `/api/watch`: the code listens on `page.on('response', ...)` and resolves when an `.m3u8` URL is detected — preserve this event-driven pattern when extracting resources.
- Playlist rewriting (in `/api/proxy`): split the playlist by line, map relative segment lines to absolute URLs, then return a playlist that points back at this proxy.

Tests and debugging hints

- No tests currently. When writing tests, spin up the server on a different PORT and mock Puppeteer/networking where possible.
- To debug Puppeteer scripts locally, set `headless: false` in `launchBrowser()` temporarily and pass `slowMo` or open the devtools in the launched browser.

Limitations and safe-guards for AI edits

- Do not remove API key enforcement — the server intentionally exits when `API_KEY` is missing to avoid accidental public scraping.
- Be careful when adjusting timeouts and waits inside Puppeteer — target site is dynamic and relies on scroll/wait patterns.
- Avoid introducing global asynchronous side-effects in the top-level file (server.js is loaded once and runs immediately).

If something's unclear

- If you need an alternate BASE_URL for testing, add it to `.env` and confirm endpoints still resolve CSS selectors used in `server.js`.

If you want changes to this guidance

- Tell me which section is unclear or add any missing conventions you use (branching, PR templates, tests) and I will update this file.

# overview

RoFlix - Ứng dụng Xem phim Tizen TV (Cá nhân)

1. Tổng quan (Overview)

Mục tiêu: Xây dựng một ứng dụng TV Tizen (cho Samsung TV) để xem phim từ các nguồn website trực tuyến, phục vụ mục đích sử dụng cá nhân. Ứng dụng không nhắm đến việc phát hành công khai.

Kiến trúc: Dự án bao gồm hai thành phần chính hoạt động phối hợp:

Frontend (Tizen TV App): Giao diện người dùng chạy trực tiếp trên TV Samsung. Chịu trách nhiệm hiển thị danh sách phim, chi tiết, trình phát video và tương tác với người dùng qua remote.

Backend (Node.js API Server): Một server trung gian chạy trên máy tính cá nhân (local) hoặc trên nền tảng đám mây (Render.com). Server này đóng vai trò "cào" (scrape) dữ liệu từ các website nguồn (hiện tại là rophim.mx và API phim.nguonc.com), xử lý và cung cấp dữ liệu (dưới dạng JSON) cho Tizen TV App thông qua các API endpoint. Server cũng đóng vai trò proxy cho luồng video HLS để vượt qua các cơ chế bảo mật.

Luồng hoạt động chính: TV App <-- (API Call) --> Node.js Server <-- (Scraping/API Call) --> Website Nguồn

2. Công nghệ sử dụng (Technologies Used)

Frontend (Tizen TV App - tizen-phim-app):

Ngôn ngữ: HTML5, CSS3, JavaScript (ES6+)

Nền tảng: Tizen Web Application

Thư viện:

hls.js: Để phát video HLS trên Web Simulator (không cần thiết trên TV thật).

Font Awesome: Cho các biểu tượng.

APIs: Tizen Web Device APIs (cho điều khiển remote), Fetch API.

Backend (Node.js API Server - tizen-phim-server):

Runtime: Node.js (v18+)

Framework: Express.js

Scraping/Automation:

Puppeteer-extra + puppeteer-extra-plugin-stealth (với puppeteer-core): Để cào dữ liệu từ các trang web phức tạp (như rophim.mx) và vượt qua các biện pháp chống bot. Yêu cầu Chrome/Chromium cài đặt sẵn.

Cheerio: Để phân tích (parse) cấu trúc HTML.

Networking: Axios: Để gọi API phim.nguonc.com và làm proxy video.

Configuration: Dotenv: Để quản lý biến môi trường qua file .env.

Security: Middleware xác thực API Key đơn giản.

Khác: Cors.

Deployment (Triển khai Server):

Docker: Để đóng gói server và môi trường chạy (bao gồm Chromium) vào container.

Render.com: Nền tảng PaaS miễn phí hỗ trợ Docker để host server.

Git / GitHub: Để quản lý mã nguồn và tự động triển khai lên Render.

Development Environment (Môi trường Phát triển):

Tizen Studio (bản có IDE): Để tạo Certificate, tạo project Tizen, build/run/debug trên TV/Emulator/Simulator.

VS Code (hoặc editor khác): Để viết code cho server Node.js và Tizen App.

Terminal (CLI): Để chạy server local, cài đặt dependencies (npm), build/install Tizen app (tùy chọn).

Trình duyệt (Chrome/Firefox): Để kiểm tra API server, debug Web Simulator, tìm kiếm API nội bộ.

3. Cấu trúc Dự án (Project Structure)

Dự án được chia thành 2 thư mục chính riêng biệt:

tizen-phim-server/: Chứa toàn bộ mã nguồn của Node.js API Server.

server.js: File chính chạy server.

package.json: Quản lý dependencies.

.env: Chứa các biến môi trường (API_KEY, BASE_URL...). Không commit file này.

.gitignore: Quy tắc bỏ qua file/thư mục khi commit.

Dockerfile: Cấu hình để build Docker image cho Render.

healthcheck.js: Script kiểm tra "sức khỏe" cho Docker/Render.

.dockerignore: Quy tắc bỏ qua file/thư mục khi build Docker.

tizen-phim-app/ (Thư mục dự án Tizen, ví dụ tên là roflix): Chứa mã nguồn của ứng dụng chạy trên TV.

index.html: Giao diện và logic chính của ứng dụng.

config.js: File cấu hình chứa URL server và API Key (đã mã hóa Base64).

config.xml: File cấu hình của Tizen App (quyền, metadata...).

icon.png: Biểu tượng ứng dụng.

Các file khác do Tizen Studio tự tạo (.project, .tproject...).

4. Hướng dẫn Cài đặt & Build (Setup & Build Instructions)

4.1. Server (Local Development)

Mục đích: Chạy server trên máy tính cá nhân để phát triển và gỡ lỗi.

Prerequisites:

Node.js (v18+) và npm.

Git.

Google Chrome hoặc Chromium đã được cài đặt.

Clone Repository: git clone <your-repo-url>

Install Dependencies:

cd tizen-phim-server
npm install

# Cài thêm dotenv nếu chưa có

npm install dotenv

# Cài các gói puppeteer cần thiết

npm install puppeteer-core puppeteer-extra puppeteer-extra-plugin-stealth

Create .env file:

Tạo file .env trong thư mục tizen-phim-server.

Copy nội dung từ file .env.example (nếu có) hoặc thêm các dòng sau:

# API Key bí mật của bạn (có thể tự nghĩ ra)

API_KEY=YOUR_SUPER_SECRET_KEY

# URL các nguồn (có thể giữ nguyên mặc định)

ROPHIM_BASE_URL=[https://rophim.mx](https://rophim.mx)
OPHIM_API_URL=[https://phim.nguonc.com/api](https://phim.nguonc.com/api)

# Đường dẫn tới Chrome/Chromium trên máy bạn

CHROME_PATH=/path/to/your/chrome_or_chromium

Tìm CHROME_PATH: Dùng lệnh which google-chrome hoặc whereis google-chrome / which chromium-browser.

Run Server:

node server.js

Server sẽ chạy tại <http://localhost:3000>.

4.2. Tizen TV App (Local Development & Testing)

Mục đích: Build và chạy ứng dụng trên TV thật hoặc máy ảo/simulator để gỡ lỗi giao diện và kết nối.

Prerequisites:

Tizen Studio (bản có IDE) đã được cài đặt.

Trong Package Manager của Tizen Studio, đảm bảo đã cài: Tizen SDK tools, TV Extensions (mới nhất), Samsung Certificate Extension.

Mở Tizen Studio (GUI).

Kết nối TV thật:

Bật Developer Mode trên TV, nhập IP máy tính. Khởi động lại TV.

Trong Tizen Studio, mở Device Manager, kết nối TV (trạng thái "Connected").

Tạo Certificate Samsung:

Mở Certificate Manager, nhấn +, chọn "Samsung", làm theo các bước để tạo profile mới (ví dụ: roflix_samsung_cert). DUID sẽ được lấy tự động.

Tạo Tizen Web Project:

File > New > Tizen Project > Template > TV > Web Application > Basic Project. Đặt tên roflix.

Sao chép Mã nguồn:

Xóa nội dung file index.html mặc định và dán nội dung từ file tizen-phim-app/index.html của chúng ta vào.

Tạo file config.js trong project và dán nội dung từ file tizen-phim-app/config.js vào.

Cấu hình config.js cho Môi trường Test:

Test trên TV thật: Sửa serverUrl thành http://<IP_MAY_TINH_CUA_BAN>:3000.

Test trên Emulator: Sửa serverUrl thành <http://10.0.2.2:3000>.

Test trên Web Simulator: Sửa serverUrl thành <http://localhost:3000>.

Đảm bảo encodedApiKey trong config.js khớp (sau khi mã hóa Base64) với API_KEY trong file .env của server.

Cấu hình config.xml:

Mở config.xml, chọn tab "Source".

Đảm bảo các dòng sau tồn tại bên trong thẻ <widget>:

<tizen:privilege name="[http://tizen.org/privilege/internet](http://tizen.org/privilege/internet)"/>
<access origin="[http://10.0.2.2:3000](http://10.0.2.2:3000)" subdomains="true"/>
<access origin="http://<IP_MAY_TINH_CUA_BAN>:3000" subdomains="true"/>
<access origin="http://localhost:3000" subdomains="true"/>
<access origin="*" subdomains="true"/>
<tizen:content-security-policy>connect-src *;</tizen:content-security-policy>

### API nguonc tham khao

Dành cho nhà phát triển Website

Danh sách phim
Phim mới cập nhật
GEThttps://phim.nguonc.com/api/films/phim-moi-cap-nhat?page=${page}
Ví dụ: https://phim.nguonc.com/api/films/phim-moi-cap-nhat?page=1
Phim theo danh mục
GEThttps://phim.nguonc.com/api/films/danh-sach/${slug}?page=${page}
Ví dụ: <https://phim.nguonc.com/api/films/danh-sach/phim-dang-chieu?page=1>

Phim & Tập Phim
Thông tin Phim & Danh sách tập phim
GEThttps://phim.nguonc.com/api/film/${slug}
Ví dụ: <https://phim.nguonc.com/api/film/hoa-thien-cot>

Thể loại & Quốc gia & Năm
Phim theo thể loại
GEThttps://phim.nguonc.com/api/films/the-loai/${slug}?page=${page}
Ví dụ: <https://phim.nguonc.com/api/films/the-loai/hanh-dong?page=1>
Phim theo quốc gia
GEThttps://phim.nguonc.com/api/films/quoc-gia/${slug}?page=${page}
Ví dụ: <https://phim.nguonc.com/api/films/quoc-gia/au-my?page=1>
Phim theo năm
GEThttps://phim.nguonc.com/api/films/nam-phat-hanh/${slug}?page=${page}
Ví dụ: <https://phim.nguonc.com/api/films/nam-phat-hanh/2024?page=1>

Tìm Phim
Tìm kiếm phim
GEThttps://phim.nguonc.com/api/films/search?keyword=${slug}
Ví dụ: <https://phim.nguonc.com/api/films/search?keyword=Regeneration>
