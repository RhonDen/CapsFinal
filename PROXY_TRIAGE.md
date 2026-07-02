# Proxy/localhost admin login triage

## What this doc is for
If you see an error like **“invalid admin http proxy error”** when you boot Windows and try the admin login, it’s almost never caused by your backend code. In this repo, the frontend calls admin endpoints via:
- `axios.get('/api/admin/check-auth', { withCredentials: true })`
- `axios.post('/api/admin/login', ...)`

And the Vite dev server proxy is configured at:
- `client/vite.config.js` → `'/api' -> http://localhost:5000`

So a persistent failure on every boot usually means **system/browser proxy settings** or a **proxy-related extension** is intercepting traffic to `localhost`.

## Step 1 (most important): turn off Windows proxy
1. Windows Settings → Network & Internet → Proxy
2. Turn OFF:
   - “Use a proxy server”
   - “Automatically detect settings” (set OFF if enabled)
3. Restart the browser.

## Step 2: disable proxy/VPN/filter extensions
Disable temporarily any extensions related to:
- VPN / proxy
- privacy filtering
- ad-blockers with filtering
- “web security”

Then restart the browser.

## Step 3: test using an Incognito window
Open an Incognito window (extensions disabled if possible), then try:
- `http://localhost:5173/admin/login`

## Step 4: bypass Vite proxy (code test)
As a confirmation test, we can temporarily change admin API calls to:
- `http://localhost:5000/api/admin/...`

This bypasses the Vite `/api` proxy layer. If that works, the issue is definitely in the proxy layer / dev-server routing / or browser proxy interception.

## Step 5: check system proxy variables (quick)
If you want to check environment variables, run:
- `node -e "console.log(process.env.HTTP_PROXY, process.env.HTTPS_PROXY, process.env.NO_PROXY)"`

In this project, we previously confirmed they were not set.

---

