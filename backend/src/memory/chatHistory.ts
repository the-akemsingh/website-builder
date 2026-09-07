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

    getChat(websiteId: string): IChatSession | undefined {
        return this.chats.get(websiteId)
    }

    
    //Add a message to the chat history.
    // Accepts full Content type to support text, functionCall, and functionResponse parts.
    //
    addMessage(websiteId: string, content: Content) {
        const chatSession = this.chats.get(websiteId)
        if (!chatSession) return;
        chatSession.history.push(content)
    }

    //Get the full chat history for a project.
    getHistory(websiteId: string): Content[] {
        return this.chats.get(websiteId)?.history ?? []
    }

    createChat(websiteId: string, templateName: "node" | "next") {
        this.chats.set(websiteId, { websiteId, history: [], templateName })
    }

    deleteChat(websiteId: string) {
        this.chats.delete(websiteId)
    }
}