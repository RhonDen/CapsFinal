## ✅ All Fixes Applied

## 1. ✅ Fix Delete Blocked Dates (BlockDates.jsx)
- Changed `item._id` → `item.id` in key prop and handleDelete call ✅

## 2. ✅ Fix Logout (AdminPageShell.jsx)
- Already using `api` from `../../api.js` with `withCredentials: true` ✅

## 3. ✅ Fix Logout (Navbar.jsx)
- Already using `api` from `../api.js` with `withCredentials: true` ✅

## 4. ✅ Fix Logout Cookie (server/routes/admin.js)
- Added `const isProd = process.env.NODE_ENV === 'production';`
- Added `path: '/'` to clearCookie
- Set `secure: isProd, sameSite: isProd ? 'none' : 'lax'` matching login settings ✅

---

## Pending Fixes

## 5. ✅ Fix Admin Login & Vercel Deployment
- **Root Cause**: `client/src/api.js` hardcodes `https://capsfinal.onrender.com` as default API URL. Local dev bypasses Vite proxy and calls Render directly. If Render is down, login fails. Same issue on Vercel.
- [x] `client/src/api.js` — Changed default `BASE_URL` from `'https://capsfinal.onrender.com'` to `''` so local dev uses Vite proxy
- [x] `vercel.json` — Added API proxy rewrites for `/api/*` → `https://capsfinal.onrender.com`
- [ ] **Vercel Dashboard** — Set `VITE_API_BASE_URL=https://capsfinal.onrender.com` as environment variable (required for production)

## 6. ⬜ Fix Inbox.jsx — `_id` → `id` bug
- Inbox component still uses MongoDB `_id` references but backend uses SQLite numeric `id`
