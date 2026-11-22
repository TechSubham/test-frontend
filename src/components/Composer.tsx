import { ArrowUp, CornerDownLeft, Sparkles } from 'lucide-react'
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
    <form onSubmit={submit} className="composer-card rounded-[24px] border border-[#e8eaf1] bg-white p-3 shadow-[0_10px_32px_rgba(50,52,79,0.075)] transition focus-within:border-[#c9c5f6] focus-within:shadow-[0_12px_34px_rgba(103,94,204,0.11)] sm:p-4">
      <label htmlFor="chat-input" className="sr-only">
        Message
      </label>
      <div className="flex items-end gap-3">
        <textarea
          id="chat-input"
          ref={textarea}
          data-testid="chat-input"
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask Lyftr anything..."
          aria-describedby="composer-hint"
          aria-invalid={tooLong || undefined}
          className="max-h-[220px] min-h-[4.25rem] flex-1 resize-none bg-transparent px-2 py-2.5 text-[0.95rem] leading-relaxed text-[#303345] outline-none placeholder:text-[#a3a6b3]"
        />
        <button
          type="submit"
          data-testid="send-button"
          disabled={!canSend}
          aria-label="Send message"
          className="mb-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#8278f5] to-[#5e59d7] text-white shadow-[0_5px_14px_rgba(105,96,219,0.25)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-[#ececf2] disabled:bg-none disabled:text-[#a8abb7] disabled:shadow-none"
        >
          <ArrowUp className="size-5" aria-hidden />
        </button>
      </div>
      <div id="composer-hint" className="flex items-center justify-between border-t border-[#f0f1f5] px-2 pb-0.5 pt-2.5 text-[11px] text-[#9a9eac]">
        <span className="inline-flex items-center gap-1.5"><Sparkles className="size-3.5 text-[#8b83eb]" aria-hidden /> Your thoughts, made clearer</span>
        <span className="hidden items-center gap-1 sm:inline-flex"><CornerDownLeft className="size-3" aria-hidden /> Enter to send · Shift + Enter for a new line</span>
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
