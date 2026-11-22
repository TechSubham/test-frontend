import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { HEALTH_OK, chatOk, deferred, mockBackend } from './mockBackend'

const SESSION_RE = /^s-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function setup() {
  const user = userEvent.setup()
  const view = render(<App />)
  return { user, ...view }
}

const sessionId = () => screen.getByTestId('session-id').textContent ?? ''

async function sendMessage(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByTestId('chat-input'), text)
  await user.click(screen.getByTestId('send-button'))
}

describe('initial render', () => {
  it('shows branding, new chat, composer and the empty state', async () => {
    mockBackend()
    setup()
    expect(screen.getByText('Lyftr')).toBeInTheDocument()
    expect(screen.getByTestId('new-chat-button')).toHaveTextContent('New chat')
    expect(screen.getByTestId('chat-input')).toHaveValue('')
    expect(screen.getByTestId('send-button')).toBeDisabled()
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.queryAllByTestId('assistant-message')).toHaveLength(0)
    await waitFor(() => expect(screen.getByTestId('health-status')).toHaveTextContent('API connected'))
    expect(screen.getByTestId('health-status')).toHaveTextContent('2 keys, cache on')
  })

  it('shows a banner when the API is unreachable', async () => {
    mockBackend({ health: 'network-error' })
    setup()
    expect(await screen.findByTestId('health-banner')).toHaveTextContent('Cannot reach the API at http://api.test')
  })
})

describe('session initialisation', () => {
  it('creates a session id in the backend format on load', () => {
    mockBackend()
    setup()
    expect(sessionId()).toMatch(SESSION_RE)
    expect(sessionId().length).toBeLessThanOrEqual(128)
  })

  it('creates a different session on every page load', () => {
    mockBackend()
    const first = setup()
    const a = sessionId()
    first.unmount()
    setup()
    expect(sessionId()).not.toBe(a)
  })

  it('keeps completed chats visible after refresh and reloads their server history when selected', async () => {
    const storedSession = 's-12345678-1234-4234-8234-123456789abc'
    const backend = mockBackend({
      onHistory: () => ({
        status: 200,
        body: {
          session_id: storedSession,
          messages: [
            { role: 'user', content: 'Remember this chat', created_at: '2026-11-21T10:00:00.000Z' },
            { role: 'assistant', content: 'This reply came from the server', created_at: '2026-11-21T10:00:01.000Z' },
          ],
        },
      }),
    })
    window.localStorage.setItem(
      'lyftr.chat-index.v1',
      JSON.stringify([{ sessionId: storedSession, title: 'Remember this chat', turns: 1, systemPrompt: '' }]),
    )

    const { user } = setup()
    expect(sessionId()).not.toBe(storedSession)
    await user.click(within(screen.getByTestId('chat-list')).getByRole('button', { name: /Remember this chat/ }))

    expect(await screen.findByText('This reply came from the server')).toBeInTheDocument()
    expect(backend.historyCalls()[0]?.path).toBe(`/sessions/${storedSession}/messages`)
  })

  it('does not request history for a brand-new session', async () => {
    const backend = mockBackend()
    setup()
    await waitFor(() => expect(backend.fetchMock).toHaveBeenCalled())
    expect(backend.historyCalls()).toHaveLength(0)
  })
})

describe('sending a message', () => {
  it('sends only the new message with the session id and clears the input', async () => {
    const backend = mockBackend()
    const { user } = setup()
    const sid = sessionId()
    await sendMessage(user, '  What is the capital of France?  ')

    expect(screen.getByTestId('chat-input')).toHaveValue('')
    const [call] = backend.chatCalls()
    expect(call?.method).toBe('POST')
    expect(call?.body).toEqual({ session_id: sid, message: 'What is the capital of France?' })
    expect(call?.headers['X-Simulate-Failure']).toBeUndefined()
    expect(await screen.findByTestId('assistant-message')).toHaveTextContent('Answer to: What is the capital of France?')
    expect(screen.getByTestId('user-message')).toHaveTextContent('What is the capital of France?')
  })

  it('never resends earlier messages (backend owns history)', async () => {
    const backend = mockBackend()
    const { user } = setup()
    await sendMessage(user, 'first')
    await screen.findByTestId('assistant-message')
    await sendMessage(user, 'second')
    await waitFor(() => expect(screen.getAllByTestId('assistant-message')).toHaveLength(2))
    const bodies = backend.chatCalls().map((c) => c.body)
    expect(bodies[1]).toEqual({ session_id: sessionId(), message: 'second' })
    expect(Object.keys(bodies[1] as object)).toEqual(['session_id', 'message'])
  })

  it('Enter sends and Shift+Enter inserts a newline', async () => {
    const backend = mockBackend()
    const { user } = setup()
    const input = screen.getByTestId('chat-input')
    await user.type(input, 'line one{Shift>}{Enter}{/Shift}line two')
    expect(input).toHaveValue('line one\nline two')
    expect(backend.chatCalls()).toHaveLength(0)
    await user.type(input, '{Enter}')
    await waitFor(() => expect(backend.chatCalls()).toHaveLength(1))
    expect((backend.chatCalls()[0]?.body as { message: string }).message).toBe('line one\nline two')
  })

  it('ignores whitespace-only input and over-long messages', async () => {
    const backend = mockBackend()
    const { user } = setup()
    await user.type(screen.getByTestId('chat-input'), '   {Enter}')
    expect(screen.getByTestId('send-button')).toBeDisabled()
    await user.clear(screen.getByTestId('chat-input'))
    await user.click(screen.getByTestId('chat-input'))
    await user.paste('x'.repeat(4001))
    expect(screen.getByTestId('send-button')).toBeDisabled()
    expect(screen.getByText(/too long to send/)).toBeInTheDocument()
    expect(backend.chatCalls()).toHaveLength(0)
  })
})

describe('assistant metadata', () => {
  it('renders every metadata field from the backend response', async () => {
    mockBackend({
      onChat: (c) =>
        chatOk((c.body as { session_id: string }).session_id, 'Paris.', {
          resolution_source: 'LIVE_INFERENCE',
          model: 'gemini/gemini-2.0-flash',
          latency_ms: 812,
          input_tokens: 42,
          output_tokens: 9,
        }),
    })
    const { user } = setup()
    await sendMessage(user, 'capital?')
    const msg = await screen.findByTestId('assistant-message')
    const q = within(msg)
    expect(q.getByTestId('meta-source')).toHaveTextContent(/^LIVE_INFERENCE$/)
    expect(q.getByTestId('meta-model')).toHaveTextContent(/^gemini\/gemini-2.0-flash$/)
    expect(q.getByTestId('meta-latency')).toHaveTextContent(/^812 ms$/)
    expect(q.getByTestId('meta-input-tokens')).toHaveTextContent(/^42$/)
    expect(q.getByTestId('meta-output-tokens')).toHaveTextContent(/^9$/)
    expect(q.getByTestId('route-trace')).toHaveTextContent('key_1answered')
  })

  it('shows cache hits distinctly', async () => {
    mockBackend({
      onChat: (c) =>
        chatOk((c.body as { session_id: string }).session_id, 'Paris.', {
          resolution_source: 'LLM_CACHE',
          key_id: null,
          latency_ms: 3,
        }),
    })
    const { user } = setup()
    await sendMessage(user, 'capital?')
    const msg = await screen.findByTestId('assistant-message')
    expect(within(msg).getByTestId('meta-source')).toHaveTextContent(/^LLM_CACHE$/)
    expect(within(msg).getByTestId('route-trace')).toHaveTextContent('Served from cache')
  })

  it('shows the failover route and details', async () => {
    mockBackend({
      onChat: (c) =>
        chatOk((c.body as { session_id: string }).session_id, 'Paris.', {
          key_id: 'key_2',
          fallback_attempts: 1,
          attempts: [{ key_id: 'key_1', status: 429, reason: 'rate_limit', simulated: true }],
        }),
    })
    const { user } = setup()
    await sendMessage(user, 'capital?')
    const msg = await screen.findByTestId('assistant-message')
    expect(within(msg).getByTestId('route-trace')).toHaveTextContent('key_1429rate limited (simulated)')
    await user.click(within(msg).getByRole('button', { name: /details/i }))
    const details = within(msg).getByTestId('meta-details')
    expect(details).toHaveTextContent('key_2')
    expect(details).toHaveTextContent('key_1 failed with 429')
  })

  it('copies the reply text', async () => {
    mockBackend()
    const { user } = setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    await sendMessage(user, 'copy me')
    const msg = await screen.findByTestId('assistant-message')
    await user.click(within(msg).getByRole('button', { name: 'Copy reply' }))
    expect(writeText).toHaveBeenCalledWith('Answer to: copy me')
    expect(await within(msg).findByRole('button', { name: 'Reply copied' })).toBeInTheDocument()
  })
})

describe('loading state', () => {
  it('shows a loading indicator and blocks sending while waiting', async () => {
    const pending = deferred<{ status: number; body: unknown }>()
    const backend = mockBackend({ onChat: () => pending.promise })
    const { user } = setup()
    await sendMessage(user, 'slow question')
    expect(await screen.findByTestId('loading-indicator')).toBeInTheDocument()
    await user.type(screen.getByTestId('chat-input'), 'another{Enter}')
    expect(screen.getByTestId('send-button')).toBeDisabled()
    expect(backend.chatCalls()).toHaveLength(1)

    pending.resolve(chatOk(sessionId(), 'done'))
    expect(await screen.findByTestId('assistant-message')).toHaveTextContent('done')
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
    expect(screen.getByTestId('send-button')).toBeEnabled()
  })
})

describe('error handling', () => {
  it('503 shows a readable error and does not record a successful turn', async () => {
    mockBackend({ onChat: () => ({ status: 503, body: { detail: 'all providers unavailable' } }) })
    const { user } = setup()
    await sendMessage(user, 'hello')
    const err = await screen.findByTestId('chat-error')
    expect(err).toHaveTextContent('All providers unavailable')
    expect(err).toHaveTextContent('Every API key failed')
    expect(err).toHaveAttribute('data-error-kind', 'unavailable')
    expect(screen.queryAllByTestId('assistant-message')).toHaveLength(0)
    expect(screen.getByTestId('user-message')).toHaveTextContent('Not sent')
    // the sidebar shows no stored replies for this chat
    expect(within(screen.getByTestId('chat-list')).queryByLabelText(/replies/)).not.toBeInTheDocument()
  })

  it('422 shows the backend validation detail safely', async () => {
    mockBackend({
      onChat: () => ({
        status: 422,
        body: {
          detail: [{ type: 'value_error', loc: ['body', 'message'], msg: 'Value error, <b>message</b> must not be empty' }],
        },
      }),
    })
    const { user } = setup()
    await sendMessage(user, 'x')
    const err = await screen.findByTestId('chat-error')
    expect(err).toHaveTextContent('Message not accepted')
    expect(err).toHaveTextContent('message: <b>message</b> must not be empty')
    expect(err.querySelector('b')).toBeNull() // rendered as text, never HTML
  })

  it('network failure explains the API is unreachable', async () => {
    mockBackend({ onChat: () => 'network-error' })
    const { user } = setup()
    await sendMessage(user, 'hello')
    expect(await screen.findByTestId('chat-error')).toHaveTextContent('Cannot reach the server')
  })

  it('an unexpected payload is reported, not rendered', async () => {
    mockBackend({ onChat: () => ({ status: 200, body: { reply: 'missing metadata' } }) })
    const { user } = setup()
    await sendMessage(user, 'hello')
    expect(await screen.findByTestId('chat-error')).toHaveTextContent('Unexpected response')
    expect(screen.queryAllByTestId('assistant-message')).toHaveLength(0)
  })

  it('500 reports a server error', async () => {
    mockBackend({ onChat: () => ({ status: 500, body: { detail: 'internal server error' } }) })
    const { user } = setup()
    await sendMessage(user, 'hello')
    expect(await screen.findByTestId('chat-error')).toHaveTextContent('Server error (500)')
  })
})

describe('retry', () => {
  it('resends the failed message and replaces the error with the reply', async () => {
    let attempt = 0
    const backend = mockBackend({
      onChat: (c) => {
        attempt += 1
        return attempt === 1
          ? { status: 503, body: { detail: 'all providers unavailable' } }
          : chatOk((c.body as { session_id: string }).session_id, 'Recovered answer')
      },
    })
    const { user } = setup()
    await sendMessage(user, 'please work')
    await user.click(await screen.findByTestId('retry-button'))

    expect(await screen.findByTestId('assistant-message')).toHaveTextContent('Recovered answer')
    expect(screen.queryByTestId('chat-error')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('user-message')).toHaveLength(1)
    expect(screen.getByTestId('user-message')).not.toHaveTextContent('Not sent')
    const bodies = backend.chatCalls().map((c) => c.body)
    expect(bodies[0]).toEqual(bodies[1])
  })
})

describe('system prompt', () => {
  it('sends system_prompt (trimmed) when set, and omits it when empty', async () => {
    const backend = mockBackend()
    const { user } = setup()
    await user.type(screen.getByTestId('system-prompt-input'), '  You are a pirate.  ')
    await sendMessage(user, 'ahoy')
    await screen.findByTestId('assistant-message')
    expect(backend.chatCalls()[0]?.body).toEqual({
      session_id: sessionId(),
      message: 'ahoy',
      system_prompt: 'You are a pirate.',
    })

    await user.click(screen.getByRole('button', { name: /chat settings/i }))
    await user.clear(screen.getByTestId('system-prompt-input'))
    await sendMessage(user, 'again')
    await waitFor(() => expect(backend.chatCalls()).toHaveLength(2))
    expect(backend.chatCalls()[1]?.body).not.toHaveProperty('system_prompt')
  })

  it('collapses after the first message and can be reopened', async () => {
    mockBackend()
    const { user } = setup()
    expect(screen.getByTestId('system-prompt-input')).toBeInTheDocument()
    await sendMessage(user, 'hi')
    await screen.findByTestId('assistant-message')
    expect(screen.queryByTestId('system-prompt-input')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /chat settings/i }))
    expect(screen.getByTestId('system-prompt-input')).toBeInTheDocument()
  })
})

describe('failure simulation', () => {
  it('sends the selected scenario as X-Simulate-Failure', async () => {
    const backend = mockBackend()
    const { user } = setup()
    await user.click(await screen.findByTestId('simulation-k1-429'))
    await sendMessage(user, 'fail over please')
    await waitFor(() => expect(backend.chatCalls()).toHaveLength(1))
    expect(backend.chatCalls()[0]?.headers['X-Simulate-Failure']).toBe('key_1=429')
  })

  it.each([
    ['simulation-k1-429-k2-500', 'key_1=429,key_2=500'],
    ['simulation-all-429', '*=429'],
  ])('scenario %s sends %s', async (testId, header) => {
    const backend = mockBackend({ onChat: () => ({ status: 503, body: { detail: 'all providers unavailable' } }) })
    const { user } = setup()
    await user.click(await screen.findByTestId(testId))
    await sendMessage(user, 'x')
    await screen.findByTestId('chat-error')
    expect(backend.chatCalls()[0]?.headers['X-Simulate-Failure']).toBe(header)
  })

  it('is hidden when the backend has simulation disabled', async () => {
    const backend = mockBackend({ health: { status: 200, body: { ...HEALTH_OK, failure_simulation_enabled: false } } })
    const { user } = setup()
    await waitFor(() => expect(screen.getByTestId('health-status')).toHaveTextContent('API connected'))
    expect(screen.queryByTestId('simulation-k1-429')).not.toBeInTheDocument()
    await sendMessage(user, 'x')
    await screen.findByTestId('assistant-message')
    expect(backend.chatCalls()[0]?.headers['X-Simulate-Failure']).toBeUndefined()
  })

  it('is hidden when the backend is unreachable', async () => {
    mockBackend({ health: 'network-error' })
    setup()
    await screen.findByTestId('health-banner')
    expect(screen.queryByText('Failure simulation')).not.toBeInTheDocument()
  })
})

describe('chats and message history', () => {
  it('New chat starts a new session; the next request uses the new id', async () => {
    const backend = mockBackend()
    const { user } = setup()
    const first = sessionId()
    await sendMessage(user, 'in the first chat')
    await screen.findByTestId('assistant-message')
    await user.click(screen.getByTestId('new-chat-button'))
    const second = sessionId()
    expect(second).not.toBe(first)
    expect(second).toMatch(SESSION_RE)
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    await sendMessage(user, 'in the second chat')
    await screen.findByTestId('assistant-message')
    expect((backend.chatCalls()[1]?.body as { session_id: string }).session_id).toBe(second)
    expect(within(screen.getByTestId('chat-list')).getAllByRole('button')).toHaveLength(2)
  })

  it('reopening a chat loads its history from the server', async () => {
    let firstSession = ''
    const backend = mockBackend({
      onHistory: () => ({
        status: 200,
        body: {
          session_id: firstSession,
          messages: [
            { role: 'user', content: 'Stored question', created_at: '2026-11-21T10:00:00.000Z' },
            {
              role: 'assistant',
              content: 'Stored **answer**',
              created_at: '2026-11-21T10:00:01.000Z',
              metadata: { resolution_source: 'LLM_CACHE', model: 'gemini/gemini-2.0-flash', latency_ms: 4, input_tokens: 12, output_tokens: 5, key_id: null, fallback_attempts: 0 },
            },
          ],
        },
      }),
    })
    const { user } = setup()
    firstSession = sessionId()
    await sendMessage(user, 'Stored question')
    await screen.findByTestId('assistant-message')
    await user.click(screen.getByTestId('new-chat-button'))
    await user.click(within(screen.getByTestId('chat-list')).getByRole('button', { name: /Stored question/ }))

    await waitFor(() => expect(backend.historyCalls()).toHaveLength(1))
    expect(backend.historyCalls()[0]?.path).toBe(`/sessions/${firstSession}/messages`)
    const msg = await screen.findByText('answer')
    const article = msg.closest('[data-testid="assistant-message"]') as HTMLElement
    expect(within(article).getByTestId('meta-source')).toHaveTextContent('LLM_CACHE')
    expect(within(article).getByTestId('meta-input-tokens')).toHaveTextContent('12')
    expect(within(article).getByTestId('meta-output-tokens')).toHaveTextContent('5')
    expect(sessionId()).toBe(firstSession)
  })

  it('partial history metadata renders a dash instead of invented values', async () => {
    let sid = ''
    mockBackend({
      onHistory: () => ({
        status: 200,
        body: {
          session_id: sid,
          messages: [
            { role: 'user', content: 'q' },
            { role: 'assistant', content: 'a', metadata: { resolution_source: 'LIVE_INFERENCE', input_tokens: 42, output_tokens: 9 } },
          ],
        },
      }),
    })
    const { user } = setup()
    sid = sessionId()
    await sendMessage(user, 'q')
    await screen.findByTestId('assistant-message')
    await user.click(screen.getByTestId('new-chat-button'))
    await user.click(within(screen.getByTestId('chat-list')).getByRole('button', { name: /^q/ }))
    await waitFor(() => expect(screen.getByTestId('meta-model')).toHaveTextContent('—'))
    expect(screen.getByTestId('meta-latency')).toHaveTextContent('—')
    expect(screen.getByTestId('meta-input-tokens')).toHaveTextContent('42')
  })

  it('a history error keeps the local copy and says so', async () => {
    mockBackend({ onHistory: () => ({ status: 500, body: { detail: 'internal server error' } }) })
    const { user } = setup()
    await sendMessage(user, 'keep me')
    await screen.findByTestId('assistant-message')
    await user.click(screen.getByTestId('new-chat-button'))
    await user.click(within(screen.getByTestId('chat-list')).getByRole('button', { name: /keep me/ }))
    expect(await screen.findByTestId('history-error')).toBeInTheDocument()
    expect(screen.getByTestId('assistant-message')).toHaveTextContent('Answer to: keep me')
  })
})

describe('responsive layout', () => {
  it('the mobile drawer opens and closes', async () => {
    mockBackend()
    const { user } = setup()
    const sidebar = screen.getByTestId('sidebar')
    expect(sidebar).toHaveAttribute('data-open', 'false')
    expect(sidebar.className).toContain('-translate-x-full')
    expect(sidebar.className).toContain('md:translate-x-0') // always visible from md up
    await user.click(screen.getByTestId('open-sidebar'))
    expect(sidebar).toHaveAttribute('data-open', 'true')
    expect(screen.getByTestId('open-sidebar')).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('button', { name: 'Close chats' }))
    expect(sidebar).toHaveAttribute('data-open', 'false')
  })

  it('choosing New chat on mobile closes the drawer', async () => {
    mockBackend()
    const { user } = setup()
    await sendMessage(user, 'hi')
    await screen.findByTestId('assistant-message')
    await user.click(screen.getByTestId('open-sidebar'))
    await user.click(screen.getByTestId('new-chat-button'))
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-open', 'false')
  })
})
