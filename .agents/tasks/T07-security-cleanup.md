# T07 — Security Cleanup & Public Repo Preparation

**Status**: 🔲 TODO  
**Estimate**: 30 minutes  
**Priority**: HIGH — Do this BEFORE `git push`

---

## Context

Khi public repo, cần đảm bảo không có credentials, API keys, hoặc file signing certificate bị lộ.

---

## Acceptance Criteria

- [ ] `.gitignore` bảo vệ đúng tất cả file nhạy cảm
- [ ] `roflix/config.js` KHÔNG chứa API key thật
- [ ] `roflix-server/.env` KHÔNG được track bởi git
- [ ] Không có file `.p12`, `.pfx`, signing certs nào trong repo
- [ ] `git status` không show các file nhạy cảm

---

## Sensitive Files Inventory

| File | Risk | Action |
|------|------|--------|
| `roflix-server/.env` | **CRITICAL** — chứa API_KEY | Gitignored ✅ |
| `roflix/config.js` | **HIGH** — chứa encoded API key | Đã sanitize ✅ |
| `roflix-server/.env.example` | LOW — chỉ là template | Safe — commit ✅ |
| `.metadata/` | MEDIUM — IDE workspace data | Gitignored ✅ |
| `roflix/.project` | LOW — Eclipse project file | OK to commit |
| `roflix/.tproject` | LOW — Tizen project file | OK to commit |
| `roflix/roflix.wgt` | LOW — compiled artifact | Gitignored ✅ |
| `*.bin` (Tizen Studio installers) | LOW — large binaries | Gitignored ✅ |
| Signing certs (`*.p12`, `*.pfx`) | **CRITICAL** | Gitignored ✅ |

---

## Steps

### Step 1: Verify .gitignore is working

```bash
cd /path/to/phimhay

# Check .gitignore exists at root
cat .gitignore | grep "\.env"

# Simulate what git would track
git status --short

# Ensure these do NOT appear in git status:
# - roflix-server/.env
# - .metadata/
# - *.wgt files
# - *.bin files
# - Any *.p12 or *.pfx files
```

### Step 2: Check git history for leaked secrets

If this repo has previous commits, check if secrets were ever committed:

```bash
# Search git history for API key patterns
git log --all -p | grep -i "API_KEY\|SECRET\|password\|p12\|pfx" | head -30

# If any real secrets found in history, must rewrite history:
# Option A: Use BFG Repo Cleaner (recommended)
# Option B: git filter-branch (slower)
# See: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
```

### Step 3: Sanitize config.js (already done)

Verify `roflix/config.js` has placeholder value, not real key:

```bash
grep "encodedApiKey" roflix/config.js
# Should show: CHANGE_ME_BASE64_ENCODED_API_KEY
# Should NOT show: Uk9GTElYX1NVUEVSX1NFQ1JFVF9LRVlfMTIz (real encoded key)
```

### Step 4: Add .env.local pattern to server .gitignore

```bash
# Ensure roflix-server/.gitignore has:
cat roflix-server/.gitignore | grep "\.env"
# Should show: .env
# Add if missing: echo ".env.local" >> roflix-server/.gitignore
```

### Step 5: Add security notice to README

```markdown
## ⚠️ Security

Before running this project:
1. Copy `.env.example` to `.env` in `roflix-server/`
2. Set your own `API_KEY` value
3. Update `encodedApiKey` in `roflix/config.js` with `btoa('YOUR_API_KEY')`

**Never commit your `.env` file or Tizen signing certificates.**
```

### Step 6: Final check before push

```bash
# Run this full scan
echo "=== Checking for sensitive patterns ===" && \
grep -r "ROFLIX_SUPER_SECRET" . --include="*.js" --include="*.json" --include="*.md" --include="*.txt" --include="*.env" 2>/dev/null | grep -v node_modules | grep -v ".git" && \
echo "=== Checking for .p12 files ===" && \
find . -name "*.p12" -o -name "*.pfx" -o -name "*.keystore" 2>/dev/null | grep -v ".git" && \
echo "=== Files that WILL be committed ===" && \
git ls-files && \
echo "=== DONE ==="
```

---

## Notes

- Tizen signing certificate (`.p12`) nên lưu ở nơi RIÊNG biệt ngoài repo
- Nếu public repo trên GitHub, enable **Secret scanning** trong repo settings
- Có thể dùng `git-secrets` để prevent future leaks
