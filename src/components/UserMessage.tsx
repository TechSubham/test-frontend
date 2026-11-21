import { CircleAlert } from 'lucide-react'
import type { UserMessage as UserMessageT } from '../hooks/chatState'

export function UserMessage({ message }: { message: UserMessageT }) {
  return (
    <div className="flex flex-col items-end gap-1" data-testid="user-message">
      <p
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-xl rounded-br-sm bg-ink-900 px-4 py-2.5 text-[0.95rem] leading-relaxed text-white sm:max-w-[75%] ${
          message.status === 'pending' ? 'opacity-80' : ''
        } ${message.status === 'failed' ? 'ring-2 ring-fail/40' : ''}`}
      >
        {message.content}
      </p>
      {message.status === 'failed' && (
        <span className="inline-flex items-center gap-1 text-xs text-fail">
          <CircleAlert className="size-3.5" aria-hidden />
          Not sent
        </span>
      )}
    </div>
  )
}
