import { describe, expect, it } from 'vitest'
import { chatReducer, initialState, titleFrom, type ChatState } from '../src/hooks/chatState'
import { chatOk } from './mockBackend'

const SID = 's-test'

function start(state: ChatState, id: string, content: string) {
  return chatReducer(state, { type: 'send_start', sessionId: SID, message: { id, kind: 'user', content, status: 'pending' } })
}

describe('chatReducer', () => {
  it('a successful turn marks the user message sent and counts one turn', () => {
    let s = start(initialState(SID), 'u1', 'hello')
    expect(s.pendingSessionId).toBe(SID)
    s = chatReducer(s, { type: 'send_ok', sessionId: SID, userMessageId: 'u1', response: chatOk(SID, 'hi').body as never })
    const chat = s.chats[SID]!
    expect(chat.turns).toBe(1)
    expect(chat.messages.map((m) => m.kind)).toEqual(['user', 'assistant'])
    expect(chat.messages[0]).toMatchObject({ status: 'sent' })
    expect(s.pendingSessionId).toBeNull()
    expect(chat.title).toBe('hello')
  })

  it('a failed turn is not counted and is kept as failed + error', () => {
    let s = start(initialState(SID), 'u1', 'hello')
    s = chatReducer(s, {
      type: 'send_fail', sessionId: SID, userMessageId: 'u1', text: 'hello',
      title: 'All providers unavailable', message: 'x', errorKind: 'unavailable',
    })
    const chat = s.chats[SID]!
    expect(chat.turns).toBe(0)
    expect(chat.messages.map((m) => m.kind)).toEqual(['user', 'error'])
    expect(chat.messages[0]).toMatchObject({ status: 'failed' })
  })

  it('discard_failed removes the error and its user message', () => {
    let s = start(initialState(SID), 'u1', 'hello')
    s = chatReducer(s, {
      type: 'send_fail', sessionId: SID, userMessageId: 'u1', text: 'hello', title: 't', message: 'm', errorKind: 'network',
    })
    const errorId = s.chats[SID]!.messages[1]!.id
    s = chatReducer(s, { type: 'discard_failed', sessionId: SID, errorId })
    expect(s.chats[SID]!.messages).toEqual([])
  })

  it('history replaces local messages but keeps unsent failures at the end', () => {
    let s = start(initialState(SID), 'u1', 'failed one')
    s = chatReducer(s, {
      type: 'send_fail', sessionId: SID, userMessageId: 'u1', text: 'failed one', title: 't', message: 'm', errorKind: 'unavailable',
    })
    s = chatReducer(s, {
      type: 'history_ok',
      sessionId: SID,
      messages: [
        { role: 'user', content: 'stored q' },
        { role: 'assistant', content: 'stored a', metadata: { resolution_source: 'LIVE_INFERENCE' } },
      ],
    })
    const chat = s.chats[SID]!
    expect(chat.messages.map((m) => (m.kind === 'error' ? 'error' : m.content))).toEqual([
      'stored q', 'stored a', 'failed one', 'error',
    ])
    expect(chat.turns).toBe(1)
    expect(chat.history).toBe('idle')
  })

  it('new_chat puts the new session first and selects it', () => {
    const s = chatReducer(initialState(SID), { type: 'new_chat', sessionId: 's-2' })
    expect(s.order).toEqual(['s-2', SID])
    expect(s.activeId).toBe('s-2')
  })

  it('titles are single-line and clipped', () => {
    expect(titleFrom('  a\n b  ')).toBe('a b')
    expect(titleFrom('x'.repeat(100))).toHaveLength(42)
  })
})
