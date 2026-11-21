const STARTERS = [
  'What is the capital of France?',
  'Explain API key failover in two sentences.',
  'Give me three names for a hiking app.',
]

export function EmptyState({ onPick, disabled }: { onPick: (text: string) => void; disabled: boolean }) {
  return (
    <div className="py-10 sm:py-16" data-testid="empty-state">
      <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-ink-900 sm:text-[2.1rem]">
        Start a conversation
      </h1>
      <p className="mt-2 max-w-[34rem] text-[0.95rem] leading-relaxed text-muted">
        Every reply shows how it was served: generated live or returned from the cache, which key answered, the
        latency and the tokens it used.
      </p>
      <ul className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {STARTERS.map((text) => (
          <li key={text}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(text)}
              className="w-full rounded-lg border border-line bg-paper px-3.5 py-2 text-left text-sm text-ink-800 hover:border-ink-300 disabled:opacity-50 sm:w-auto"
            >
              {text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
