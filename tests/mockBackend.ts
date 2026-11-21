import { vi } from 'vitest'
import type { ChatMetadata } from '../src/api/types'

export interface RecordedCall {
  method: string
  path: string
  headers: Record<string, string>
  body: unknown
}

type Reply = { status: number; body: unknown } | 'network-error' | Promise<{ status: number; body: unknown }>
type Handler = (call: RecordedCall) => Reply

export const HEALTH_OK = {
  status: 'ok',
  keys_configured: 2,
  cache_enabled: true,
  cache_type: 'local',
  keys_unique: 2,
  keys_healthy: 2,
  failure_simulation_enabled: true,
  database: 'ok',
  model: 'gemini/gemini-2.0-flash',
}

export function meta(overrides: Partial<ChatMetadata> = {}): ChatMetadata {
  return {
    resolution_source: 'LIVE_INFERENCE',
    model: 'gemini/gemini-2.0-flash',
    latency_ms: 812,
    input_tokens: 42,
    output_tokens: 9,
    key_id: 'key_1',
    fallback_attempts: 0,
    attempts: [],
    ...overrides,
  }
}

export function chatOk(sessionId: string, reply: string, m: Partial<ChatMetadata> = {}) {
  return { status: 200, body: { session_id: sessionId, reply, metadata: meta(m) } }
}

/**
 * Stubs global fetch. Chat requests are answered by `onChat` (default: echo with live meta),
 * history by `onHistory`, health by `health`. Every call is recorded.
 */
export function mockBackend(opts: { onChat?: Handler; onHistory?: Handler; health?: Reply } = {}) {
  const calls: RecordedCall[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const headers = Object.fromEntries(Object.entries((init.headers as Record<string, string>) ?? {}))
    const call: RecordedCall = {
      method: init.method ?? 'GET',
      path: url.pathname,
      headers,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    }
    calls.push(call)

    let reply: Reply
    if (call.path === '/health') reply = opts.health ?? { status: 200, body: HEALTH_OK }
    else if (call.path === '/chat') {
      const b = call.body as { session_id: string; message: string }
      reply = opts.onChat ? opts.onChat(call) : chatOk(b.session_id, `Answer to: ${b.message}`)
    } else if (call.path.startsWith('/sessions/')) {
      reply = opts.onHistory ? opts.onHistory(call) : { status: 404, body: { detail: 'session not found' } }
    } else reply = { status: 404, body: { detail: 'Not Found' } }

    const resolved = await reply
    if (resolved === 'network-error') throw new TypeError('Failed to fetch')
    return new Response(JSON.stringify(resolved.body), {
      status: resolved.status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return {
    calls,
    fetchMock,
    chatCalls: () => calls.filter((c) => c.path === '/chat'),
    historyCalls: () => calls.filter((c) => c.path.startsWith('/sessions/')),
  }
}

/** A promise you resolve later — used to hold a request open (loading state). */
export function deferred<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}
