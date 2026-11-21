import { ChevronDown, FlaskConical, SlidersHorizontal } from 'lucide-react'
import { useId } from 'react'
import { config } from '../config'
import { SIMULATION_SCENARIOS } from '../lib/simulation'

interface Props {
  open: boolean
  onToggle: () => void
  systemPrompt: string
  onSystemPromptChange: (value: string) => void
  showSimulation: boolean
  scenarioId: string
  onScenarioChange: (id: string) => void
  disabled: boolean
}

export function SettingsPanel({
  open,
  onToggle,
  systemPrompt,
  onSystemPromptChange,
  showSimulation,
  scenarioId,
  onScenarioChange,
  disabled,
}: Props) {
  const panelId = useId()
  const promptId = useId()
  const active = SIMULATION_SCENARIOS.find((s) => s.id === scenarioId)
  const summary = [
    systemPrompt.trim() ? 'Custom system prompt' : 'Default system prompt',
    showSimulation && active?.header ? `Simulating ${active.header}` : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <section className="rounded-xl border border-line bg-paper" aria-label="Chat settings">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-left text-sm"
      >
        <SlidersHorizontal className="size-4 text-ink-500" aria-hidden />
        <span className="font-medium text-ink-900">Chat settings</span>
        <span className="min-w-0 flex-1 truncate text-muted">{summary}</span>
        <ChevronDown className={`size-4 text-ink-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div id={panelId} className="space-y-4 border-t border-line px-4 pb-4 pt-3">
          <div>
            <label htmlFor={promptId} className="text-sm font-medium text-ink-900">
              System prompt
            </label>
            <p className="mt-0.5 text-xs text-muted">
              Optional. Sent with your next message and kept by the server for this chat. Leave empty to keep the
              current one.
            </p>
            <textarea
              id={promptId}
              data-testid="system-prompt-input"
              rows={2}
              value={systemPrompt}
              maxLength={config.systemPromptMaxChars}
              onChange={(e) => onSystemPromptChange(e.target.value)}
              placeholder="You are a helpful assistant."
              className="mt-2 w-full resize-y rounded-lg border border-line bg-canvas px-3 py-2 text-sm leading-relaxed outline-none focus:border-ink-300 focus:bg-paper"
            />
          </div>

          {showSimulation && (
            <fieldset className="rounded-lg border border-dashed border-cache/40 bg-cache-soft/50 p-3" disabled={disabled}>
              <legend className="flex items-center gap-1.5 px-1 text-sm font-medium text-ink-900">
                <FlaskConical className="size-4 text-cache" aria-hidden />
                Failure simulation
              </legend>
              <p className="mb-2 text-xs text-muted">
                Testing only. Sends the <code className="rounded bg-paper px-1">X-Simulate-Failure</code> header with
                each message while selected.
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label="Failure scenario">
                {SIMULATION_SCENARIOS.map((s) => (
                  <label
                    key={s.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-xs ${
                      s.id === scenarioId ? 'border-cache bg-paper' : 'border-transparent hover:bg-paper/70'
                    }`}
                  >
                    <input
                      type="radio"
                      name="simulation"
                      value={s.id}
                      checked={s.id === scenarioId}
                      onChange={() => onScenarioChange(s.id)}
                      className="mt-0.5 accent-[var(--color-cache)]"
                      data-testid={`simulation-${s.id}`}
                    />
                    <span>
                      <span className="block font-medium text-ink-900">{s.label}</span>
                      <span className="text-muted">{s.expected}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      )}
    </section>
  )
}
