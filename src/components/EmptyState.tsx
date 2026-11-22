const STARTERS = [
  'What is the capital of France?',
  'Explain API key failover in two sentences.',
  'Give me three names for a hiking app.',
]

export function EmptyState({ onPick, disabled }: { onPick: (text: string) => void; disabled: boolean }) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.'

  return (
    <div className="w-full text-center" data-testid="empty-state">
      <div className="lyftr-orb mx-auto mb-6" aria-hidden="true" />
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#a0a3b2]">Your AI workspace</p>
      <h1 className="text-[1.8rem] font-semibold leading-tight tracking-[-0.045em] text-[#252839] sm:text-[2.35rem]">
        {greeting} <span className="lyftr-gradient-text">How can I help?</span>
      </h1>
      <p className="mx-auto mt-3 max-w-[35rem] text-sm leading-relaxed text-[#858a9c] sm:text-[0.95rem]">
        Ask a question, work through an idea, or start something new. Lyftr shows how each answer was served.
      </p>
      <ul className="mt-6 flex flex-wrap justify-center gap-2">
        {STARTERS.map((text) => (
          <li key={text}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(text)}
              className="w-full rounded-full border border-[#e8eaf1] bg-white px-3.5 py-2 text-left text-xs font-medium text-[#676c7e] shadow-[0_2px_9px_rgba(41,43,63,0.035)] transition hover:border-[#c9c6fa] hover:bg-[#faf9ff] hover:text-[#5550bd] disabled:opacity-50 sm:w-auto"
            >
              {text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
