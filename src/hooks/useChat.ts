import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef } from 'react'
import { ApiError, api } from '../api/client'
import { localId, newSessionId } from '../lib/session'
import { chatReducer, initialState, type Chat, type ChatState } from './chatState'

export interface SendSettings {
  simulateFailure: string | null
}

export interface UseChat {
  state: ChatState
  active: Chat
  pending: boolean
  send: (text: string, settings: SendSettings) => Promise<void>
  retry: (errorId: string, settings: SendSettings) => Promise<void>
  newChat: () => void
  selectChat: (sessionId: string) => void
  setSystemPrompt: (value: string) => void
}

const CHAT_STORAGE_KEY = 'lyftr.chat-state.v1'

function restoreState(): ChatState {
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as {
        activeId?: unknown
        chats?: Array<{ sessionId?: unknown; title?: unknown; turns?: unknown; systemPrompt?: unknown }>
      }
      const records = Array.isArray(saved.chats) ? saved.chats : []
      const chats: Record<string, Chat> = {}
      for (const record of records) {
        if (typeof record.sessionId !== 'string' || record.sessionId.length === 0 || record.sessionId.length > 128) {
          continue
        }
        const restored = initialState(record.sessionId).chats[record.sessionId]!
        chats[record.sessionId] = {
          ...restored,
          title: typeof record.title === 'string' ? record.title : restored.title,
          turns: typeof record.turns === 'number' && Number.isFinite(record.turns) ? Math.max(0, record.turns) : 0,
          systemPrompt: typeof record.systemPrompt === 'string' ? record.systemPrompt : '',
        }
      }
      const order = Object.keys(chats)
      const activeId = typeof saved.activeId === 'string' && chats[saved.activeId] ? saved.activeId : order[0]
      if (activeId && order.length > 0) return { chats, order, activeId, pendingSessionId: null }
    }
  } catch {
    // If storage is unavailable or malformed, start a clean session.
  }
  return initialState(newSessionId())
}

export function useChat(): UseChat {
  const [state, dispatch] = useReducer(chatReducer, undefined, restoreState)
  const inFlight = useRef(false)
  const restoreFetchStarted = useRef(false)
  const stateRef = useRef(state)
  // Event handlers read the latest state through this ref (synced before paint).
  useLayoutEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    try {
      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({
        activeId: state.activeId,
        chats: state.order.map((id) => {
          const chat = state.chats[id]!
          return {
            sessionId: chat.sessionId,
            title: chat.title,
            turns: chat.turns,
            systemPrompt: chat.systemPrompt,
          }
        }),
      }))
    } catch {
      // Chat requests still work when browser storage is disabled or full.
    }
  }, [state])

  useEffect(() => {
    if (restoreFetchStarted.current) return
    restoreFetchStarted.current = true
    const chat = state.chats[state.activeId]!
    if (chat.turns > 0) {
      dispatch({ type: 'history_start', sessionId: chat.sessionId })
      api
        .history(chat.sessionId)
        .then((res) => dispatch({ type: 'history_ok', sessionId: chat.sessionId, messages: res.messages }))
        .catch(() => dispatch({ type: 'history_fail', sessionId: chat.sessionId }))
    }
    // Restore the saved chats once when this hook mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const active = state.chats[state.activeId]!

  const sendTo = useCallback(async (sessionId: string, text: string, { simulateFailure }: SendSettings) => {
    const message = text.trim()
    if (!message || inFlight.current) return
    const chat = stateRef.current.chats[sessionId]
    if (!chat) return
    inFlight.current = true
    const userMessageId = localId('u')
    dispatch({ type: 'send_start', sessionId, message: { id: userMessageId, kind: 'user', content: message, status: 'pending' } })
    const prompt = chat.systemPrompt.trim()
    try {
      // Only the new message is sent; history lives on the server.
      const response = await api.chat(
        { session_id: sessionId, message, ...(prompt ? { system_prompt: prompt } : {}) },
        { simulateFailure },
      )
      dispatch({ type: 'send_ok', sessionId, userMessageId, response })
    } catch (err) {
      const e =
        err instanceof ApiError
          ? err
          : new ApiError('unexpected', 'Something went wrong', 'The request failed unexpectedly. Retry in a moment.')
      dispatch({
        type: 'send_fail',
        sessionId,
        userMessageId,
        text: message,
        title: e.title,
        message: e.message,
        errorKind: e.kind,
      })
    } finally {
      inFlight.current = false
    }
  }, [])

  const send = useCallback(
    (text: string, settings: SendSettings) => sendTo(stateRef.current.activeId, text, settings),
    [sendTo],
  )

  const retry = useCallback(
    async (errorId: string, settings: SendSettings) => {
      const sessionId = stateRef.current.activeId
      const chat = stateRef.current.chats[sessionId]
      const err = chat?.messages.find((m) => m.id === errorId)
      if (!err || err.kind !== 'error' || inFlight.current) return
      dispatch({ type: 'discard_failed', sessionId, errorId })
      await sendTo(sessionId, err.retryText, settings)
    },
    [sendTo],
  )

  const newChat = useCallback(() => {
    dispatch({ type: 'new_chat', sessionId: newSessionId() })
  }, [])

  const selectChat = useCallback((sessionId: string) => {
    const chat = stateRef.current.chats[sessionId]
    if (!chat) return
    dispatch({ type: 'select', sessionId })
    if (chat.turns === 0) return // nothing stored server-side yet (history would be 404)
    dispatch({ type: 'history_start', sessionId })
    api
      .history(sessionId)
      .then((res) => dispatch({ type: 'history_ok', sessionId, messages: res.messages }))
      .catch(() => dispatch({ type: 'history_fail', sessionId }))
  }, [])

  const setSystemPrompt = useCallback(
    (value: string) => dispatch({ type: 'set_prompt', sessionId: stateRef.current.activeId, value }),
    [],
  )

  return useMemo(
    () => ({
      state,
      active,
      pending: state.pendingSessionId !== null,
      send,
      retry,
      newChat,
      selectChat,
      setSystemPrompt,
    }),
    [state, active, send, retry, newChat, selectChat, setSystemPrompt],
  )
}
