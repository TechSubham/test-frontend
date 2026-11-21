export function TypingIndicator() {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="loading-indicator"
      className="flex w-fit items-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm text-muted"
    >
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="typing-dot size-1.5 rounded-full bg-live"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      Waiting for the model
    </div>
  )
}
