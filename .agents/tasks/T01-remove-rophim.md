# T01 — Remove RoPhim Source

**Milestone**: M1  
**Status**: 🔲 TODO  
**Estimate**: 1-2 hours  
**Spec ref**: `.agents/spec.md` §3.7

---

## Context

RoPhim sử dụng Puppeteer để scrape website, rất chậm (5-10s/request) và không ổn định khi domain thay đổi. Ta sẽ xóa hoàn toàn để giảm complexity và memory footprint (~75% RAM).

---

## Acceptance Criteria

- [ ] Server khởi động không có Puppeteer imports/errors
- [ ] Không còn `/api/rophim/*` endpoints
- [ ] `npm start` chạy thành công
- [ ] Server RAM < 80MB (so với ~200MB trước)
- [ ] Không còn Chromium requirement trong Dockerfile

---

## Steps

### Step 1: Backup
```bash
cp roflix-server/server.js roflix-server/server.js.bak
```

### Step 2: Edit `roflix-server/server.js`

Remove the following:

**Imports to delete** (top of file):
```javascript
// DELETE THESE:
const puppeteer = require("puppeteer-extra");
const puppeteerCore = require("puppeteer-core");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const cheerio = require("cheerio");

// DELETE THESE lines:
puppeteer.puppeteer = puppeteerCore;
puppeteer.use(StealthPlugin());
```

**Variables to delete**:
```javascript
// DELETE:
const ROPHIM_BASE_URL = process.env.ROPHIM_BASE_URL || 'https://rophim.mx';

// DELETE the entire Chromium path detection block (~lines 31-50):
const possiblePaths = [...]
const CHROMIUM_EXECUTABLE_PATH = ...
if (!CHROMIUM_EXECUTABLE_PATH) { ... }
```

**Functions to delete**:
- `async function launchBrowser()` — entire function
- `async function autoScroll(page)` — entire function

**Router to delete**:
- The entire `rophimRouter` definition and all its routes
- `app.use('/api/rophim', rophimRouter);`

**Keep everything else** (NguonC router, proxy, auth middleware, etc.)

### Step 3: Edit `roflix-server/package.json`

```bash
cd roflix-server
npm uninstall puppeteer-core puppeteer-extra puppeteer-extra-plugin-stealth cheerio
```

Verify `package.json` no longer lists those packages.

### Step 4: Edit `roflix-server/Dockerfile`

Remove the Chromium install block. Replace the heavy apt-get section with:
```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
```

Remove any ENV variables related to Chromium:
```dockerfile
# DELETE:
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROME_PATH=/usr/bin/chromium
```

Add volume for future SQLite database:
```dockerfile
VOLUME ["/app/data"]
```

### Step 5: Remove `.env` variables
In `roflix-server/.env` (and `.env.example`), remove:
```
ROPHIM_BASE_URL=...
CHROME_PATH=...
```

### Step 6: Verify
```bash
cd roflix-server
npm install
node server.js
# Should start cleanly, no Puppeteer warnings
curl -H "X-API-KEY: ROFLIX_SUPER_SECRET_KEY_123" \
  http://localhost:3000/api/nguonc/phimhay?batch=1
# Should return movies from NguonC
```

---

## Notes

- Do NOT remove `axios` or `cors` — still needed
- The `/api/proxy` endpoint must remain untouched
- Keep `express.json()` middleware for future POST endpoints (watch position)
