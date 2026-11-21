import { config } from '../config'
import {
  isChatResponse,
  isHealth,
  isSessionHistory,
  type ChatRequest,
  type ChatResponse,
  type HealthResponse,
  type SessionHistoryResponse,
} from './types'

export type ApiErrorKind =
  | 'validation' // 422
  | 'unavailable' // 503
  | 'not_found' // 404
  | 'server' // other 5xx / 4xx
  | 'network' // fetch rejected (backend down, CORS, DNS)
  | 'timeout'
  | 'unexpected' // 2xx with a payload that doesn't match the contract

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null
  readonly title: string

  constructor(kind: ApiErrorKind, title: string, message: string, status: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.title = title
    this.status = status
  }
}

const MAX_DETAIL_CHARS = 300

function clip(text: string): string {
  return text.length > MAX_DETAIL_CHARS ? `${text.slice(0, MAX_DETAIL_CHARS)}…` : text
}

/** FastAPI 422 detail → one readable line per problem ("message: must not be empty"). */
export function describeValidationDetail(detail: unknown): string {
  if (typeof detail === 'string') return clip(detail)
  if (!Array.isArray(detail)) return 'The request was not valid.'
  const lines = detail.map((item) => {
    if (typeof item !== 'object' || item === null) return String(item)
    const { loc, msg } = item as { loc?: unknown; msg?: unknown }
    const field = Array.isArray(loc) ? loc.filter((p) => p !== 'body').join('.') : ''
    const text = typeof msg === 'string' ? msg.replace(/^Value error, /, '') : 'invalid value'
    return field ? `${field}: ${text}` : text
  })
  return clip(lines.join('; ') || 'The request was not valid.')
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

function errorFor(status: number, body: unknown): ApiError {
  const detail = typeof body === 'object' && body !== null ? (body as { detail?: unknown }).detail : undefined
  if (status === 422) {
    return new ApiError('validation', 'Message not accepted', describeValidationDetail(detail), 422)
  }
  if (status === 503) {
    const text = typeof detail === 'string' ? detail : 'service unavailable'
    return new ApiError(
      'unavailable',
      'All providers unavailable',
      text === 'all providers unavailable'
        ? 'Every API key failed for this request (rate limit, quota or server error). Nothing was saved. Retry in a moment.'
        : `The service is unavailable: ${clip(text)}.`,
      503,
    )
  }
  if (status === 404) {
    return new ApiError(
      'not_found',
      'Not found',
      typeof detail === 'string' ? clip(detail) : 'The requested item does not exist.',
      404,
    )
  }
  return new ApiError(
    'server',
    `Server error (${status})`,
    typeof detail === 'string' ? clip(detail) : 'The server could not complete the request.',
    status,
  )
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

async function request<T>(
  path: string,
  guard: (v: unknown) => v is T,
  { method = 'GET', body, headers = {}, signal }: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort('timeout'), config.requestTimeoutMs)
  const onAbort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', onAbort)

  let response: Response
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch {
    if (controller.signal.aborted && controller.signal.reason === 'timeout') {
      throw new ApiError('timeout', 'Request timed out', 'The server took too long to answer. Retry in a moment.')
    }
    throw new ApiError(
      'network',
      'Cannot reach the server',
      `The Lyftr API at ${config.apiBaseUrl} did not respond. Check that the backend is running and reachable.`,
    )
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }

  const payload = await readJson(response)
  if (!response.ok) throw errorFor(response.status, payload)
  if (!guard(payload)) {
    throw new ApiError(
      'unexpected',
      'Unexpected response',
      'The server answered with data the app does not recognise.',
      response.status,
    )
  }
  return payload
}

export interface SendOptions {
  simulateFailure?: string | null
  signal?: AbortSignal
}

export const api = {
  health: (signal?: AbortSignal): Promise<HealthResponse> => request('/health', isHealth, { signal }),

  /** Sends only the new message; the backend owns the conversation history. */
  chat: (payload: ChatRequest, { simulateFailure, signal }: SendOptions = {}): Promise<ChatResponse> =>
    request('/chat', isChatResponse, {
      method: 'POST',
      body: payload,
      headers: simulateFailure ? { 'X-Simulate-Failure': simulateFailure } : {},
      signal,
    }),

  history: (sessionId: string, signal?: AbortSignal): Promise<SessionHistoryResponse> =>
    request(`/sessions/${encodeURIComponent(sessionId)}/messages`, isSessionHistory, { signal }),
}
