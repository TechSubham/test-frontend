import { Clock3, MessageSquare, Plus, X } from 'lucide-react'
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
      <span className="grid size-8 place-items-center rounded-[11px] bg-gradient-to-br from-[#a69cff] via-[#786cf0] to-[#a6c8ff] shadow-[0_5px_14px_rgba(113,103,226,0.24)]">
        <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
          <path d="M7 17V7h2.4v7.8H17V17H7Z" fill="white" />
          <circle cx="16.4" cy="7.7" r="2.1" fill="#e8e2ff" />
        </svg>
      </span>
      <span className="text-[1.18rem] font-bold tracking-[-0.045em] text-[#252839]">Lyftr</span>
    </span>
  )
}

export function Sidebar({ chats, activeId, onSelect, onNewChat, health, healthStatus, open, onClose, disabled }: Props) {
  const status = STATUS[healthStatus]
  return (
    <>
      {/* Mobile scrim */}
      <div
        className={`fixed inset-0 z-30 bg-[#252839]/30 backdrop-blur-[2px] transition-opacity md:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        id="sidebar"
        data-testid="sidebar"
        data-open={open}
        aria-label="Chats"
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(258px,88vw)] flex-col border-r border-[#edf0f5] bg-[#f8f9fc] text-[#656a7c] transition-transform md:static md:z-auto md:w-[258px] md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 pb-5 pt-5">
          <Brand />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#858a9a] hover:bg-white md:hidden"
            aria-label="Close chats"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="px-4">
          <button
            type="button"
            onClick={onNewChat}
            disabled={disabled}
            data-testid="new-chat-button"
            className="flex w-full items-center gap-2 rounded-xl border border-[#e7e9f0] bg-white px-3 py-2.5 text-sm font-semibold text-[#303345] shadow-[0_2px_6px_rgba(40,43,63,0.03)] transition hover:border-[#d7d3fb] hover:bg-[#fcfbff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="size-4" aria-hidden />
            New chat
          </button>
        </div>

        <nav className="mt-7 min-h-0 flex-1 overflow-y-auto px-4" aria-label="Chats in this tab">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#a1a5b3]">Recent chats</h2>
            <Clock3 className="size-3.5 text-[#b2b5c1]" aria-hidden />
          </div>
          <ul className="space-y-1" data-testid="chat-list">
            {chats.map((chat) => {
              const isActive = chat.sessionId === activeId
              return (
                <li key={chat.sessionId}>
                  <button
                    type="button"
                    onClick={() => onSelect(chat.sessionId)}
                    disabled={disabled && !isActive}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left text-[13px] transition disabled:opacity-50 ${
                      isActive ? 'bg-[#eeecff] font-semibold text-[#5e56c8]' : 'text-[#656a7c] hover:bg-white'
                    }`}
                  >
                    <MessageSquare className={`size-4 shrink-0 ${isActive ? 'text-[#776fed]' : 'text-[#a4a8b5]'}`} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{chat.title}</span>
                    {chat.turns > 0 && (
                      <span className="tabular text-xs text-[#a1a5b3]" aria-label={`${chat.turns} replies`}>
                        {chat.turns}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="px-2 pt-3 text-[11px] leading-relaxed text-[#a1a5b3]">
            Chats are saved in this browser and stay on the server.
          </p>
        </nav>

        <div className="m-3 rounded-2xl border border-[#eceef4] bg-white px-3.5 py-3 text-xs shadow-[0_3px_12px_rgba(42,44,62,0.035)]" data-testid="health-status">
          <p className="flex items-center gap-2 font-medium text-[#4f5364]">
            <span className={`size-2 rounded-full ${status.dot}`} aria-hidden />
            {status.label}
          </p>
          {health && (
            <p className="mt-1 text-[#858a9a]">
              {health.keys_configured} keys, cache {health.cache_enabled ? 'on' : 'off'}
              {health.model ? <span className="block truncate text-[#989cab]">{health.model}</span> : null}
            </p>
          )}
        </div>
      </aside>
    </>
  )
}
