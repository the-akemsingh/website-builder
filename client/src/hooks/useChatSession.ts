import { useCallback, useEffect, useState } from 'react'
import { sendChatMessage } from '../api/chat'
import type { ChatMessage, ChatSession } from '../types'

const STORAGE_KEY = 'website-builder-chat-session'

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function loadSession(): ChatSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { projectId: null, projectUrl: null, messages: [] }
    }
    return JSON.parse(raw) as ChatSession
  } catch {
    return { projectId: null, projectUrl: null, messages: [] }
  }
}

export function useChatSession() {
  const [session, setSession] = useState<ChatSession>(loadSession)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  }, [session])

  const sendMessage = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim()
      if (!trimmed || isPending) return

      const userMessage: ChatMessage = {
        id: createId(),
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
      }

      setSession((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }))
      setIsPending(true)
      setError(null)

      try {
        const data = await sendChatMessage(trimmed, session.projectId)
        const assistantMessage: ChatMessage = {
          id: createId(),
          role: 'assistant',
          content:
            typeof data.response === 'string'
              ? data.response
              : JSON.stringify(data.response),
          createdAt: Date.now(),
        }

        setSession((prev) => ({
          projectId: data.projectId ?? prev.projectId,
          projectUrl: data.projectUrl ?? prev.projectUrl,
          messages: [...prev.messages, assistantMessage],
        }))
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong'
        setError(message)
      } finally {
        setIsPending(false)
      }
    },
    [isPending, session.projectId],
  )

  const clearSession = useCallback(() => {
    const empty: ChatSession = {
      projectId: null,
      projectUrl: null,
      messages: [],
    }
    setSession(empty)
    setError(null)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return {
    session,
    isPending,
    error,
    sendMessage,
    clearSession,
  }
}
