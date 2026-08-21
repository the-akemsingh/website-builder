export type MessageRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  createdAt: number
}

export interface ChatSession {
  projectId: string | null
  projectUrl: string | null
  messages: ChatMessage[]
}

export interface ChatApiResponse {
  projectId?: string
  response: string
  projectUrl?: string
}
