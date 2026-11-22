import { useCallback, useLayoutEffect, useMemo, useReducer, useRef } from 'react'
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

export function useChat(): UseChat {
  // The assignment requires a distinct client session for each page load.
  const [state, dispatch] = useReducer(chatReducer, undefined, () => initialState(newSessionId()))
  const inFlight = useRef(false)
  const stateRef = useRef(state)
  // Event handlers read the latest state through this ref (synced before paint).
  useLayoutEffect(() => {
    stateRef.current = state
  }, [state])

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
