// Mirrors API_SPEC.md / backend/app/schemas. Field names are contractual.

export type ResolutionSource = 'LIVE_INFERENCE' | 'LLM_CACHE'

export interface AttemptInfo {
  key_id: string
  status: number | null
  reason: string
  simulated: boolean
}

export interface ChatMetadata {
  resolution_source: ResolutionSource
  model: string
  latency_ms: number
  input_tokens: number
  output_tokens: number
  key_id: string | null
  fallback_attempts: number
  attempts?: AttemptInfo[] // extra field (bonus)
}

export interface ChatRequest {
  session_id: string
  message: string
  system_prompt?: string
}

export interface ChatResponse {
  session_id: string
  reply: string
  metadata: ChatMetadata
}

/** History metadata may be partial per the spec; render missing fields as unknown. */
export type HistoryMetadata = Partial<ChatMetadata>

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
  created_at?: string
  metadata?: HistoryMetadata
}

export interface SessionHistoryResponse {
  session_id: string
  messages: HistoryMessage[]
}

export interface HealthResponse {
  status: 'ok'
  keys_configured: number
  cache_enabled: boolean
  // extras
  cache_type?: string
  keys_unique?: number
  keys_healthy?: number
  min_keys_required?: number
  failure_simulation_enabled?: boolean
  database?: string
  model?: string
}

// ---- runtime guards (the UI never trusts an unexpected payload) -------------------------
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

export function isChatMetadata(v: unknown): v is ChatMetadata {
  return (
    isObj(v) &&
    (v.resolution_source === 'LIVE_INFERENCE' || v.resolution_source === 'LLM_CACHE') &&
    typeof v.model === 'string' &&
    isInt(v.latency_ms) &&
    isInt(v.input_tokens) &&
    isInt(v.output_tokens) &&
    (v.key_id === null || typeof v.key_id === 'string') &&
    isInt(v.fallback_attempts)
  )
}

export function isChatResponse(v: unknown): v is ChatResponse {
  return (
    isObj(v) &&
    typeof v.session_id === 'string' &&
    typeof v.reply === 'string' &&
    v.reply.length > 0 &&
    isChatMetadata(v.metadata)
  )
}

export function isSessionHistory(v: unknown): v is SessionHistoryResponse {
  return (
    isObj(v) &&
    typeof v.session_id === 'string' &&
    Array.isArray(v.messages) &&
    v.messages.every(
      (m) =>
        isObj(m) &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        (m.metadata === undefined || m.metadata === null || isObj(m.metadata)),
    )
  )
}

export function isHealth(v: unknown): v is HealthResponse {
  return (
    isObj(v) && v.status === 'ok' && isInt(v.keys_configured) && typeof v.cache_enabled === 'boolean'
  )
}
