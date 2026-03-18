# RoFlix - Smart TV Movie Streamer

RoFlix is a personal movie streaming application designed specifically for Samsung Smart TVs (Tizen OS), featuring a clean, responsive interface controlled entirely by the TV remote. 

It consists of two parts:
1. **`roflix`**: The frontend Tizen Web Application (Vanilla JS, HTML, CSS).
2. **`roflix-server`**: A Node.js backend acting as an API gateway, HLS proxy, and metadata cache.

> **Disclaimer**: This project is built for educational/personal use. It fetches public metadata and proxies streams from third-party APIs (NguonC). We do not host any video content.

---

## 🏗️ Architecture

```
Samsung TV (Tizen App)
        │
        │  HTTP API (Secured via X-API-KEY)
        ▼
Node.js Server (Express)
        │
        ├── SQLite (Metadata cache & watch history)
        │
        └── HLS Proxy ──► Video CDN (stream-through)
                │
                └── NguonC External API
```

### Why a backend proxy?
Smart TVs have strict Cross-Origin Resource Sharing (CORS) and Referrer checks. The Node.js server proxies HLS playlists (`.m3u8`) and video segments to inject correct `Referer` headers, allowing the TV's native player to stream content seamlessly.

---

## ✨ Features

- **Fast Metadata Cache**: Uses `better-sqlite3` to cache movie lists and episode data, reducing API load and delivering sub-second load times.
- **Continue Watching**: Saves playback position every 10 seconds locally. Prompts to resume where you left off.
- **Native Playback**: Utilizes Samsung's native HTML5 video player for HLS streams (using `hls.js` only as a fallback for browser simulators).
- **D-Pad Navigation**: Fully optimized for TV remote controls (Arrows, OK/Enter, Return/Back).
- **Lightweight**: Minimal dependencies. No heavy frontend frameworks.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6)
- **Backend**: Node.js 22, Express.js
- **Database**: SQLite (`better-sqlite3`) for local caching
- **HTTP Client/Proxy**: Axios

---

## 🚀 Setup Instructions

### 1. Backend Server Setup

The server needs to run continuously to serve the TV.

1. Navigate to the server folder:
   ```bash
   cd roflix-server
   npm install
   ```

2. Setup Environment Variables:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and configure:
   - `API_KEY`: Generate a strong, random password. This secures your endpoints.
   - `PORT`: Default is 3000.

3. Start the server:
   ```bash
   npm start
   ```

### 2. Frontend Tizen App Setup

1. Open `roflix/config.js` and update the configuration:
   ```javascript
   const config = {
       // Replace with your server's IP (e.g., http://192.168.1.100:3000)
       serverUrl: 'http://localhost:3000',
       
       // Replace with Base64 encoded version of your API_KEY from the .env file
       // You can encode it in JS using: btoa('YOUR_API_KEY')
       encodedApiKey: 'CHANGE_ME_BASE64_ENCODED_API_KEY',
   };
   ```

2. Build and Deploy to TV:
   - Using Tizen Studio, create a new Basic Web Project.
   - Copy the contents of the `roflix/` folder into the project workspace.
   - Enable Developer Mode on your Samsung TV.
   - Connect via Device Manager.
   - Build and run the app on your TV `roflix.wgt`.

---

## 🔐 Security Notice

Do **NOT** commit your `.env` file or any Tizen signing certificates (`*.p12`, `*.pwd`) to public repositories. The provided `.gitignore` is pre-configured to ignore these sensitive files.

**Local Testing**: Ensure your backend `API_KEY` and frontend `encodedApiKey` match. Avoid setting simple passwords if deploying the server to the public cloud.

---

## ☁️ Deployment (Cloud)

If you don't want to run the server on your local PC, you can host the Node.js backend on a cloud service like [Railway](https://railway.app) or [Fly.io](https://fly.io).

1. Deploy the `roflix-server` folder.
2. Set Environment Variables (`API_KEY`, etc.) in your hosting dashboard.
3. Configure a Persistent Volume mounted at `/app/data` to keep the SQLite database (cache & watch history) across restarts.
4. Update `roflix/config.js` with your new public cloud URL.
