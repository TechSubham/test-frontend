declare global {
  interface Window {
    __ENV__?: { API_BASE_URL?: string; ENABLE_SIMULATION_PANEL?: string }
  }
}

const runtime = (typeof window !== 'undefined' && window.__ENV__) || {}

function pick(...values: (string | undefined)[]): string | undefined {
  return values.find((v) => typeof v === 'string' && v.trim() !== '')?.trim()
}

/** Runtime env.js (Docker) wins over build-time VITE_* (Vercel/dev); then the local default. */
export const config = {
  apiBaseUrl: (
    pick(runtime.API_BASE_URL, import.meta.env.VITE_API_BASE_URL) ??
    (import.meta.env.PROD ? '/api' : 'http://localhost:8000')
  ).replace(/\/+$/, ''),
  simulationPanelFlag:
    (pick(runtime.ENABLE_SIMULATION_PANEL, import.meta.env.VITE_ENABLE_SIMULATION_PANEL) ??
      'false') === 'true',
  requestTimeoutMs: 60_000,
  healthPollMs: 30_000,
  messageMaxChars: 4000,
  systemPromptMaxChars: 10_000,
} as const
