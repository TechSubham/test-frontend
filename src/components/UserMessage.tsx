import { CircleAlert } from 'lucide-react'
import type { UserMessage as UserMessageT } from '../hooks/chatState'

export function UserMessage({ message }: { message: UserMessageT }) {
  return (
    <div className="flex flex-col items-end gap-1" data-testid="user-message">
      <p
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-[20px] rounded-br-md bg-gradient-to-br from-[#7770df] to-[#5f59c9] px-4 py-3 text-[0.95rem] leading-relaxed text-white shadow-[0_4px_12px_rgba(91,83,189,0.13)] sm:max-w-[75%] ${
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
