# Lyftr Frontend

React 19, TypeScript, Vite, and Tailwind frontend for the Lyftr chat app. The interface supports multi-turn chats, per-reply model and token metadata, optional system prompts, and provider-failure simulation controls.

## Live app

- Frontend: https://test-frontend-plum-seven.vercel.app
- Backend: https://test-backend-pao2.onrender.com
- Backend health: https://test-backend-pao2.onrender.com/health

## Run locally

Requires Node.js 22 or newer.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. By default the frontend calls the backend at `http://localhost:8000`; set `VITE_API_BASE_URL` in `.env.local` to use a different API base URL.

## Configuration

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Backend base URL at build time. Use `/api` on Vercel to send requests through its same-origin proxy. |
| `VITE_ENABLE_SIMULATION_PANEL` | Enables the failure-simulation controls when the backend also enables them. |
| `LYFTR_BACKEND_URL` | Backend origin for the Vercel server-side API proxy. Set this in Vercel; it is not a browser variable. |
| `API_BASE_URL` | Runtime API URL for the Docker/nginx deployment. |
| `ENABLE_SIMULATION_PANEL` | Runtime flag for the Docker deployment's simulation controls. |

Never put provider API keys in frontend environment variables. They belong in the backend environment only.

## Scripts

```bash
npm test        # frontend unit and interaction tests
npm run lint    # ESLint
npm run build   # TypeScript check and production build
npm run preview # serve the production build locally
```

## Deploy

See [DEPLOY.md](./DEPLOY.md) for Vercel, Render Static Site, and Docker deployment steps. For Vercel, set `VITE_API_BASE_URL=/api` and `LYFTR_BACKEND_URL` to the backend origin, then redeploy.
