import type WebSocket from "ws"
import { invokeLLM } from "./ai/client"
import { getAiTools } from "./ai/tools"
import { ChatHistory } from "./memory/chatHistory"
import dbClient from "./prisma/db"
import { contentToDbMessage, dbMessageToContent } from "./utils/chatHistoryConverter"
import RandomIdGenerator from "./utils/randomIdGenerator"
import { node } from "./templates/nodejs/template"
import { next } from "./templates/nextjs/template"
import { SandboxContainerManager } from "./sandbox/sandboxContainerManager"

async function handleChatMessage(socket: WebSocket, websiteId: string, prompt: string) {
    try {
        // const chatHistoryManager = ChatHistory.getInstance()
        // let chat = chatHistoryManager.getChat(websiteId)
        const sandboxManager = SandboxContainerManager.getInstance()
        await sandboxManager.stopDevServer(websiteId)
        const project = await dbClient.Website.first({
            id: websiteId
        })
        const userMessage = {
            role: "user",
            text: prompt
        }
        await dbClient.Message.create({
            id: RandomIdGenerator(),
            websiteId: websiteId,
            role: userMessage.role,
            text: userMessage.text
        })
        const chatHistory = await dbMessageToContent(websiteId)
        console.log("chat history to content,----", JSON.stringify(chatHistory))
        const tools = getAiTools(websiteId)
        const template = project?.templateName === 'node' ? node : next;

        const { response, newHistory } = await invokeLLM(prompt, tools, chatHistory, template, (event) => {
            socket.send(JSON.stringify(event))
        })
        console.log("new history, -------", JSON.stringify(newHistory))
        const newEntries = newHistory.slice(0, chatHistory.length - 1);
        console.log("new entries,--------", JSON.stringify(newEntries))

        const formattedNewMessages = contentToDbMessage(newEntries, websiteId)
        console.log("formattedNewMessages for db,--------", JSON.stringify(formattedNewMessages))
        await Promise.all(
            formattedNewMessages.map((message) => dbClient.Message.create(message))
        )
        console.log("starting server ")
        await sandboxManager.startDevServer(websiteId)
        console.log("server started")

        setTimeout(() => {
            sandboxManager.stopDevServer(websiteId);
        }, 30 * 60 * 1000);

        socket.send(JSON.stringify({ type: 'final', response }))

    } catch (e) {
        console.log("error in chat websocket", e)
        socket.send(JSON.stringify({ type: 'error', message: 'Internal server error' }))
    }
}

export default handleChatMessage