# Lyftr frontend — deploy on Render

React 19 + Vite + TypeScript + Tailwind single-page app. It calls the Lyftr backend from the
browser, so the backend URL must be public (`https://<backend>.onrender.com`).

## Option A — Blueprint (recommended)
1. Deploy the backend first and copy its URL.
2. Push this folder to its own GitHub repository.
3. Render → **New → Blueprint** → pick the repo. When prompted, set
   `VITE_API_BASE_URL=https://<backend>.onrender.com` (no trailing slash).
4. After the site is live, set the backend's `ALLOWED_ORIGINS` to this site's exact URL
   (`https://<frontend>.onrender.com`) and let the backend redeploy — otherwise the browser
   blocks requests (CORS).

## Option B — Dashboard
New → **Static Site** → repo →
- Build Command: `npm ci && npm run build`
- Publish Directory: `dist`
- Environment: `VITE_API_BASE_URL`, `VITE_ENABLE_SIMULATION_PANEL=true`, `NODE_VERSION=22`
- Redirects/Rewrites: source `/*` → destination `/index.html`, action **Rewrite**

## Notes
- `VITE_*` values are baked in at build time: changing the backend URL needs a redeploy
  ("Clear build cache & deploy").
- `public/env.js` is an empty placeholder here, so the build-time values are used. (The
  `Dockerfile` variant instead writes `env.js` at container start — for Docker hosting.)
- The failure-simulation panel appears only when `VITE_ENABLE_SIMULATION_PANEL=true` **and** the
  backend's `/health` reports `failure_simulation_enabled: true`.

## Run locally
```bash
npm ci
cp .env.example .env.local   # point VITE_API_BASE_URL at your backend
npm run dev                   # http://localhost:3000
npm test && npm run build
```
