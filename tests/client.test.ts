import { describe, expect, it, vi } from 'vitest'
import { ApiError, api, describeValidationDetail } from '../src/api/client'
import { isChatResponse } from '../src/api/types'
import { chatOk, mockBackend } from './mockBackend'

describe('api client', () => {
  it('uses the configured base URL and JSON headers', async () => {
    const backend = mockBackend()
    await api.chat({ session_id: 's-1', message: 'hi' })
    const url = String(backend.fetchMock.mock.calls[0]?.[0])
    expect(url).toBe('http://api.test/chat')
    expect(backend.calls[0]?.headers['Content-Type']).toBe('application/json')
  })

  it('URL-encodes session ids in the history path', async () => {
    const backend = mockBackend({ onHistory: () => ({ status: 200, body: { session_id: 'a b/c', messages: [] } }) })
    await api.history('a b/c')
    expect(String(backend.fetchMock.mock.calls[0]?.[0])).toBe('http://api.test/sessions/a%20b%2Fc/messages')
  })

  it('maps 404 to not_found with the backend detail', async () => {
    mockBackend()
    await expect(api.history('nope')).rejects.toMatchObject({ kind: 'not_found', status: 404, message: 'session not found' })
  })

  it('maps 503 and 422', async () => {
    mockBackend({ onChat: () => ({ status: 503, body: { detail: 'all providers unavailable' } }) })
    await expect(api.chat({ session_id: 's', message: 'x' })).rejects.toMatchObject({ kind: 'unavailable', status: 503 })
    mockBackend({ onChat: () => ({ status: 422, body: { detail: [{ loc: ['body', 'session_id'], msg: 'Field required' }] } }) })
    await expect(api.chat({ session_id: 's', message: 'x' })).rejects.toMatchObject({
      kind: 'validation',
      message: 'session_id: Field required',
    })
  })

  it('maps a non-JSON error page to a server error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })))
    const err = await api.chat({ session_id: 's', message: 'x' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ kind: 'server', status: 502 })
    expect((err as ApiError).message).not.toContain('<html>')
  })

  it('maps fetch rejection to network', async () => {
    mockBackend({ onChat: () => 'network-error' })
    await expect(api.chat({ session_id: 's', message: 'x' })).rejects.toMatchObject({ kind: 'network' })
  })

  it('times out long requests', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_: unknown, init: RequestInit) =>
          new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
      ),
    )
    const p = api.chat({ session_id: 's', message: 'x' }).catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(60_001)
    expect(await p).toMatchObject({ kind: 'timeout' })
    vi.useRealTimers()
  })

  it('only sends X-Simulate-Failure when a scenario is given', async () => {
    const backend = mockBackend()
    await api.chat({ session_id: 's', message: 'x' }, { simulateFailure: '*=429' })
    await api.chat({ session_id: 's', message: 'y' }, { simulateFailure: null })
    expect(backend.calls[0]?.headers['X-Simulate-Failure']).toBe('*=429')
    expect(backend.calls[1]?.headers['X-Simulate-Failure']).toBeUndefined()
  })
})

describe('describeValidationDetail', () => {
  it('flattens FastAPI errors into one line', () => {
    expect(
      describeValidationDetail([
        { loc: ['body', 'message'], msg: 'Value error, message must not be empty' },
        { loc: ['body', 'session_id'], msg: 'String should have at most 128 characters' },
      ]),
    ).toBe('message: message must not be empty; session_id: String should have at most 128 characters')
  })

  it('handles strings, garbage and long details', () => {
    expect(describeValidationDetail('bad')).toBe('bad')
    expect(describeValidationDetail(undefined)).toBe('The request was not valid.')
    expect(describeValidationDetail('x'.repeat(500)).length).toBeLessThanOrEqual(301)
  })
})

describe('response guard', () => {
  it('accepts the contract shape and rejects deviations', () => {
    const ok = chatOk('s', 'Paris.').body
    expect(isChatResponse(ok)).toBe(true)
    expect(isChatResponse({ ...ok, reply: '' })).toBe(false)
    expect(isChatResponse({ ...ok, metadata: { ...ok.metadata, latency_ms: 81.2 } })).toBe(false)
    expect(isChatResponse({ ...ok, metadata: { ...ok.metadata, resolution_source: 'CACHE' } })).toBe(false)
    expect(isChatResponse({ ...ok, metadata: { ...ok.metadata, key_id: null } })).toBe(true)
  })
})
