import { CloudOff, LoaderCircle, Menu, Plus } from 'lucide-react'
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

  // The backend health response is the source of truth for whether simulation is usable.
  const showSimulation = health?.failure_simulation_enabled === true
  const simulateFailure = showSimulation
    ? (SIMULATION_SCENARIOS.find((s) => s.id === scenarioId)?.header ?? null)
    : null
  const settings = useMemo(() => ({ simulateFailure }), [simulateFailure])

  const { active, pending, newChat } = chat
  const startNewChat = useCallback(() => {
    newChat()
    setSettingsPref(null)
    setSidebarOpen(false)
  }, [newChat])
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
    <div className="app-shell flex h-full min-h-0 bg-[#eff1f5] p-0 md:p-4">
      <div className="app-window flex h-full min-h-0 w-full overflow-hidden rounded-none border border-white/70 bg-white shadow-none md:rounded-[22px] md:shadow-[0_24px_80px_rgba(46,52,74,0.12)]">
      <Sidebar
        chats={chats}
        activeId={active.sessionId}
        onSelect={(id) => {
          chat.selectChat(id)
          setSidebarOpen(false)
        }}
        onNewChat={startNewChat}
        health={health}
        healthStatus={healthStatus}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        disabled={pending}
      />

      <main className="flex min-w-0 flex-1 flex-col bg-white">
        <header className="flex h-[68px] shrink-0 items-center gap-3 border-b border-[#edf0f5] bg-white px-4 md:px-7">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="-ml-1 rounded-xl p-2 text-ink-700 hover:bg-[#f4f5fa] md:hidden"
            aria-label="Open chats"
            aria-controls="sidebar"
            aria-expanded={sidebarOpen}
            data-testid="open-sidebar"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-[-0.02em] text-[#252839]" data-testid="chat-title">
                {active.title}
              </p>
              <p className="truncate text-[11px] text-[#9397a7]">
                Session <span data-testid="session-id">{active.sessionId}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={startNewChat}
            disabled={pending}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#20212a] px-3.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#383947] disabled:opacity-50"
            aria-label="Start a new chat"
          >
            <Plus className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">New chat</span>
            <span className="sm:hidden">New</span>
          </button>
          <div className="ml-1 grid size-9 shrink-0 place-items-center rounded-full bg-[#f0f1f5] text-xs font-bold text-[#686c7b]" aria-hidden="true">
            L
          </div>
        </header>

        <div className="lyftr-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-[58rem] flex-col px-4 pb-5 pt-5 md:px-9 md:pt-7">
            {(healthStatus === 'down' || healthStatus === 'not_ready') && (
              <div
                role="status"
                data-testid="health-banner"
                className="mb-5 flex items-center gap-3 rounded-2xl border border-fail/20 bg-fail-soft px-4 py-3 text-sm text-ink-800"
              >
                <CloudOff className="size-4 shrink-0 text-fail" aria-hidden />
                <span className="flex-1">
                  {healthStatus === 'down'
                    ? `Cannot reach the API at ${config.apiBaseUrl}. Messages will fail until it is back.`
                    : 'The API is running but not ready (it needs two distinct keys and a working database).'}
                </span>
                <button type="button" onClick={refreshHealth} className="rounded-lg px-2 py-1 font-semibold text-fail hover:bg-white/60">
                  Check again
                </button>
              </div>
            )}

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

            {active.messages.length === 0 && !pending && active.history !== 'loading' ? (
              <div className="flex flex-1 flex-col items-center justify-center pb-5 pt-8 sm:pt-12">
                <EmptyState onPick={send} disabled={pending} />
                <div className="mt-7 w-full max-w-[46rem]">
                  <Composer ref={composer} disabled={pending} onSend={send} />
                </div>
                <div className="mt-4 w-full max-w-[46rem]">
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
                </div>
                <p className="mt-3 text-center text-[11px] text-[#a0a3b0]">Lyftr can make mistakes. Check important details.</p>
              </div>
            ) : (
              <div className="flex-1">
                <div className="mx-auto mb-5 w-full max-w-[46rem]">
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
                </div>
                <div className="mx-auto w-full max-w-[46rem]">
                  <MessageList messages={active.messages} pending={pending} onRetry={(id) => void chat.retry(id, settings)} />
                </div>
              </div>
            )}
          </div>
        </div>

        {(active.messages.length > 0 || active.history === 'loading') && <div className="border-t border-[#edf0f5] bg-white px-4 pb-4 pt-3 md:px-7"><div className="mx-auto w-full max-w-[46rem]"><Composer ref={composer} disabled={pending} onSend={send} /></div></div>}
      </main>
      </div>
    </div>
  )
}
