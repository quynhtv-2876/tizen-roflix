# RoFlix — Product Specification

> **Version**: 2.0  
> **Last Updated**: 2026-03-18  
> **Status**: In Development

---

## 1. Product Overview

**RoFlix** là ứng dụng xem phim cá nhân trên Samsung Smart TV (Tizen OS), dành cho 1-2 người dùng trong gia đình.

### Goals
- Xem phim streaming trực tiếp từ CDN qua TV remote
- Tốc độ nhanh, trải nghiệm mượt mà
- Ổn định, không phụ thuộc vào các nguồn dữ liệu không ổn định

### Non-Goals
- Không lưu file video local
- Không phát hành công khai / đa người dùng
- Không có tính năng mạng xã hội

---

## 2. Architecture

```
Samsung TV (Tizen App)
        │
        │  HTTP API (X-API-KEY)
        ▼
Node.js Server (Express)
        │
        ├── SQLite (metadata cache, watch history)
        │
        └── HLS Proxy ──► Video CDN (stream-through)
                │
                └── NguonC API (https://phim.nguonc.com/api)
```

### Components

| Component | Tech | Purpose |
|-----------|------|---------|
| `roflix/` | Tizen Web App (Vanilla JS) | TV client UI |
| `roflix-server/` | Node.js + Express | API gateway + HLS proxy |
| SQLite (`roflix.db`) | better-sqlite3 | Metadata cache + watch history |

---

## 3. Features

### 3.1 Movie Browsing (Grid View) ✅
- Hiển thị danh sách phim mới cập nhật dạng grid
- Infinite scroll: load thêm khi gần cuối (batch 3 trang song song)
- Lazy loading ảnh poster
- Điều hướng bằng remote D-pad

### 3.2 Search ✅
- Tìm kiếm phim theo từ khóa
- Debounce 500ms
- Hiển thị kết quả dạng grid

### 3.3 Movie Details ✅
- Poster, tiêu đề, mô tả, thể loại, năm, chất lượng
- Danh sách tập phim theo server
- Chọn server / tập để xem

### 3.4 Video Playback ✅
- Native HTML5 video trên TV (HLS natively supported)
- HLS.js cho simulator/browser
- Progress bar
- Toggle phụ đề (nếu có)

### 3.5 Metadata Cache 🔲 (To Implement)
- Cache danh sách phim (TTL: 1 giờ) trong SQLite
- Cache chi tiết phim + episodes (TTL: 2 giờ)
- Cache search results (TTL: 30 phút)
- Tự động invalidate khi hết hạn

### 3.6 Continue Watching 🔲 (To Implement)
- Lưu vị trí xem mỗi 10 giây vào SQLite
- Hiển thị prompt "Tiếp tục từ MM:SS?" khi mở lại tập đã xem
- Badge "Đang xem" trên movie card trong grid

### 3.7 Remove RoPhim Source 🔲 (To Implement)
- Xóa toàn bộ RoPhim scraping (Puppeteer)
- Xóa source selection screen
- Chỉ dùng NguonC API

---

## 4. Data Models

### Movie (Cached)
```typescript
interface CachedMovie {
  slug: string;          // Primary key
  title: string;
  original_title: string;
  poster_url: string;
  thumb_url: string;
  description: string;
  quality: string;       // "HD", "4K", etc.
  language: string;
  total_episodes: number;
  current_episode: string;
  batch: number;         // Which batch this belongs to
  cached_at: string;     // ISO datetime
}
```

### Episode (Cached)
```typescript
interface CachedEpisode {
  movie_slug: string;
  server_name: string;
  episode_name: string;
  episode_slug: string;
  m3u8_url: string;    // Direct stream link
  embed_url: string;   // Fallback embed
  cached_at: string;
}
```

### Watch History
```typescript
interface WatchHistory {
  movie_slug: string;
  episode_name: string;
  position: number;       // seconds
  duration: number;       // total duration in seconds
  updated_at: string;
}
```

---

## 5. API Contracts

### Server → Client

#### `GET /api/nguonc/phimhay`
```
Query: batch (int, default 1)
Headers: X-API-KEY

Response:
{
  movies: CachedMovie[],
  batch: number,
  hasMore: boolean,
  source: "cache" | "api"
}
```

#### `GET /api/nguonc/details`
```
Query: movieSlug (string)
Headers: X-API-KEY

Response:
{
  movie: MovieDetail,
  episodes: EpisodeServer[],
  source: "cache" | "api"
}
```

#### `GET /api/nguonc/watch`
```
Query: movieSlug, episodeName
Headers: X-API-KEY

Response:
{
  videoUrl: string,   // Proxied M3U8 URL
  subtitleUrl: string | null
}
```

#### `POST /api/nguonc/watch-position`
```
Body: { movieSlug, episodeName, position, duration }
Headers: X-API-KEY

Response: { success: true }
```

#### `GET /api/nguonc/watch-position`
```
Query: movieSlug, episodeName
Headers: X-API-KEY

Response: { position: number | null, duration: number | null }
```

#### `GET /api/nguonc/search`
```
Query: keyword (string)
Headers: X-API-KEY

Response: { movies: CachedMovie[] }
```

#### `GET /api/proxy`
```
Query: videoUrl (encoded), referer (encoded)
[No auth required — proxies HLS stream-through]

Response: HLS playlist or segment stream
```

---

## 6. NguonC External API

Base URL: `https://phim.nguonc.com/api`  
Auth: None required  
See: `stocks/NGUONC_API_REFERENCE.md` for full documentation.

Key endpoints used:
- `GET /films/phim-moi-cap-nhat?page={n}` — Movie list
- `GET /film/{slug}` — Movie detail + episodes
- `GET /films/search?keyword={q}` — Search

---

## 7. Client UI States / Views

```
App Start
    │
    ▼
Grid View (default)
    │
    ├── ← Back → Exit App
    ├── Search (dedicated search view)
    │       └── Select result → Movie Details
    └── Select movie → Movie Details
                          └── Select episode → Player
                                                └── ← Back → Movie Details
```

### Navigation Rules
- **D-pad Up/Down/Left/Right**: Move focus
- **Enter / OK**: Select / confirm
- **Back (10009)**: Go back one level; at grid → exit app
- **Search**: Enter search mode (on-screen keyboard or physical)

---

## 8. Performance Requirements

| Metric | Target |
|--------|--------|
| Initial grid load (cache hit) | < 500ms |
| Initial grid load (cache miss) | < 3s |
| Movie detail load (cache hit) | < 200ms |
| Video start time | < 4s |
| SQLite DB size (1000 movies) | < 10MB |
| Server RAM usage | < 80MB |

---

## 9. Environment Configuration

### Server `.env`
```bash
API_KEY=ROFLIX_SUPER_SECRET_KEY_123
PORT=3000
OPHIM_API_URL=https://phim.nguonc.com/api
DB_PATH=./data/roflix.db          # SQLite database path
CACHE_TTL_MOVIES=3600             # seconds (1 hour)
CACHE_TTL_EPISODES=7200           # seconds (2 hours)
CACHE_TTL_SEARCH=1800             # seconds (30 minutes)
```

### Client `config.js`
```javascript
const config = {
  serverUrl: 'http://<SERVER_IP>:3000',
  encodedApiKey: btoa('ROFLIX_SUPER_SECRET_KEY_123')
};
```

---

## 10. Open Questions

- [ ] Có cần thêm filter phim theo thể loại/quốc gia trong grid không?
- [ ] Favorites list có cần implement không?
- [ ] Subtitle support cần xử lý VTT hay chỉ M3U8 embedded?
