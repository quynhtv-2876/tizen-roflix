# T06 — Testing & Validation

**Milestone**: M5  
**Status**: 🔲 TODO  
**Estimate**: 2 hours  
**Spec ref**: `.agents/spec.md` §8  
**Depends on**: T01, T02, T03, T04, T05

---

## Context

Final validation sau khi implement tất cả các tasks. Verify rằng toàn bộ app hoạt động đúng, cache tăng performance, và continue watching hoạt động mượt mà.

---

## Acceptance Criteria (Full Regression)

### Server
- [ ] Server starts cleanly (no Puppeteer/Chromium errors)
- [ ] RAM usage < 80MB (check `ps aux | grep node`)
- [ ] All NguonC endpoints respond correctly
- [ ] Cache works (second request faster)
- [ ] Watch position saves and loads correctly
- [ ] Proxy streams video correctly

### Client
- [ ] App opens directly at grid view
- [ ] Movies load on first visit (< 3s)
- [ ] Movies load from cache on revisit (< 500ms)
- [ ] Search returns results
- [ ] Movie details display correctly
- [ ] Video plays (native HLS on TV / HLS.js in simulator)
- [ ] Back button at grid exits app
- [ ] Continue watching prompt appears correctly
- [ ] Resume works (video seeks to correct position)

---

## Test Scripts

### Server Smoke Tests

Run these bash commands after starting the server:

```bash
BASE_URL="http://localhost:3000"
API_KEY="ROFLIX_SUPER_SECRET_KEY_123"
HEADERS="-H 'X-API-KEY: $API_KEY'"

# 1. Health check
curl -s "$BASE_URL/" 
# → "RoFlix server is running."

# 2. Movie list (cache miss)
echo "=== Movie List (should be 'api') ==="
time curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/nguonc/phimhay?batch=1" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'source: {d[\"source\"]}')
print(f'movie count: {len(d[\"movies\"])}')
print(f'first movie: {d[\"movies\"][0][\"title\"]}')
"

# 3. Movie list (cache hit)
echo "=== Movie List (should be 'cache') ==="
time curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/nguonc/phimhay?batch=1" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'source: {d[\"source\"]}')
"

# 4. Search
echo "=== Search ==="
curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/nguonc/search?keyword=one+piece" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'results: {len(d.get(\"movies\", []))}')
"

# 5. Movie details
echo "=== Movie Details ==="
SLUG=$(curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/nguonc/phimhay?batch=1" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d['movies'][0]['slug'])
")
echo "Testing slug: $SLUG"
curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/nguonc/details?movieSlug=$SLUG" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'movie: {d[\"movie\"][\"name\"]}')
print(f'episode servers: {len(d[\"episodes\"])}')
print(f'source: {d[\"source\"]}')
"

# 6. Watch position save
echo "=== Watch Position Save ==="
curl -s -X POST \
  -H "X-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"movieSlug\":\"$SLUG\",\"episodeName\":\"Tập 1\",\"position\":125,\"duration\":2700}" \
  "$BASE_URL/api/nguonc/watch-position"

# 7. Watch position load
echo "=== Watch Position Load ==="
curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/nguonc/watch-position?movieSlug=$SLUG&episodeName=Tập 1"
# → {"position":125,"duration":2700}

# 8. Watch (get video URL)
echo "=== Watch URL ==="
curl -s -H "X-API-KEY: $API_KEY" \
  "$BASE_URL/api/nguonc/watch?movieSlug=$SLUG" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'videoUrl starts with: {d.get(\"videoUrl\", \"\")[:60]}')
"

echo "=== ALL TESTS DONE ==="
```

### Performance Benchmark

```bash
# Measure response times
echo "Cache miss time:"
time curl -s -H "X-API-KEY: ROFLIX_SUPER_SECRET_KEY_123" \
  "http://localhost:3000/api/nguonc/phimhay?batch=99" > /dev/null

# Clear batch 1 cache via SQLite to force miss
cd roflix-server && node -e "
  const Database = require('better-sqlite3');
  const db = new Database('./data/roflix.db');
  db.prepare('DELETE FROM movie_cache WHERE batch = 1').run();
  console.log('Cache cleared for batch 1');
"

echo "After clear — cache miss:"
time curl -s -H "X-API-KEY: ROFLIX_SUPER_SECRET_KEY_123" \
  "http://localhost:3000/api/nguonc/phimhay?batch=1" > /dev/null

echo "Cache hit:"
time curl -s -H "X-API-KEY: ROFLIX_SUPER_SECRET_KEY_123" \
  "http://localhost:3000/api/nguonc/phimhay?batch=1" > /dev/null
```

Expected results:
- Cache miss: < 3000ms
- Cache hit: < 100ms

### Memory Check

```bash
# Start server
node roflix-server/server.js &
SERVER_PID=$!

# Wait for startup
sleep 2

# Check memory
ps -o pid,vsz,rss,comm -p $SERVER_PID
# RSS should be < 80MB (80000 kB)

# Kill
kill $SERVER_PID
```

### Client Manual Test Checklist

**Environment**: Tizen Web Simulator or Samsung TV

1. **Startup**
   - [ ] App shows grid (no source selection screen)
   - [ ] Movies load within 3 seconds
   - [ ] Posters display correctly

2. **Navigation**
   - [ ] D-pad moves focus smoothly
   - [ ] Enter on movie → details view
   - [ ] Pressing Back at grid → app exits

3. **Search**
   - [ ] Navigate to search
   - [ ] Type keyword
   - [ ] Results appear
   - [ ] Select result → details

4. **Playback**
   - [ ] Select episode → video loads
   - [ ] Video plays (no black screen)
   - [ ] Progress bar updates
   - [ ] Back from player → details

5. **Continue Watching**
   - [ ] Watch a movie for 2+ minutes
   - [ ] Exit player (Back button)
   - [ ] Go back to same movie, same episode
   - [ ] Resume dialog appears with correct time
   - [ ] "Tiếp tục" → video seeks to correct position
   - [ ] "Từ đầu" → video starts from 0

6. **Performance**
   - [ ] Second visit to grid is noticeably faster (cache)
   - [ ] No loading spinner after cache warms up

---

## Known Issues to Watch For

- M3U8 links from CDN may expire — if playback fails, check if link is stale
- Better-sqlite3 requires native build — `npm install` may take longer on some systems
- Tizen simulator uses HLS.js (not native) — test native on real TV

---

## Sign-off Checklist

- [ ] All smoke tests pass
- [ ] Performance targets met (cache hit < 100ms)
- [ ] Manual checklist completed on TV or simulator
- [ ] No Puppeteer/Chromium references in codebase
- [ ] `git status` shows no unexpected modified files
- [ ] Commit with message: `feat: v2.0 - Remove RoPhim, add SQLite cache, continue watching`
