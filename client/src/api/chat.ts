import type { ChatApiResponse } from '../types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export async function sendChatMessage(
  prompt: string,
  projectId: string | null,
): Promise<ChatApiResponse> {
  const res = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      ...(projectId ? { projectId } : {}),
    }),
  })

  if (!res.ok) {
    throw new Error(`Chat request failed (${res.status})`)
  }

  return res.json() as Promise<ChatApiResponse>
}
