import { Check, ChevronDown, Copy, Cpu, Database, Timer, Zap } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import type { ChatMetadata, HistoryMetadata } from '../api/types'
import { formatLatency, rawInt } from '../lib/format'
import { Markdown } from './Markdown'
import { RouteTrace } from './RouteTrace'

interface Props {
  content: string
  metadata: ChatMetadata | HistoryMetadata
}

function SourceBadge({ source }: { source: string | undefined }) {
  const cache = source === 'LLM_CACHE'
  const Icon = cache ? Database : Zap
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.7rem] font-semibold tracking-wide ${
        cache ? 'bg-cache-soft text-cache' : 'bg-live-soft text-live'
      }`}
      title={cache ? 'Answered from the LiteLLM cache' : 'Generated live by the model'}
    >
      <Icon className="size-3" aria-hidden />
      <span data-testid="meta-source">{source ?? '—'}</span>
    </span>
  )
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function AssistantMessage({ content, metadata }: Props) {
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)
  const detailsId = useId()

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(t)
  }, [copied])

  return (
    <article
      data-testid="assistant-message"
      className="rounded-[20px] border border-[#eff0f5] bg-white px-4 py-4 shadow-[0_5px_18px_rgba(45,47,70,0.035)] sm:px-5"
      aria-label="Assistant reply"
    >
      <Markdown>{content}</Markdown>

      <footer className="mt-3 space-y-2 border-t border-line pt-2.5">
        <RouteTrace metadata={metadata} />

        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs text-muted">
          <SourceBadge source={metadata.resolution_source} />
          <span className="inline-flex min-w-0 items-center gap-1" title="Model">
            <Cpu className="size-3.5 shrink-0" aria-hidden />
            <span className="sr-only">Model</span>
            <span data-testid="meta-model" className="truncate text-ink-800">
              {metadata.model ?? '—'}
            </span>
          </span>
          <span className="inline-flex items-center gap-1" title="Server latency">
            <Timer className="size-3.5" aria-hidden />
            <span className="sr-only">Latency</span>
            <span data-testid="meta-latency" className="tabular text-ink-800">
              {formatLatency(metadata.latency_ms)}
            </span>
          </span>
          <span className="inline-flex items-center gap-1" title="Prompt tokens for this request">
            <span data-testid="meta-input-tokens" className="tabular font-medium text-ink-800">
              {rawInt(metadata.input_tokens)}
            </span>
            <span>tokens in</span>
          </span>
          <span className="inline-flex items-center gap-1" title="Completion tokens for this reply">
            <span data-testid="meta-output-tokens" className="tabular font-medium text-ink-800">
              {rawInt(metadata.output_tokens)}
            </span>
            <span>tokens out</span>
          </span>

          <span className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={async () => setCopied(await copyText(content))}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-muted hover:bg-canvas hover:text-ink-900"
              aria-label={copied ? 'Reply copied' : 'Copy reply'}
            >
              {copied ? <Check className="size-3.5 text-live" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls={detailsId}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-muted hover:bg-canvas hover:text-ink-900"
            >
              Details
              <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
            </button>
          </span>
        </div>

        {open && (
          <dl
            id={detailsId}
            className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg bg-canvas px-3 py-2 text-xs"
            data-testid="meta-details"
          >
            <dt className="text-muted">Key used</dt>
            <dd className="text-ink-900">{metadata.key_id ?? 'none (cache)'}</dd>
            <dt className="text-muted">Fallback attempts</dt>
            <dd className="tabular text-ink-900">{rawInt(metadata.fallback_attempts)}</dd>
            {(metadata.attempts ?? []).map((a, i) => (
              <div key={i} className="contents">
                <dt className="text-muted">Attempt {i + 1}</dt>
                <dd className="text-ink-900">
                  {a.key_id} failed with {a.status ?? 'no status'} ({a.reason.replace('_', ' ')}
                  {a.simulated ? ', simulated' : ''})
                </dd>
              </div>
            ))}
          </dl>
        )}
      </footer>
    </article>
  )
}
