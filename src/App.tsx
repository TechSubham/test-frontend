import { CloudOff, LoaderCircle, Menu } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Composer, type ComposerHandle } from './components/Composer'
import { EmptyState } from './components/EmptyState'
import { MessageList } from './components/MessageList'
import { SettingsPanel } from './components/SettingsPanel'
import { Sidebar } from './components/Sidebar'
import { config } from './config'
import { useChat } from './hooks/useChat'
import { useHealth } from './hooks/useHealth'
import { SIMULATION_SCENARIOS } from './lib/simulation'

export default function App() {
  const chat = useChat()
  const { status: healthStatus, health, refresh: refreshHealth } = useHealth()
  const composer = useRef<ComposerHandle>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // null = automatic: open while the chat is empty, collapsed once it has messages.
  const [settingsPref, setSettingsPref] = useState<boolean | null>(null)
  const [scenarioId, setScenarioId] = useState('off')

  // Developer panel: needs the frontend flag AND the backend reporting simulation enabled.
  const showSimulation = config.simulationPanelFlag && health?.failure_simulation_enabled === true
  const simulateFailure = showSimulation
    ? (SIMULATION_SCENARIOS.find((s) => s.id === scenarioId)?.header ?? null)
    : null
  const settings = useMemo(() => ({ simulateFailure }), [simulateFailure])

  const { active, pending } = chat
  const settingsOpen = settingsPref ?? active.messages.length === 0
  const chats = useMemo(() => chat.state.order.map((id) => chat.state.chats[id]!), [chat.state])

  const send = useCallback(
    async (text: string) => {
      await chat.send(text, settings)
      composer.current?.focus()
    },
    [chat, settings],
  )

  // A failed send may mean the backend went away — re-check health right after.
  const lastMessage = active.messages.at(-1)
  useEffect(() => {
    if (lastMessage?.kind === 'error') refreshHealth()
  }, [lastMessage, refreshHealth])

  useEffect(() => {
    composer.current?.focus()
  }, [active.sessionId])

  return (
    <div className="flex h-full">
      <Sidebar
        chats={chats}
        activeId={active.sessionId}
        onSelect={(id) => {
          chat.selectChat(id)
          setSidebarOpen(false)
        }}
        onNewChat={() => {
          chat.newChat()
          setSettingsPref(null)
          setSidebarOpen(false)
        }}
        health={health}
        healthStatus={healthStatus}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        disabled={pending}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-canvas/90 px-4 py-2.5 backdrop-blur md:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="-ml-1 rounded-md p-1.5 text-ink-700 hover:bg-paper md:hidden"
            aria-label="Open chats"
            aria-controls="sidebar"
            aria-expanded={sidebarOpen}
            data-testid="open-sidebar"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink-900" data-testid="chat-title">
              {active.title}
            </p>
            <p className="truncate text-xs text-muted">
              Session <span data-testid="session-id">{active.sessionId}</span>
            </p>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[46rem] space-y-4 px-4 pb-6 pt-4 md:px-6">
            {(healthStatus === 'down' || healthStatus === 'not_ready') && (
              <div
                role="status"
                data-testid="health-banner"
                className="flex items-center gap-3 rounded-xl border border-fail/25 bg-fail-soft px-4 py-2.5 text-sm text-ink-800"
              >
                <CloudOff className="size-4 shrink-0 text-fail" aria-hidden />
                <span className="flex-1">
                  {healthStatus === 'down'
                    ? `Cannot reach the API at ${config.apiBaseUrl}. Messages will fail until it is back.`
                    : 'The API is running but not ready (it needs two distinct keys and a working database).'}
                </span>
                <button type="button" onClick={refreshHealth} className="font-medium text-fail underline underline-offset-2">
                  Check again
                </button>
              </div>
            )}

            <SettingsPanel
              open={settingsOpen}
              onToggle={() => setSettingsPref(!settingsOpen)}
              systemPrompt={active.systemPrompt}
              onSystemPromptChange={chat.setSystemPrompt}
              showSimulation={showSimulation}
              scenarioId={scenarioId}
              onScenarioChange={setScenarioId}
              disabled={pending}
            />

            {active.history === 'loading' && (
              <p className="flex items-center gap-2 text-sm text-muted" role="status" data-testid="history-loading">
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                Loading this chat from the server
              </p>
            )}
            {active.history === 'error' && (
              <p className="text-sm text-muted" data-testid="history-error">
                Could not refresh this chat from the server; showing the copy kept in this tab.
              </p>
            )}

            {active.messages.length === 0 && !pending ? (
              <EmptyState onPick={send} disabled={pending} />
            ) : (
              <MessageList messages={active.messages} pending={pending} onRetry={(id) => void chat.retry(id, settings)} />
            )}
          </div>
        </div>

        <div className="border-t border-line bg-canvas px-4 pb-4 pt-3 md:px-6">
          <div className="mx-auto w-full max-w-[46rem]">
            <Composer ref={composer} disabled={pending} onSend={send} />
          </div>
        </div>
      </main>
    </div>
  )
}
