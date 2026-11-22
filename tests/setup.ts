import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Runtime config (what env.js provides in production) — read by src/config.ts at import.
window.__ENV__ = { API_BASE_URL: 'http://api.test', ENABLE_SIMULATION_PANEL: 'true' }

// jsdom gaps
Element.prototype.scrollIntoView = vi.fn()

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.unstubAllGlobals()
})
