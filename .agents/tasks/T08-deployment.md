# T08 — Server Deployment (Free Hosting)

**Status**: 🔲 TODO  
**Estimate**: 1-2 hours  
**Depends on**: T01, T02, T03 (server phải stable trước)

---

## Context

Deploy `roflix-server` lên cloud để:
- TV không cần máy tính local bật
- Truy cập từ bất kỳ đâu trong nhà
- Free tier đủ dùng cho 1-2 users

---

## Platform Comparison

| Platform | Free Tier | Sleep? | RAM | SQLite | Docker | Verdict |
|----------|-----------|--------|-----|--------|--------|---------|
| **Railway** | $5 credit/month | ❌ No | 512MB | ✅ Yes (Volume) | ✅ Yes | ⭐ **Best** |
| **Render** | 750h/month | ✅ 15min | 512MB | ⚠️ Ephemeral | ✅ Yes | Good |
| **Fly.io** | 3 VMs free | ❌ No | 256MB | ✅ Volume | ✅ Yes | Good |
| **Koyeb** | 1 instance | ❌ No | 512MB | ⚠️ Ephemeral | ✅ Yes | OK |
| **Vercel** | Unlimited | N/A | N/A | ❌ No | ❌ No | ❌ Not suitable |
| **Heroku** | None free | — | — | — | — | ❌ Paid only |

### Recommendation: **Railway** (Best for this use case)

**Tại sao Railway?**
- ✅ **Không sleep** — TV kết nối lúc nào cũng được
- ✅ **Persistent volume** — SQLite database survive restarts
- ✅ **$5 free credit/month** — đủ cho ~500h runtime (server nhẹ ~30MB RAM)
- ✅ **Auto-deploy từ GitHub** — push code tự deploy
- ✅ **Environment variables** — set qua dashboard, không cần file
- ✅ **Custom domain** — có thể dùng domain riêng

**Backup option: Fly.io** nếu cần thêm resources

---

## Steps (Railway Deployment)

### Step 1: Prepare `roflix-server/` for deployment

Ensure `Dockerfile` is production-ready (after T01 — Puppeteer removed):

```dockerfile
FROM node:22-alpine

WORKDIR /app

# Install only production deps
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY server.js ./
COPY db.js ./          # Added in T02
COPY healthcheck.js ./

# Create data directory for SQLite
RUN mkdir -p /app/data

# Non-root user
RUN addgroup -S roflix && adduser -S roflix -G roflix
RUN chown -R roflix:roflix /app
USER roflix

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s \
  CMD node healthcheck.js

VOLUME ["/app/data"]

CMD ["node", "server.js"]
```

### Step 2: Add railway.toml (optional but helpful)

Create `roflix-server/railway.toml`:
```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "node server.js"
healthcheckPath = "/"
healthcheckTimeout = 10
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3

[[volumes]]
mountPath = "/app/data"
```

### Step 3: Sign up & deploy on Railway

```
1. Go to https://railway.app
2. Sign up with GitHub account
3. "New Project" → "Deploy from GitHub repo"
4. Select your repo → select "roflix-server" folder
   (or set Root Directory to "roflix-server" in settings)
5. Railway auto-detects Dockerfile and builds
```

### Step 4: Configure Environment Variables on Railway

In Railway dashboard → Variables tab, add:
```
API_KEY=<your-strong-random-key>
PORT=3000
OPHIM_API_URL=https://phim.nguonc.com/api
DB_PATH=/app/data/roflix.db
CACHE_TTL_MOVIES=3600
CACHE_TTL_EPISODES=7200
CACHE_TTL_SEARCH=1800
```

> [!IMPORTANT]
> Generate a strong API_KEY: `openssl rand -hex 32`  
> This becomes your production key — different from local dev key!

### Step 5: Add Persistent Volume for SQLite

In Railway dashboard:
1. Go to your service → Volumes tab
2. "Add Volume"
3. Mount path: `/app/data`
4. This ensures `roflix.db` persists across deploys

### Step 6: Get public URL

Railway automatically assigns:  
`https://<your-service>.up.railway.app`

Example: `https://roflix-server.up.railway.app`

### Step 7: Update Tizen client config

In `roflix/config.js`:
```javascript
const config = {
    serverUrl: 'https://roflix-server.up.railway.app',
    encodedApiKey: btoa('your-strong-production-api-key'),
};
```

In `roflix/config.xml`, add the Railway URL to allowed origins:
```xml
<access origin="https://roflix-server.up.railway.app" subdomains="true"/>
```

### Step 8: Verify deployment

```bash
PROD_URL="https://your-service.up.railway.app"
PROD_KEY="your-production-api-key"

# Health check
curl "$PROD_URL/"
# → "RoFlix server is running."

# Movies API
curl -H "X-API-KEY: $PROD_KEY" \
  "$PROD_URL/api/nguonc/phimhay?batch=1" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'OK: {len(d[\"movies\"])} movies from {d[\"source\"]}')
"
```

---

## Alternative: Fly.io Deployment

If Railway doesn't work:

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Deploy from roflix-server directory
cd roflix-server
fly launch --name roflix-server --region sin  # Singapore — closest to VN

# Add persistent volume for SQLite
fly volumes create roflix_data --region sin --size 1

# Set env vars
fly secrets set API_KEY="your-secret-key"
fly secrets set OPHIM_API_URL="https://phim.nguonc.com/api"
fly secrets set DB_PATH="/data/roflix.db"

# Deploy
fly deploy
```

And add to `fly.toml`:
```toml
[mounts]
  source = "roflix_data"
  destination = "/data"
```

---

## Monitoring & Maintenance

### Check logs
```bash
# Railway: via dashboard Logs tab

# Fly.io:
fly logs -a roflix-server
```

### Database backup
```bash
# Fly.io SSH into container
fly ssh console -a roflix-server
# Then:
cp /data/roflix.db /data/roflix.db.backup
```

### Cache management
```bash
# Force clear all cache (if stale data issues)
curl -X DELETE \
  -H "X-API-KEY: $API_KEY" \
  "$PROD_URL/api/cache/clear"
# Note: this endpoint needs to be added to server.js
```

---

## Cost Estimate (Railway)

| Resource | Usage | Cost |
|----------|-------|------|
| RAM | ~30-50 MB | ~$0.50/month |
| CPU | Minimal (cached) | ~$0.20/month |
| Network | <1 GB/month | Free |
| Volume (1GB) | SQLite DB | Free |
| **Total** | | **~$1/month** |

Railway free credit: **$5/month** → well within free tier 🎉

---

## Notes

- Sau khi deploy, update `serverUrl` trong `config.js` và rebuild Tizen app
- Database file (`roflix.db`) cần persistent volume — không có thì mất cache khi redeploy
- Cold start sau khi redeploy ~10s — bình thường
- Nếu Railway sleep (không có cold start với free) thì fallback sang live API fetch
