import { ArrowRight, Check, Database, X } from 'lucide-react'
import type { AttemptInfo, ChatMetadata, HistoryMetadata } from '../api/types'

const REASON_LABEL: Record<string, string> = {
  rate_limit: 'rate limited',
  quota: 'quota exhausted',
  server_error: 'server error',
  timeout: 'timed out',
  connection: 'connection failed',
  auth: 'key rejected',
  request_error: 'request rejected',
  empty_reply: 'empty reply',
  unexpected: 'failed',
}

function FailedHop({ attempt }: { attempt: AttemptInfo }) {
  const reason = REASON_LABEL[attempt.reason] ?? attempt.reason
  return (
    <li className="flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-md bg-fail-soft px-1.5 py-0.5 text-fail">
        <X className="size-3" aria-hidden />
        <span className="font-medium">{attempt.key_id}</span>
        <span className="tabular">{attempt.status ?? ''}</span>
        <span className="text-fail/80">
          {reason}
          {attempt.simulated ? ' (simulated)' : ''}
        </span>
      </span>
      <ArrowRight className="size-3 text-muted" aria-hidden />
    </li>
  )
}

/**
 * How this reply was served — the one place the UI shows Lyftr's resilience:
 * a cache hit, or the keys tried in order until one answered.
 */
export function RouteTrace({ metadata }: { metadata: ChatMetadata | HistoryMetadata }) {
  if (metadata.resolution_source === 'LLM_CACHE') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-cache" data-testid="route-trace">
        <Database className="size-3.5" aria-hidden />
        Served from cache, no provider call
      </p>
    )
  }
  if (!metadata.key_id) return null
  const failed = metadata.attempts ?? []
  return (
    <ol
      className="flex flex-wrap items-center gap-1.5 text-xs"
      aria-label={`Answered by ${metadata.key_id}${failed.length ? ` after ${failed.length} failed key${failed.length > 1 ? 's' : ''}` : ''}`}
      data-testid="route-trace"
    >
      {failed.map((a, i) => (
        <FailedHop key={`${a.key_id}-${i}`} attempt={a} />
      ))}
      <li className="inline-flex items-center gap-1 rounded-md bg-live-soft px-1.5 py-0.5 text-live">
        <Check className="size-3" aria-hidden />
        <span className="font-medium">{metadata.key_id}</span>
        <span>answered</span>
      </li>
    </ol>
  )
}
