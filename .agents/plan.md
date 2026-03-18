# RoFlix — Implementation Plan (plan.md)

> **Version**: 2.0  
> **Created**: 2026-03-18  
> **Status**: Ready for execution  
> **Reference Spec**: `.agents/spec.md`  

---

## Overview

This plan breaks the RoFlix v2.0 implementation into 5 sequential phases. Each phase has a clear goal, list of tasks, and done criteria. Tasks are tracked in `.agents/tasks/`.

### Phase Summary

| Phase | Goal | Est. Effort |
|-------|------|-------------|
| [Phase 1](#phase-1-server-cleanup--sqlite-cache) | Server cleanup + SQLite cache | ~4h |
| [Phase 2](#phase-2-watch-history-api) | Watch history API | ~2h |
| [Phase 3](#phase-3-client-refactor--ux-polish) | Client refactor + UX polish | ~4h |
| [Phase 4](#phase-4-continue-watching-feature) | Continue watching feature | ~2h |
| [Phase 5](#phase-5-docker--deployment) | Docker + deployment hardening | ~2h |

**Total estimated effort**: ~14h

---

## Phase 1: Server Cleanup + SQLite Cache

**Goal**: Remove Puppeteer/RoPhim, add SQLite caching for movie lists and episode metadata.

### Rationale
- RoPhim is slow (3–10s/request), unstable, and requires Chromium — costly in RAM and Docker image size.
- SQLite cache reduces NguonC API calls from every request to ~1/hour.

### Tasks
| ID | Task File | Description |
|----|-----------|-------------|
| T1.1 | `tasks/T1.1-remove-rophim.md` | Remove RoPhim router, Puppeteer imports, and Chromium dependencies |
| T1.2 | `tasks/T1.2-sqlite-db-layer.md` | Create `db.js` with SQLite schema and CRUD functions |
| T1.3 | `tasks/T1.3-cache-nguonc-endpoints.md` | Update `/phimhay` and `/details` endpoints to use cache |

### Done Criteria (Phase 1)
- [ ] `npm start` runs without Puppeteer errors
- [ ] `GET /api/nguonc/phimhay?batch=1` returns data < 50ms on 2nd call (from cache)
- [ ] `GET /api/nguonc/details?movieSlug=<slug>` returns data < 50ms on 2nd call
- [ ] Docker image size reduced by > 500MB (no Chromium)
- [ ] All existing endpoints still work

---

## Phase 2: Watch History API

**Goal**: Add server-side watch history — save and retrieve per-episode playback position.

### Tasks
| ID | Task File | Description |
|----|-----------|-------------|
| T2.1 | `tasks/T2.1-watch-history-api.md` | Add `POST/GET /api/nguonc/watch-position` endpoints |

### Done Criteria (Phase 2)
- [ ] `POST /api/nguonc/watch-position` saves position to SQLite
- [ ] `GET /api/nguonc/watch-position?movieSlug=x&episodeName=y` returns `{ position }` or `{ position: 0 }`
- [ ] Data persists across server restarts (SQLite, not in-memory)

---

## Phase 3: Client Refactor + UX Polish

**Goal**: Remove source-selection view, have app launch directly in grid, polish focus states and layout.

### Tasks
| ID | Task File | Description |
|----|-----------|-------------|
| T3.1 | `tasks/T3.1-remove-source-selection.md` | Remove sourceSelection view; grid becomes the entry view |
| T3.2 | `tasks/T3.2-grid-infinite-scroll.md` | Polish infinite scroll: loading spinner, batch boundary |
| T3.3 | `tasks/T3.3-details-view-polish.md` | Improve details view: server tabs, episode list, back nav |

### Done Criteria (Phase 3)
- [ ] App launches directly into grid
- [ ] Back button from grid → exit app (`tizen.application.exit()`)
- [ ] Grid infinite scroll works smoothly (no duplicates, no missed batches)
- [ ] Details view shows server tabs navigable by LEFT/RIGHT

---

## Phase 4: Continue Watching Feature

**Goal**: Save playback position every 10 seconds; prompt user to resume when re-opening an episode.

### Tasks
| ID | Task File | Description |
|----|-----------|-------------|
| T4.1 | `tasks/T4.1-save-watch-position.md` | Auto-save position every 10s during playback |
| T4.2 | `tasks/T4.2-resume-prompt.md` | Show resume dialog when opening a previously watched episode |

### Done Criteria (Phase 4)
- [ ] Position saved every 10s to `POST /api/nguonc/watch-position`
- [ ] On episode open with position > 60s: dialog shown ("Resume from MM:SS?")
- [ ] ENTER on "Yes" → seeks to saved position
- [ ] ENTER on "No" → plays from beginning

---

## Phase 5: Docker + Deployment Hardening

**Goal**: Clean up Dockerfile, add SQLite volume, ensure production-ready deploy.

### Tasks
| ID | Task File | Description |
|----|-----------|-------------|
| T5.1 | `tasks/T5.1-dockerfile-cleanup.md` | Remove Chromium from Dockerfile, add `/app/data` volume |
| T5.2 | `tasks/T5.2-env-documentation.md` | Update `.env.example`, document all env vars |

### Done Criteria (Phase 5)
- [ ] Docker build succeeds in < 5 minutes
- [ ] `docker run` starts server with SQLite working via mounted volume
- [ ] `.env.example` is complete and accurate

---

## Dependency Graph

```
Phase 1 (server cleanup)
    ├── T1.1 (remove rophim) — no deps
    ├── T1.2 (sqlite db.js)  — no deps
    └── T1.3 (cache endpoints) — depends on T1.2
         │
Phase 2 (watch history)
    └── T2.1 — depends on T1.2
         │
Phase 3 (client refactor)
    ├── T3.1 — depends on Phase 1 complete
    ├── T3.2 — depends on T3.1
    └── T3.3 — can run parallel with T3.2
         │
Phase 4 (continue watching)
    ├── T4.1 — depends on T2.1 + T3.3
    └── T4.2 — depends on T4.1
         │
Phase 5 (docker)
    ├── T5.1 — depends on Phase 1 complete
    └── T5.2 — no deps
```

---

## File Change Map

### New Files
| File | Phase | Purpose |
|------|-------|---------|
| `roflix-server/db.js` | Phase 1 | SQLite database layer |
| `roflix-server/data/roflix.db` | Phase 1 | SQLite database (auto-created) |

### Modified Files
| File | Phases | Changes Summary |
|------|--------|-----------------|
| `roflix-server/server.js` | 1, 2 | Remove RoPhim, add cache + watch history |
| `roflix-server/package.json` | 1 | Add `better-sqlite3`, remove `puppeteer-*` |
| `roflix-server/Dockerfile` | 5 | Remove Chromium, add volume |
| `roflix-server/.env.example` | 5 | Update with all vars |
| `roflix/index.html` | 3, 4 | Remove sourceSelection, add resume logic |
| `roflix/config.xml` | 3 | Bump version to 2.0.0 |

---

## Testing Strategy

### Server
```bash
# 1. Unit: SQLite layer
node -e "const db = require('./db'); console.log(db.getMoviesCache(1));"

# 2. Integration: endpoints  
curl -H "X-API-KEY: ROFLIX_SUPER_SECRET_KEY_123" http://localhost:3000/api/nguonc/phimhay?batch=1
curl -H "X-API-KEY: ROFLIX_SUPER_SECRET_KEY_123" http://localhost:3000/api/nguonc/details?movieSlug=avengers

# 3. Watch position
curl -X POST -H "X-API-KEY: ROFLIX_SUPER_SECRET_KEY_123" \
  -H "Content-Type: application/json" \
  -d '{"movieSlug":"test","episodeName":"Tap 1","position":120}' \
  http://localhost:3000/api/nguonc/watch-position

curl -H "X-API-KEY: ROFLIX_SUPER_SECRET_KEY_123" \
  "http://localhost:3000/api/nguonc/watch-position?movieSlug=test&episodeName=Tap+1"
```

### Client (Manual — Tizen Simulator)
1. Build: `cd roflix && tizen build-web`
2. Launch simulator: Tizen Studio → Run as Web Simulator
3. Verify: grid loads, navigation works, episode plays
4. For TV: `tizen install -n roflix.wgt -t <TV_DEVICE_ID>`
