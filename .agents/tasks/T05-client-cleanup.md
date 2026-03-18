# T05 — Client Cleanup (Remove Source Selection)

**Milestone**: M4  
**Status**: 🔲 TODO  
**Estimate**: 1 hour  
**Spec ref**: `.agents/spec.md` §7  
**Depends on**: T01

---

## Context

Sau khi bỏ RoPhim, không cần màn hình chọn nguồn nữa.  
App sẽ khởi động thẳng vào Grid View với source cố định là NguonC.

---

## Acceptance Criteria

- [ ] App khởi động thẳng vào grid (không qua source selection)
- [ ] Bấm Back tại grid → thoát app
- [ ] Không còn `source-button` nào trong DOM
- [ ] Không còn `sourceSelection` trong logic handleKeydown
- [ ] `currentSource` là constant `'nguonc'`

---

## Steps

### Step 1: Edit `roflix/index.html`

#### 1a. Remove source selection HTML

Find and DELETE the entire `source-selection-view` div:
```html
<!-- DELETE this entire block: -->
<div id="source-selection-view" class="view active">
    <h1>Chọn Nguồn Phim</h1>
    <div>
        <button class="source-button focused" data-source="nguonc">NguonC</button>
        <button class="source-button" data-source="rophim">RoPhim</button>
    </div>
</div>
```

Make `grid-view` the initially active view:
```html
<!-- CHANGE: add 'active' class to grid-view -->
<div id="grid-view" class="view active">
```

#### 1b. Update JS global variables

Find at top of `<script>`:
```javascript
// CHANGE:
let currentView = 'sourceSelection';
let currentSource = 'nguonc';  // or similar

// TO:
let currentView = 'grid';
const currentSource = 'nguonc';
```

Also find and remove:
```javascript
let sourceButtonIndex = 0;  // DELETE this line
```

#### 1c. Remove source selection from `updateFocus()`

Find in `updateFocus()`:
```javascript
// DELETE this block:
if (currentView === 'sourceSelection') {
    const buttons = views.sourceSelection.querySelectorAll('.source-button');
    buttons[sourceButtonIndex]?.classList.add('focused');
}
```

#### 1d. Remove source selection from `handleKeydown()`

Find and DELETE all of:
```javascript
// DELETE the entire sourceSelection case:
if (currentView === 'sourceSelection') {
    // ... all key handling for source selection ...
}
```

Also find and DELETE the Enter handler for source selection:
```javascript
// DELETE:
if (currentView === 'sourceSelection' && e.keyCode === 13) {
    currentSource = views.sourceSelection
        .querySelectorAll('.source-button')[sourceButtonIndex]
        .dataset.source;
    switchView('grid');
    fetchMovies(true);
}
```

#### 1e. Update Back button at grid

Find the Back handler when at grid view:
```javascript
// CHANGE:
else if (currentView === 'grid') {
    switchView('sourceSelection');
}

// TO:
else if (currentView === 'grid') {
    if (typeof tizen !== 'undefined') {
        tizen.application.getCurrentApplication().exit();
    } else {
        window.close();  // Fallback for simulator
    }
}
```

#### 1f. Update initialization

Find `document.addEventListener('DOMContentLoaded', ...)` or `window.onload`:
```javascript
// CHANGE: Remove source selection init, go straight to grid
// DELETE any: switchView('sourceSelection') or initSourceSelection()

// Make sure initial fetch is called:
fetchMovies(true);
updateFocus();
```

#### 1g. Remove any `rophim` conditional branches

Search for `rophim` in the JS code and remove all:
```javascript
// DELETE any patterns like:
if (currentSource === 'rophim') {
    // ...
} else {
    // ...
}

// Simplify to just the nguonc branch
```

Also remove fetch calls that route to `/rophim/`:
```javascript
// DELETE:
const apiPath = currentSource === 'rophim' ? '/rophim/list' : '/nguonc/phimhay';

// REPLACE WITH:
const apiPath = '/nguonc/phimhay';
```

### Step 2: Remove source button CSS

In `roflix/css/style.css` (or inline styles in index.html), find and DELETE:
```css
/* DELETE: */
#source-selection-view { ... }
.source-button { ... }
.source-button.focused { ... }
.source-button:hover { ... }
```

Keep `.focused` class styles for other focusable elements.

### Step 3: Update `roflix/config.xml`

Bump version:
```xml
<widget version="2.0.0">
    <name>RoFlix</name>
    ...
</widget>
```

### Step 4: Verify

```bash
# Simulator: open index.html in browser
# Should load grid directly, no source selection screen

# Check console for:
# - No errors about 'sourceSelection' view
# - "Fetching movies batch 1..." log
```

**Manual checklist**:
- [ ] App opens → grid shows immediately (no source selection)
- [ ] Movies load correctly
- [ ] Search works
- [ ] Movie details work
- [ ] Video plays
- [ ] Back at grid → app exits (or `window.close()` in browser)

---

## Notes

- The `views.sourceSelection` reference must also be removed from the `views` object:
  ```javascript
  // REMOVE from views object:
  const views = {
      sourceSelection: document.getElementById('source-selection-view'),  // DELETE
      grid: document.getElementById('grid-view'),
      // ...
  };
  ```
- Keep `views` object clean — remove the sourceSelection key entirely
- `switchView('grid')` should set `class="view active"` on grid, remove from others
