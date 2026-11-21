import { useEffect, useRef } from 'react'
import type { UiMessage } from '../hooks/chatState'
import { AssistantMessage } from './AssistantMessage'
import { ErrorMessage } from './ErrorMessage'
import { TypingIndicator } from './TypingIndicator'
import { UserMessage } from './UserMessage'

interface Props {
  messages: UiMessage[]
  pending: boolean
  onRetry: (errorId: string) => void
}

export function MessageList({ messages, pending, onRetry }: Props) {
  const end = useRef<HTMLDivElement>(null)

  // Keep the newest message (or the loading indicator) in view.
  useEffect(() => {
    end.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })
  }, [messages.length, pending])

  return (
    <div className="space-y-4" data-testid="message-list" aria-live="polite" aria-relevant="additions">
      {messages.map((m) => {
        switch (m.kind) {
          case 'user':
            return <UserMessage key={m.id} message={m} />
          case 'assistant':
            return <AssistantMessage key={m.id} content={m.content} metadata={m.metadata} />
          case 'error':
            return <ErrorMessage key={m.id} error={m} onRetry={() => onRetry(m.id)} disabled={pending} />
        }
      })}
      {pending && <TypingIndicator />}
      <div ref={end} />
    </div>
  )
}
