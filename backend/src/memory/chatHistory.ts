import type { Content } from "@google/genai"
import type IChatSession from "../types/IChatSession"

export class ChatHistory {
    private static instance: ChatHistory
    private chats: Map<string, IChatSession>

    constructor() {
        this.chats = new Map()
    }

    public static getInstance() {
        if (!ChatHistory.instance) {
            ChatHistory.instance = new ChatHistory()
        }

        return ChatHistory.instance
    }

    getChat(projectId: string): IChatSession | undefined {
        return this.chats.get(projectId)
    }

    
    //Add a message to the chat history.
    // Accepts full Content type to support text, functionCall, and functionResponse parts.
    //
    addMessage(projectId: string, content: Content) {
        const chatSession = this.chats.get(projectId)
        if (!chatSession) return;
        chatSession.history.push(content)
    }

    //Get the full chat history for a project.
    getHistory(projectId: string): Content[] {
        return this.chats.get(projectId)?.history ?? []
    }

    createChat(projectId: string, templateName: "node" | "next") {
        this.chats.set(projectId, { projectId, history: [], templateName })
    }

    deleteChat(projectId: string) {
        this.chats.delete(projectId)
    }
}