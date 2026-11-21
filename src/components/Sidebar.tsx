import { MessageSquare, Plus, X } from 'lucide-react'
import type { HealthResponse } from '../api/types'
import type { Chat } from '../hooks/chatState'
import type { HealthStatus } from '../hooks/useHealth'

interface Props {
  chats: Chat[]
  activeId: string
  onSelect: (sessionId: string) => void
  onNewChat: () => void
  health: HealthResponse | null
  healthStatus: HealthStatus
  open: boolean
  onClose: () => void
  disabled: boolean
}

const STATUS: Record<HealthStatus, { label: string; dot: string }> = {
  checking: { label: 'Checking API', dot: 'bg-ink-300' },
  ok: { label: 'API connected', dot: 'bg-emerald-400' },
  not_ready: { label: 'API not ready', dot: 'bg-amber-400' },
  down: { label: 'API unreachable', dot: 'bg-red-400' },
}

export function Brand() {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#26384f" />
        <path d="M10 22V9h3v10.5h7.5V22z" fill="#f3f5f8" />
        <circle cx="23" cy="11" r="2.6" fill="#2bb3b1" />
      </svg>
      <span className="text-[1.35rem] font-semibold tracking-tight text-white">Lyftr</span>
    </span>
  )
}

export function Sidebar({ chats, activeId, onSelect, onNewChat, health, healthStatus, open, onClose, disabled }: Props) {
  const status = STATUS[healthStatus]
  return (
    <>
      {/* Mobile scrim */}
      <div
        className={`fixed inset-0 z-30 bg-ink-950/40 transition-opacity md:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        id="sidebar"
        data-testid="sidebar"
        data-open={open}
        aria-label="Chats"
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-ink-900 text-ink-100 transition-transform md:static md:z-auto md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 pb-3 pt-4">
          <Brand />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-300 hover:bg-ink-800 hover:text-white md:hidden"
            aria-label="Close chats"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="px-3">
          <button
            type="button"
            onClick={onNewChat}
            disabled={disabled}
            data-testid="new-chat-button"
            className="flex w-full items-center gap-2 rounded-lg border border-ink-700 px-3 py-2.5 text-sm font-medium text-white hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="size-4" aria-hidden />
            New chat
          </button>
        </div>

        <nav className="mt-5 min-h-0 flex-1 overflow-y-auto px-3" aria-label="Chats in this tab">
          <h2 className="px-2 pb-1.5 text-xs font-medium text-ink-300">Chats in this tab</h2>
          <ul className="space-y-0.5" data-testid="chat-list">
            {chats.map((chat) => {
              const isActive = chat.sessionId === activeId
              return (
                <li key={chat.sessionId}>
                  <button
                    type="button"
                    onClick={() => onSelect(chat.sessionId)}
                    disabled={disabled && !isActive}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm disabled:opacity-50 ${
                      isActive ? 'bg-ink-800 text-white' : 'text-ink-100 hover:bg-ink-800/60'
                    }`}
                  >
                    <MessageSquare className="size-4 shrink-0 text-ink-300" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{chat.title}</span>
                    {chat.turns > 0 && (
                      <span className="tabular text-xs text-ink-300" aria-label={`${chat.turns} replies`}>
                        {chat.turns}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="px-2 pt-3 text-xs leading-relaxed text-ink-500">
            Reloading the page starts a new session. Chats stay on the server.
          </p>
        </nav>

        <div className="border-t border-ink-800 px-4 py-3 text-xs" data-testid="health-status">
          <p className="flex items-center gap-2 text-ink-100">
            <span className={`size-2 rounded-full ${status.dot}`} aria-hidden />
            {status.label}
          </p>
          {health && (
            <p className="mt-1 text-ink-300">
              {health.keys_configured} keys, cache {health.cache_enabled ? 'on' : 'off'}
              {health.model ? <span className="block truncate text-ink-500">{health.model}</span> : null}
            </p>
          )}
        </div>
      </aside>
    </>
  )
}
