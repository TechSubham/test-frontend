const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** "812 ms" — the assignment's example format for meta-latency. */
export function formatLatency(ms: number | undefined): string {
  return typeof ms === 'number' ? `${Math.round(ms)} ms` : '—'
}

/** Raw integer for token test ids (no separators, so the value is exactly the integer). */
export function rawInt(n: number | undefined): string {
  return typeof n === 'number' ? String(Math.round(n)) : '—'
}

export function formatCount(n: number): string {
  return integer.format(n)
}
