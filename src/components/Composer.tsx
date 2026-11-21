import { ArrowUp } from 'lucide-react'
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { config } from '../config'

export interface ComposerHandle {
  focus: () => void
}

interface Props {
  disabled: boolean
  onSend: (text: string) => void
}

const COUNTER_FROM = 3500

export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ disabled, onSend }, ref) {
  const [value, setValue] = useState('')
  const textarea = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(ref, () => ({ focus: () => textarea.current?.focus() }), [])

  const length = value.trim().length
  const tooLong = length > config.messageMaxChars
  const canSend = !disabled && length > 0 && !tooLong

  // Grow with content up to a cap.
  useLayoutEffect(() => {
    const el = textarea.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`
  }, [value])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!canSend) return
    onSend(value)
    setValue('') // input is empty after sending (contract)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-paper p-2 shadow-[0_2px_12px_rgba(28,43,63,0.06)] focus-within:border-ink-300">
      <label htmlFor="chat-input" className="sr-only">
        Message
      </label>
      <div className="flex items-end gap-2">
        <textarea
          id="chat-input"
          ref={textarea}
          data-testid="chat-input"
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message Lyftr"
          aria-describedby="composer-hint"
          aria-invalid={tooLong || undefined}
          className="max-h-[220px] min-h-[2.75rem] flex-1 resize-none bg-transparent px-3 py-2.5 text-[0.95rem] leading-relaxed text-ink-950 outline-none placeholder:text-ink-500"
        />
        <button
          type="submit"
          data-testid="send-button"
          disabled={!canSend}
          aria-label="Send message"
          className="mb-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-white transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:bg-ink-100 disabled:text-ink-500"
        >
          <ArrowUp className="size-5" aria-hidden />
        </button>
      </div>
      <div id="composer-hint" className="flex items-center justify-between px-3 pb-0.5 pt-1 text-xs text-muted">
        <span className="hidden sm:inline">Enter to send, Shift + Enter for a new line</span>
        <span className="sm:hidden">Enter to send</span>
        {length >= COUNTER_FROM && (
          <span className={`tabular ${tooLong ? 'font-medium text-fail' : ''}`}>
            {length} / {config.messageMaxChars}
            {tooLong ? ' — too long to send' : ''}
          </span>
        )}
      </div>
    </form>
  )
})
