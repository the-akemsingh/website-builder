import type WebSocket from "ws"
import { invokeLLM } from "./ai/client"
import { getAiTools } from "./ai/tools"
import { ChatHistory } from "./memory/chatHistory"

async function handleChatMessage(socket: WebSocket, projectId: string, prompt: string) {
    try {
        const chatHistoryManager = ChatHistory.getInstance()
        let chat = chatHistoryManager.getChat(projectId)
        if (!chat) {
            socket.send(JSON.stringify({ type: 'error', message: 'Chat not found.' }))
            return
        }

        const tools = getAiTools(projectId)
        const chatHistory = chat!.history;
        const template = chat!.templateName as string | undefined;

        socket.send(JSON.stringify({ type: 'log', message: 'Starting AI processing...' }))

        const { response, newHistory } = await invokeLLM(prompt, tools, chatHistory, template, (event) => {
            socket.send(JSON.stringify(event))
        })

        for (const content of newHistory) {
            chatHistoryManager.addMessage(projectId, content)
        }
        socket.send(JSON.stringify({ type: 'final', response }))

    } catch (e) {
        console.log("error in chat websocket", e)
        socket.send(JSON.stringify({ type: 'error', message: 'Internal server error' }))
    }
}

export default handleChatMessage