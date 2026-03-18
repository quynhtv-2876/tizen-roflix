# RoFlix — GitHub Copilot Custom Instructions

## Project Overview

**RoFlix** is a Samsung Smart TV application (Tizen Web App) that streams movies from external APIs. The project consists of two parts:

1. **`roflix/`** — Tizen TV Client (HTML5/CSS3/Vanilla JavaScript, single `index.html` SPA)
2. **`roflix-server/`** — Node.js backend (Express.js, API proxy, HLS streaming proxy)

## Repository Structure

```
phimhay/
├── roflix/                  # Tizen TV Client (Vanilla JS SPA)
│   ├── index.html           # Main app — all UI + JS in one file
│   ├── config.js            # Client config (server URL, API key)
│   ├── config.xml           # Tizen app manifest
│   └── css/style.css        # Optional external styles
├── roflix-server/           # Node.js Backend
│   ├── server.js            # Express server (all routes)
│   ├── package.json
│   ├── .env                 # Environment variables (gitignored)
│   └── Dockerfile
├── stocks/                  # Reference docs & specs
│   ├── TIZEN_TV_APP_INSTRUCTION.md
│   ├── NGUONC_API_REFERENCE.md
│   └── implementation_plan.md
└── .agents/                 # SDD (Spec-Driven Development) artifacts
    ├── spec.md              # Product specification
    ├── plan.md              # Implementation plan
    └── tasks/               # Task files per feature
```

## Technology Stack

### Client (roflix/)
- **Platform**: Tizen Web App (TV, OS 6.5)
- **Language**: Vanilla JavaScript (ES6+), no frameworks
- **Video**: Native HTML5 Video (TV) + HLS.js (simulator/browser)
- **Navigation**: D-pad remote (arrow keys + Enter + Back)
- **Target resolution**: 1920×1080 Full HD

### Server (roflix-server/)
- **Runtime**: Node.js 22
- **Framework**: Express.js 5.x
- **HTTP client**: Axios
- **HTML parsing**: Cheerio
- **Environment**: dotenv

## Coding Conventions

### General
- Use `async/await` over raw Promises
- Handle errors with `try/catch` and return standard JSON error responses
- Log with `console.log` using prefixes: `[NGUONC]`, `[PROXY]`, `[DB]`, etc.

### Server (server.js)
- Group routes by feature using Express Router (`express.Router()`)
- All API routes are prefixed with `/api/`
- Authentication via `X-API-KEY` header middleware
- Standard error response shape:
  ```json
  { "message": "Human readable error", "error": "Technical details" }
  ```

### Client (index.html)
- All state is in global `let` variables at the top of the script
- Navigation uses a single `keydown` event listener that dispatches by `currentView`
- Views: `sourceSelection` → `grid` → `details` → `player` (or `search`)
- Focus management: add/remove `.focused` CSS class
- API calls via `fetchApi(path, params)` helper

### Environment Variables (.env)
```bash
API_KEY=ROFLIX_SUPER_SECRET_KEY_123
PORT=3000
OPHIM_API_URL=https://phim.nguonc.com/api
```

## Key Architectural Decisions

1. **HLS Proxy**: The server proxies all video segments to add required `Referer` headers (CDN hotlink protection). The TV cannot set custom headers directly.
2. **Batch Loading**: Movies are loaded in batches of 3 API pages fetched in parallel using `Promise.all()` for performance.
3. **Single HTML file**: The Tizen app uses a single `index.html` to minimize packaging complexity.
4. **No TypeScript on client**: Tizen web apps don't support TypeScript compilation — plain JS only.

## Agent Behavior Guidelines

- When modifying `server.js`, keep all routes within that single file (no splitting yet).
- When modifying `index.html`, respect the existing view/state model — don't introduce new frameworks.
- Always check `.agents/spec.md` before implementing features to ensure alignment with product requirements.
- Always check `.agents/tasks/` to find the relevant task file before starting work.
- Reference `stocks/TIZEN_TV_APP_INSTRUCTION.md` for detailed technical docs.
- Reference `stocks/NGUONC_API_REFERENCE.md` for external API structure.
