# T03 — Integrate Cache into Server Endpoints

**Milestone**: M2  
**Status**: 🔲 TODO  
**Estimate**: 1.5 hours  
**Spec ref**: `.agents/spec.md` §5  
**Depends on**: T01, T02

---

## Context

Cập nhật các NguonC endpoints trong `server.js` để sử dụng SQLite cache từ `db.js`.  
Pattern: **cache-aside** — check cache trước, nếu miss thì fetch API rồi lưu cache.

---

## Acceptance Criteria

- [ ] `GET /api/nguonc/phimhay` returns `source: "cache"` on second request
- [ ] `GET /api/nguonc/details` returns cached episodes
- [ ] `GET /api/nguonc/search` works (không cache — search luôn live)
- [ ] Cache miss time < 3s, cache hit time < 100ms
- [ ] Server logs `[DB] Cache HIT` / `[DB] Cache MISS`

---

## Steps

### Step 1: Import db module in `server.js`

Add at top (after dotenv):
```javascript
const db = require('./db');
```

### Step 2: Update `/phimhay` endpoint

Find the `nguoncRouter.get('/phimhay', ...)` handler and replace its body:

```javascript
nguoncRouter.get('/phimhay', async (req, res) => {
  const batch = parseInt(req.query.batch, 10) || 1;
  const pagesPerBatch = 3;

  // 1. Check cache
  const cached = db.getMoviesCache(batch);
  if (cached.length > 0) {
    console.log(`[DB] Cache HIT: ${cached.length} movies (batch ${batch})`);
    return res.json({ movies: cached, batch, hasMore: true, source: 'cache' });
  }

  console.log(`[DB] Cache MISS: fetching batch ${batch} from NguonC API`);

  // 2. Fetch from API (3 pages in parallel)
  const startPage = (batch - 1) * pagesPerBatch + 1;
  try {
    const promises = [];
    for (let page = startPage; page < startPage + pagesPerBatch; page++) {
      promises.push(callNguonCApi(`/films/phim-moi-cap-nhat?page=${page}`));
    }
    const results = await Promise.all(promises);

    const allMovies = results.flatMap(data => {
      if (!data?.items) return [];
      return data.items.map(item => ({
        slug: item.slug,
        name: item.name,
        original_title: item.original_name,
        poster_url: makeAbsoluteUrl(item.poster_url, OPHIM_DOMAIN),
        thumb_url: makeAbsoluteUrl(item.thumb_url, OPHIM_DOMAIN),
        description: item.description,
        quality: item.quality,
        language: item.language,
        total_episodes: item.total_episodes,
        current_episode: item.current_episode,
      }));
    });

    // 3. Save to cache
    if (allMovies.length > 0) {
      db.cacheMovies(allMovies, batch);
    }

    const hasMore = allMovies.length >= pagesPerBatch * 10;
    res.json({ movies: allMovies, batch, hasMore, source: 'api' });

  } catch (err) {
    console.error('[NGUONC] Error fetching phimhay:', err.message);
    res.status(500).json({ message: 'Lỗi khi tải danh sách phim', error: err.message });
  }
});
```

### Step 3: Update `/details` endpoint

Find `nguoncRouter.get('/details', ...)` and replace:

```javascript
nguoncRouter.get('/details', async (req, res) => {
  const { movieSlug } = req.query;
  if (!movieSlug) {
    return res.status(400).json({ message: 'Thiếu movieSlug' });
  }

  // 1. Check episode cache
  const cachedEpisodes = db.getEpisodeCache(movieSlug);
  if (cachedEpisodes) {
    console.log(`[DB] Cache HIT: episodes for ${movieSlug}`);
    // Still need movie metadata — get from movie_cache
    const cachedMovies = db.getMoviesCache(1); // simple fallback
    const movie = cachedMovies.find(m => m.slug === movieSlug) || null;
    return res.json({ movie, episodes: cachedEpisodes, source: 'cache' });
  }

  console.log(`[DB] Cache MISS: fetching details for ${movieSlug}`);

  try {
    const data = await callNguonCApi(`/film/${movieSlug}`);
    if (!data?.movie) {
      return res.status(404).json({ message: 'Không tìm thấy phim' });
    }

    // 2. Cache episodes
    if (data.episodes?.length > 0) {
      db.cacheEpisodes(movieSlug, data.episodes);
    }

    res.json({ movie: data.movie, episodes: data.episodes || [], source: 'api' });

  } catch (err) {
    console.error('[NGUONC] Error fetching details:', err.message);
    res.status(500).json({ message: 'Lỗi khi tải chi tiết phim', error: err.message });
  }
});
```

### Step 4: Search endpoint (no cache needed — always live)

Search should remain unchanged (or add simple in-memory debounce if needed).  
Verify it still works:
```bash
curl -H "X-API-KEY: ROFLIX_SUPER_SECRET_KEY_123" \
  "http://localhost:3000/api/nguonc/search?keyword=one+piece"
```

### Step 5: Add watch-position endpoints

Add AFTER the existing NguonC routes, BEFORE `module.exports`:

```javascript
// Save watch position
nguoncRouter.post('/watch-position', (req, res) => {
  const { movieSlug, episodeName, position, duration } = req.body;
  if (!movieSlug || !episodeName || position === undefined) {
    return res.status(400).json({ message: 'Thiếu movieSlug, episodeName hoặc position' });
  }
  db.saveWatchPosition(movieSlug, episodeName, Math.floor(position), duration ?? null);
  res.json({ success: true });
});

// Get watch position
nguoncRouter.get('/watch-position', (req, res) => {
  const { movieSlug, episodeName } = req.query;
  if (!movieSlug || !episodeName) {
    return res.status(400).json({ message: 'Thiếu movieSlug hoặc episodeName' });
  }
  const result = db.getWatchPosition(movieSlug, episodeName);
  res.json(result ?? { position: null, duration: null });
});
```

### Step 6: Ensure `express.json()` middleware is enabled

In server.js, after `const app = express();`:
```javascript
app.use(express.json());  // For POST body parsing
```

### Step 7: Test

```bash
# Test cache miss (first request)
curl -s -H "X-API-KEY: ROFLIX_SUPER_SECRET_KEY_123" \
  "http://localhost:3000/api/nguonc/phimhay?batch=1" | jq '.source'
# → "api"

# Test cache hit (second request, should be fast)
curl -s -H "X-API-KEY: ROFLIX_SUPER_SECRET_KEY_123" \
  "http://localhost:3000/api/nguonc/phimhay?batch=1" | jq '.source'
# → "cache"

# Test watch position
curl -s -X POST \
  -H "X-API-KEY: ROFLIX_SUPER_SECRET_KEY_123" \
  -H "Content-Type: application/json" \
  -d '{"movieSlug":"test-slug","episodeName":"Tập 1","position":125,"duration":2700}' \
  "http://localhost:3000/api/nguonc/watch-position"

curl -s -H "X-API-KEY: ROFLIX_SUPER_SECRET_KEY_123" \
  "http://localhost:3000/api/nguonc/watch-position?movieSlug=test-slug&episodeName=Tập 1"
# → {"position":125,"duration":2700}
```

---

## Notes

- `callNguonCApi` function already exists in server.js — reuse it
- `makeAbsoluteUrl` function already exists in server.js — reuse it
- `OPHIM_DOMAIN` constant already exists in server.js — reuse it
- Do NOT cache the `/watch` endpoint — M3U8 links expire from CDN
