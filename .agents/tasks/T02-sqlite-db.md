# T02 — Create SQLite Database Layer

**Milestone**: M2  
**Status**: 🔲 TODO  
**Estimate**: 1.5 hours  
**Spec ref**: `.agents/spec.md` §3.5, §4  
**Depends on**: T01

---

## Context

Tạo file `roflix-server/db.js` — database abstraction layer dùng `better-sqlite3`.  
File này expose các functions đơn giản cho server.js sử dụng.

---

## Acceptance Criteria

- [ ] `better-sqlite3` installed
- [ ] Database auto-created tại `DB_PATH` (env var)
- [ ] Tables created on first run
- [ ] All exported functions work correctly
- [ ] `node -e "require('./db')"` runs without error

---

## Steps

### Step 1: Install dependency
```bash
cd roflix-server
npm install better-sqlite3
```

### Step 2: Create `roflix-server/db.js`

```javascript
'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('node:fs');

// --- Config ---
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'roflix.db');
const CACHE_TTL_MOVIES = parseInt(process.env.CACHE_TTL_MOVIES || '3600', 10);     // 1hr
const CACHE_TTL_EPISODES = parseInt(process.env.CACHE_TTL_EPISODES || '7200', 10); // 2hr
const CACHE_TTL_SEARCH = parseInt(process.env.CACHE_TTL_SEARCH || '1800', 10);     // 30min

// --- Init ---
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');  // Better concurrent reads

// --- Schema ---
db.exec(`
  CREATE TABLE IF NOT EXISTS movie_cache (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    original_title TEXT,
    poster_url TEXT,
    thumb_url TEXT,
    description TEXT,
    quality TEXT,
    language TEXT,
    total_episodes INTEGER,
    current_episode TEXT,
    batch INTEGER NOT NULL,
    cached_at INTEGER NOT NULL  -- Unix timestamp
  );

  CREATE TABLE IF NOT EXISTS episode_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_slug TEXT NOT NULL,
    server_name TEXT NOT NULL,
    episode_name TEXT NOT NULL,
    episode_slug TEXT,
    m3u8_url TEXT,
    embed_url TEXT,
    cached_at INTEGER NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_episode_unique
    ON episode_cache(movie_slug, server_name, episode_name);

  CREATE INDEX IF NOT EXISTS idx_episode_slug
    ON episode_cache(movie_slug);

  CREATE TABLE IF NOT EXISTS watch_history (
    movie_slug TEXT NOT NULL,
    episode_name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    duration INTEGER,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (movie_slug, episode_name)
  );
`);

// --- Helpers ---
const now = () => Math.floor(Date.now() / 1_000);

// --- Movie Cache ---

/**
 * Get cached movies for a batch. Returns [] if cache miss or expired.
 * @param {number} batch
 * @returns {object[]}
 */
function getMoviesCache(batch) {
  const cutoff = now() - CACHE_TTL_MOVIES;
  return db.prepare(
    `SELECT * FROM movie_cache
     WHERE batch = ? AND cached_at > ?
     ORDER BY rowid ASC`
  ).all(batch, cutoff);
}

/**
 * Save movies to cache (UPSERT).
 * @param {object[]} movies - Array of movie objects from NguonC API
 * @param {number} batch
 */
function cacheMovies(movies, batch) {
  const insert = db.prepare(`
    INSERT INTO movie_cache
      (slug, title, original_title, poster_url, thumb_url, description,
       quality, language, total_episodes, current_episode, batch, cached_at)
    VALUES
      (@slug, @title, @original_title, @poster_url, @thumb_url, @description,
       @quality, @language, @total_episodes, @current_episode, @batch, @cached_at)
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      original_title = excluded.original_title,
      poster_url = excluded.poster_url,
      thumb_url = excluded.thumb_url,
      description = excluded.description,
      quality = excluded.quality,
      language = excluded.language,
      total_episodes = excluded.total_episodes,
      current_episode = excluded.current_episode,
      batch = excluded.batch,
      cached_at = excluded.cached_at
  `);

  const ts = now();
  const insertMany = db.transaction((items) => {
    for (const movie of items) {
      insert.run({
        slug: movie.slug,
        title: movie.name || movie.title,
        original_title: movie.original_name || movie.original_title || null,
        poster_url: movie.poster_url || null,
        thumb_url: movie.thumb_url || null,
        description: movie.description || null,
        quality: movie.quality || null,
        language: movie.language || null,
        total_episodes: movie.total_episodes || null,
        current_episode: movie.current_episode || null,
        batch,
        cached_at: ts,
      });
    }
  });

  insertMany(movies);
  console.log(`[DB] Cached ${movies.length} movies for batch ${batch}`);
}

// --- Episode Cache ---

/**
 * Get cached episodes for a movie. Returns null if cache miss or expired.
 * @param {string} movieSlug
 * @returns {{ servers: object[] } | null}
 */
function getEpisodeCache(movieSlug) {
  const cutoff = now() - CACHE_TTL_EPISODES;
  const rows = db.prepare(
    `SELECT * FROM episode_cache
     WHERE movie_slug = ? AND cached_at > ?`
  ).all(movieSlug, cutoff);

  if (rows.length === 0) return null;

  // Group by server_name
  const serverMap = new Map();
  for (const row of rows) {
    if (!serverMap.has(row.server_name)) {
      serverMap.set(row.server_name, []);
    }
    serverMap.get(row.server_name).push({
      name: row.episode_name,
      slug: row.episode_slug,
      m3u8: row.m3u8_url,
      embed: row.embed_url,
    });
  }

  return Array.from(serverMap.entries()).map(([server_name, items]) => ({
    server_name,
    items,
  }));
}

/**
 * Save episodes to cache.
 * @param {string} movieSlug
 * @param {object[]} episodeServers - Array of { server_name, items[] }
 */
function cacheEpisodes(movieSlug, episodeServers) {
  const insert = db.prepare(`
    INSERT INTO episode_cache
      (movie_slug, server_name, episode_name, episode_slug, m3u8_url, embed_url, cached_at)
    VALUES
      (@movie_slug, @server_name, @episode_name, @episode_slug, @m3u8_url, @embed_url, @cached_at)
    ON CONFLICT(movie_slug, server_name, episode_name) DO UPDATE SET
      episode_slug = excluded.episode_slug,
      m3u8_url = excluded.m3u8_url,
      embed_url = excluded.embed_url,
      cached_at = excluded.cached_at
  `);

  const ts = now();
  const insertMany = db.transaction((servers) => {
    for (const server of servers) {
      for (const ep of server.items || []) {
        insert.run({
          movie_slug: movieSlug,
          server_name: server.server_name,
          episode_name: ep.name,
          episode_slug: ep.slug || null,
          m3u8_url: ep.m3u8 || null,
          embed_url: ep.embed || null,
          cached_at: ts,
        });
      }
    }
  });

  insertMany(episodeServers);
  console.log(`[DB] Cached episodes for ${movieSlug}`);
}

// --- Watch History ---

/**
 * Save or update watch position.
 * @param {string} movieSlug
 * @param {string} episodeName
 * @param {number} position - seconds
 * @param {number|null} duration - total duration in seconds
 */
function saveWatchPosition(movieSlug, episodeName, position, duration = null) {
  db.prepare(`
    INSERT INTO watch_history (movie_slug, episode_name, position, duration, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(movie_slug, episode_name) DO UPDATE SET
      position = excluded.position,
      duration = COALESCE(excluded.duration, duration),
      updated_at = excluded.updated_at
  `).run(movieSlug, episodeName, position, duration, now());
}

/**
 * Get saved watch position.
 * @param {string} movieSlug
 * @param {string} episodeName
 * @returns {{ position: number, duration: number | null } | null}
 */
function getWatchPosition(movieSlug, episodeName) {
  const row = db.prepare(
    `SELECT position, duration FROM watch_history
     WHERE movie_slug = ? AND episode_name = ?`
  ).get(movieSlug, episodeName);
  return row ?? null;
}

/**
 * Get all watch history (for future "Continue Watching" grid).
 * @returns {object[]}
 */
function getAllWatchHistory() {
  return db.prepare(
    `SELECT * FROM watch_history ORDER BY updated_at DESC LIMIT 50`
  ).all();
}

// --- Exports ---
module.exports = {
  getMoviesCache,
  cacheMovies,
  getEpisodeCache,
  cacheEpisodes,
  saveWatchPosition,
  getWatchPosition,
  getAllWatchHistory,
};
```

### Step 3: Add env vars to `.env`
```bash
DB_PATH=./data/roflix.db
CACHE_TTL_MOVIES=3600
CACHE_TTL_EPISODES=7200
CACHE_TTL_SEARCH=1800
```

### Step 4: Add `data/` to `.gitignore`
```
# SQLite database
roflix-server/data/
```

### Step 5: Verify
```bash
cd roflix-server
node -e "
  const db = require('./db');
  db.cacheMovies([{slug:'test', name:'Test Movie', batch:1}], 1);
  console.log('Cache movies:', db.getMoviesCache(1).length);
  db.saveWatchPosition('test', 'Tap 1', 120, 1800);
  console.log('Watch pos:', db.getWatchPosition('test', 'Tap 1'));
  console.log('All good!');
"
```

---

## Notes

- `better-sqlite3` is **synchronous** — no async/await needed in db.js
- WAL mode prevents read/write locking issues
- All timestamps stored as Unix seconds (not ISO strings) for efficient comparison
- UPSERT pattern (ON CONFLICT) handles re-caching gracefully
