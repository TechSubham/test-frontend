import type { ApiErrorKind } from '../api/client'
import type { ChatMetadata, ChatResponse, HistoryMessage, HistoryMetadata } from '../api/types'
import { localId } from '../lib/session'

export interface UserMessage {
  id: string
  kind: 'user'
  content: string
  status: 'pending' | 'sent' | 'failed'
}

export interface AssistantMessage {
  id: string
  kind: 'assistant'
  content: string
  metadata: ChatMetadata | HistoryMetadata
}

export interface ErrorMessage {
  id: string
  kind: 'error'
  title: string
  message: string
  errorKind: ApiErrorKind | 'unknown'
  /** The user text that failed; Retry sends it again. */
  retryText: string
  userMessageId: string
}

export type UiMessage = UserMessage | AssistantMessage | ErrorMessage

export interface Chat {
  sessionId: string
  title: string
  messages: UiMessage[]
  systemPrompt: string
  /** Successful turns stored by the backend for this session. */
  turns: number
  history: 'idle' | 'loading' | 'error'
}

export interface ChatState {
  chats: Record<string, Chat>
  order: string[] // newest first
  activeId: string
  pendingSessionId: string | null
}

export type ChatAction =
  | { type: 'new_chat'; sessionId: string }
  | { type: 'select'; sessionId: string }
  | { type: 'set_prompt'; sessionId: string; value: string }
  | { type: 'send_start'; sessionId: string; message: UserMessage }
  | { type: 'send_ok'; sessionId: string; userMessageId: string; response: ChatResponse }
  | {
      type: 'send_fail'
      sessionId: string
      userMessageId: string
      text: string
      title: string
      message: string
      errorKind: ApiErrorKind | 'unknown'
    }
  | { type: 'discard_failed'; sessionId: string; errorId: string }
  | { type: 'history_start'; sessionId: string }
  | { type: 'history_ok'; sessionId: string; messages: HistoryMessage[] }
  | { type: 'history_fail'; sessionId: string }

const TITLE_CHARS = 42

export function titleFrom(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > TITLE_CHARS ? `${oneLine.slice(0, TITLE_CHARS - 1)}…` : oneLine
}

export function emptyChat(sessionId: string): Chat {
  return { sessionId, title: 'New chat', messages: [], systemPrompt: '', turns: 0, history: 'idle' }
}

export function initialState(sessionId: string): ChatState {
  return { chats: { [sessionId]: emptyChat(sessionId) }, order: [sessionId], activeId: sessionId, pendingSessionId: null }
}

function update(state: ChatState, sessionId: string, fn: (chat: Chat) => Chat): ChatState {
  const chat = state.chats[sessionId]
  if (!chat) return state
  return { ...state, chats: { ...state.chats, [sessionId]: fn(chat) } }
}

export function fromHistory(messages: HistoryMessage[]): UiMessage[] {
  return messages.map((m) =>
    m.role === 'user'
      ? { id: localId('u'), kind: 'user', content: m.content, status: 'sent' }
      : { id: localId('a'), kind: 'assistant', content: m.content, metadata: m.metadata ?? {} },
  )
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'new_chat':
      {
        const keep = state.order.filter((id) => {
          const chat = state.chats[id]
          return chat && (chat.turns > 0 || chat.messages.length > 0 || chat.history === 'loading')
        })
        const chats: Record<string, Chat> = {}
        for (const id of keep) chats[id] = state.chats[id]!
        chats[action.sessionId] = emptyChat(action.sessionId)
        return {
          ...state,
          chats,
          order: [action.sessionId, ...keep],
          activeId: action.sessionId,
        }
      }
    case 'select':
      return state.chats[action.sessionId] ? { ...state, activeId: action.sessionId } : state
    case 'set_prompt':
      return update(state, action.sessionId, (c) => ({ ...c, systemPrompt: action.value }))
    case 'send_start':
      return {
        ...update(state, action.sessionId, (c) => ({
          ...c,
          title: c.turns === 0 && c.messages.every((m) => m.kind !== 'user') ? titleFrom(action.message.content) : c.title,
          messages: [...c.messages, action.message],
        })),
        pendingSessionId: action.sessionId,
      }
    case 'send_ok':
      return {
        ...update(state, action.sessionId, (c) => ({
          ...c,
          turns: c.turns + 1,
          messages: [
            ...c.messages.map((m) =>
              m.id === action.userMessageId && m.kind === 'user' ? { ...m, status: 'sent' as const } : m,
            ),
            {
              id: localId('a'),
              kind: 'assistant' as const,
              content: action.response.reply,
              metadata: action.response.metadata,
            },
          ],
        })),
        pendingSessionId: null,
      }
    case 'send_fail':
      return {
        ...update(state, action.sessionId, (c) => ({
          ...c,
          messages: [
            ...c.messages.map((m) =>
              m.id === action.userMessageId && m.kind === 'user' ? { ...m, status: 'failed' as const } : m,
            ),
            {
              id: localId('e'),
              kind: 'error' as const,
              title: action.title,
              message: action.message,
              errorKind: action.errorKind,
              retryText: action.text,
              userMessageId: action.userMessageId,
            },
          ],
        })),
        pendingSessionId: null,
      }
    case 'discard_failed':
      return update(state, action.sessionId, (c) => {
        const err = c.messages.find((m) => m.id === action.errorId)
        if (!err || err.kind !== 'error') return c
        return { ...c, messages: c.messages.filter((m) => m.id !== err.id && m.id !== err.userMessageId) }
      })
    case 'history_start':
      return update(state, action.sessionId, (c) => ({ ...c, history: 'loading' }))
    case 'history_ok':
      return update(state, action.sessionId, (c) => {
        // Server history is the source of truth; keep local unsent failures after it.
        const failedIds = new Set(
          c.messages.filter((m): m is ErrorMessage => m.kind === 'error').map((m) => m.userMessageId),
        )
        const localFailures = c.messages.filter((m) => m.kind === 'error' || failedIds.has(m.id))
        const firstUser = action.messages.find((m) => m.role === 'user')
        return {
          ...c,
          history: 'idle',
          turns: action.messages.filter((m) => m.role === 'assistant').length,
          title: firstUser ? titleFrom(firstUser.content) : c.title,
          messages: [...fromHistory(action.messages), ...localFailures],
        }
      })
    case 'history_fail':
      return update(state, action.sessionId, (c) => ({ ...c, history: 'error' }))
  }
}
