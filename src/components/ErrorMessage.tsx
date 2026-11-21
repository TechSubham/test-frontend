import { RotateCw, TriangleAlert } from 'lucide-react'
import type { ErrorMessage as ErrorMessageT } from '../hooks/chatState'

interface Props {
  error: ErrorMessageT
  onRetry: () => void
  disabled: boolean
}

/** Readable error in the conversation — never `assistant-message`, never a blank screen. */
export function ErrorMessage({ error, onRetry, disabled }: Props) {
  return (
    <div
      role="alert"
      data-testid="chat-error"
      data-error-kind={error.errorKind}
      className="flex gap-3 rounded-xl border border-fail/25 bg-fail-soft px-4 py-3 text-sm"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-fail" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-fail">{error.title}</p>
        <p className="mt-0.5 break-words text-ink-800">{error.message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={disabled}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 self-center rounded-lg border border-fail/30 bg-paper px-3 font-medium text-fail hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="retry-button"
      >
        <RotateCw className="size-3.5" aria-hidden />
        Retry
      </button>
    </div>
  )
}
