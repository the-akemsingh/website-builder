import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../types'
import { ProcessingLoader } from './ProcessingLoader'

interface ChatPanelProps {
  messages: ChatMessage[]
  isPending: boolean
  error: string | null
  projectId: string | null
  onSend: (prompt: string) => void
  onClear: () => void
}

export function ChatPanel({
  messages,
  isPending,
  error,
  projectId,
  onSend,
  onClear,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isPending])

  function submitPrompt() {
    if (!input.trim() || isPending) return
    onSend(input)
    setInput('')
  }

  return (
    <aside className="chat">
      <header className="chat__header">
        <div>
          <p className="chat__brand">Forge</p>
          <p className="chat__subtitle">Describe a site. Watch it build.</p>
        </div>
        <button
          type="button"
          className="chat__clear"
          onClick={onClear}
          disabled={isPending || messages.length === 0}
        >
          New chat
        </button>
      </header>

      {projectId && (
        <p className="chat__project-id" title={projectId}>
          Project · {projectId.slice(0, 8)}…
        </p>
      )}

      <div className="chat__messages">
        {messages.length === 0 && !isPending && (
          <div className="chat__empty">
            <p>Start with something like:</p>
            <button
              type="button"
              className="chat__suggestion"
              onClick={() =>
                onSend('Build a landing page for a coffee shop with a menu section')
              }
            >
              Landing page for a coffee shop
            </button>
            <button
              type="button"
              className="chat__suggestion"
              onClick={() =>
                onSend('Create a Next.js portfolio site with projects and contact form')
              }
            >
              Next.js portfolio with contact form
            </button>
          </div>
        )}

        {messages.map((msg) => (
          <article
            key={msg.id}
            className={`bubble bubble--${msg.role}`}
          >
            <span className="bubble__label">
              {msg.role === 'user' ? 'You' : 'Forge'}
            </span>
            <p className="bubble__text">{msg.content}</p>
          </article>
        ))}

        {isPending && <ProcessingLoader />}
        {error && <p className="chat__error">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <form
        className="chat__composer"
        onSubmit={(e) => {
          e.preventDefault()
          submitPrompt()
        }}
      >
        <textarea
          className="chat__input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Forge to build or change your site…"
          rows={3}
          disabled={isPending}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submitPrompt()
            }
          }}
        />
        <button
          type="submit"
          className="chat__send"
          disabled={isPending || !input.trim()}
        >
          {isPending ? 'Building…' : 'Send'}
        </button>
      </form>
    </aside>
  )
}
