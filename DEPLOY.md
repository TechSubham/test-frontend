# Lyftr frontend — deploy on Vercel or Render

React 19 + Vite + TypeScript + Tailwind single-page app. On Vercel, API calls go through a
same-origin serverless proxy so browser privacy filters do not block the Render backend.

## Option A — Vercel (recommended)
1. Deploy the backend first and copy its URL.
2. Push this folder to its own GitHub repository.
3. Import the repo into Vercel and set `VITE_API_BASE_URL=/api` and
   `LYFTR_BACKEND_URL=https://<backend>.onrender.com` in its environment variables.
   `LYFTR_BACKEND_URL` is used only by the serverless proxy and is never exposed to the browser.
4. Redeploy the Vercel site after setting both values. The browser now calls the Vercel origin;
   the Vercel function forwards requests to Render.

## Option B — Render Static Site
Render → **New → Static Site** → repo →
- Build Command: `npm ci && npm run build`
- Publish Directory: `dist`
- Environment: `VITE_API_BASE_URL=https://<backend>.onrender.com`, `NODE_VERSION=22`
- Redirects/Rewrites: source `/*` → destination `/index.html`, action **Rewrite**

## Notes
- `VITE_*` values are baked in at build time: changing the backend URL needs a redeploy
  ("Clear build cache & deploy").
- The Vercel proxy needs `LYFTR_BACKEND_URL` set to the Render backend origin. For other static
  hosts, call the backend directly and allow the static site's origin in backend `ALLOWED_ORIGINS`.
- `public/env.js` is an empty placeholder here, so the build-time values are used. (The
  `Dockerfile` variant instead writes `env.js` at container start — for Docker hosting.)
- The failure-simulation panel appears when the backend's `/health` reports
  `failure_simulation_enabled: true`; backend readiness is the source of truth.

## Run locally
```bash
npm ci
cp .env.example .env.local   # point VITE_API_BASE_URL at your backend
npm run dev                   # http://localhost:3000
npm test && npm run build
```
