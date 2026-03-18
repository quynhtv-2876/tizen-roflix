# T04 — Continue Watching Feature

**Milestone**: M3  
**Status**: 🔲 TODO  
**Estimate**: 2-3 hours  
**Spec ref**: `.agents/spec.md` §3.6  
**Depends on**: T02, T03

---

## Context

Implement "Continue Watching" — cho phép user tiếp tục xem dở từ vị trí đã dừng.

Backend đã có endpoints `/watch-position` từ T03.  
Task này tập trung vào **client-side logic** trong `roflix/index.html`.

---

## Acceptance Criteria

- [ ] Vị trí xem được lưu mỗi 10 giây khi đang phát
- [ ] Khi mở lại tập đã xem > 1 phút, hiện prompt "Tiếp tục từ MM:SS?"
- [ ] Nếu chọn "Có": video resume từ vị trí đã lưu
- [ ] Nếu chọn "Không" hoặc bấm Back: video bắt đầu từ đầu
- [ ] Khi tập kết thúc (> 95% thời lượng): xóa watch position

---

## Steps

### Step 1: Add helper functions to `index.html`

Add these JS functions in the `<script>` block, near the API helper section:

```javascript
// ---- Continue Watching Helpers ----

async function saveWatchPosition(slug, episodeName, position, duration) {
    if (!slug || !episodeName || !position || position < 10) return;
    try {
        await fetchApi('/watch-position', null, 'POST', {
            movieSlug: slug,
            episodeName,
            position: Math.floor(position),
            duration: duration ? Math.floor(duration) : null,
        });
    } catch (e) {
        console.warn('[CW] Failed to save position:', e);
    }
}

async function getWatchPosition(slug, episodeName) {
    try {
        const data = await fetchApi(`/watch-position?movieSlug=${encodeURIComponent(slug)}&episodeName=${encodeURIComponent(episodeName)}`);
        return data?.position ?? null;
    } catch (e) {
        console.warn('[CW] Failed to get position:', e);
        return null;
    }
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}
```

### Step 2: Update `fetchApi` to support POST

Check if `fetchApi` already supports POST. If not, update it:

```javascript
async function fetchApi(path, params = {}, method = 'GET', body = null) {
    const url = new URL(`${SERVER_URL}/api/nguonc${path}`);
    if (params && method === 'GET') {
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null) url.searchParams.set(k, v);
        }
    }

    const options = {
        method,
        headers: { 'X-API-KEY': API_KEY },
    };

    if (body && method !== 'GET') {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}
```

### Step 3: Auto-save position every 10 seconds

Add a global interval variable near other global vars at top of script:
```javascript
let watchPositionInterval = null;
```

In the player setup (after video starts playing), add:
```javascript
// Clear any existing interval
if (watchPositionInterval) clearInterval(watchPositionInterval);

// Save position every 10s
watchPositionInterval = setInterval(() => {
    if (currentView === 'player' && activePlayer && !activePlayer.paused) {
        const pos = activePlayer.currentTime;
        const dur = activePlayer.duration;
        if (pos > 10) {
            const episodeName = episodesData[episodeServerIndex].items[episodeIndex].name;
            saveWatchPosition(currentMovieData.slug, episodeName, pos, dur || null);
        }
    }
}, 10_000);
```

When leaving player view (in the back button handler or `stopPlayer()` function):
```javascript
if (watchPositionInterval) {
    clearInterval(watchPositionInterval);
    watchPositionInterval = null;
}
```

### Step 4: Show resume prompt in `playSelectedEpisode`

Find the `playSelectedEpisode` (or similar function) and add at the start:

```javascript
async function playSelectedEpisode() {
    const episode = episodesData[episodeServerIndex].items[episodeIndex];
    
    // Check for saved position
    let resumePosition = null;
    if (currentMovieData?.slug && episode?.name) {
        const saved = await getWatchPosition(currentMovieData.slug, episode.name);
        if (saved && saved > 60) {  // only prompt if > 1 minute
            resumePosition = saved;
        }
    }

    // ... existing code to get videoSrc ...
    const watchData = await fetchApi('/watch', { movieSlug: currentMovieData.slug, episodeName: episode.name });
    const videoSrc = watchData.videoUrl;

    // Setup player (existing code)
    // ...

    // After player is ready, apply resume position
    if (resumePosition) {
        showResumeDialog(resumePosition, () => {
            // User chose to resume
            activePlayer.currentTime = resumePosition;
            activePlayer.play();
        }, () => {
            // User chose to start over
            activePlayer.currentTime = 0;
            activePlayer.play();
        });
    } else {
        activePlayer.play().catch(console.error);
    }
}
```

### Step 5: Add resume dialog UI

Add HTML in the player view section:
```html
<!-- Resume Dialog -->
<div id="resume-dialog" style="display:none; position:absolute; top:50%; left:50%;
     transform:translate(-50%,-50%); background:rgba(0,0,0,0.9); color:#fff;
     padding:30px 40px; border-radius:12px; text-align:center; z-index:100;
     border:2px solid rgba(255,255,255,0.2);">
    <p id="resume-text" style="font-size:1.2rem; margin-bottom:20px;"></p>
    <div style="display:flex; gap:20px; justify-content:center;">
        <button id="resume-yes" class="source-button focused" type="button">▶ Tiếp tục</button>
        <button id="resume-no" class="source-button" type="button">↩ Từ đầu</button>
    </div>
</div>
```

Add JS function:
```javascript
function showResumeDialog(position, onResume, onRestart) {
    const dialog = document.getElementById('resume-dialog');
    document.getElementById('resume-text').textContent =
        `Tiếp tục từ ${formatTime(position)}?`;
    dialog.style.display = 'block';

    let dialogIndex = 0;  // 0 = Yes, 1 = No
    const yesBtn = document.getElementById('resume-yes');
    const noBtn = document.getElementById('resume-no');

    function updateDialogFocus() {
        yesBtn.classList.toggle('focused', dialogIndex === 0);
        noBtn.classList.toggle('focused', dialogIndex === 1);
    }

    function handleDialogKey(e) {
        if (e.keyCode === 37 || e.keyCode === 39) {  // Left / Right
            dialogIndex = dialogIndex === 0 ? 1 : 0;
            updateDialogFocus();
        } else if (e.keyCode === 13) {  // Enter
            dialog.style.display = 'none';
            document.removeEventListener('keydown', handleDialogKey);
            if (dialogIndex === 0) onResume();
            else onRestart();
        } else if (e.keyCode === 10009) {  // Back
            dialog.style.display = 'none';
            document.removeEventListener('keydown', handleDialogKey);
            onRestart();
        }
        e.stopPropagation();
    }

    document.addEventListener('keydown', handleDialogKey);
    updateDialogFocus();
}
```

### Step 6: Clear position on episode end

In the video `ended` event listener:
```javascript
activePlayer.addEventListener('ended', () => {
    // Clear watch position (episode completed)
    const episode = episodesData[episodeServerIndex].items[episodeIndex];
    if (currentMovieData?.slug && episode?.name) {
        saveWatchPosition(currentMovieData.slug, episode.name, 0, null);
    }
    // ... existing next-episode logic ...
});
```

### Step 7: Test

**Manual test**:
1. Open app on TV / simulator
2. Start watching a movie
3. Watch for 2+ minutes
4. Press Back to exit player
5. Navigate back to same movie & episode
6. Verify resume dialog appears with correct time
7. Choose "Tiếp tục" → video starts from saved time ✅
8. Repeat, choose "Từ đầu" → video starts from 0 ✅

---

## Notes

- `showResumeDialog` captures the keydown event — make sure to clean up listeners
- Do not prompt if saved position is < 60 seconds (too little to bother)
- The interval saves every 10s — acceptable precision loss if app crashes
