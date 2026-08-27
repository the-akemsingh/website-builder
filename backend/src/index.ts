import express from 'express'
import cors from 'cors'
import RandomIdGenerator from './utils/randomIdGenerator';
import { config } from './config';
import { getProjectTemplate, invokeLLM } from './ai/client';
import { node } from './templates/nodejs/template';
import { next } from './templates/nextjs/template';
import { SandboxContainerManager } from './sandbox/sandboxContainerManager';
import createFileStructure from './sandbox/createFileStructureInContainer';
import getProjectPort from './utils/getProjectPort';
import { ChatHistory } from './memory/chatHistory';
import WebSocket, { WebSocketServer } from 'ws';
import handleChatMessage from './handleChatMessage';

const app = express();
app.use(express.json())
app.use(cors());

const PORT = config.get("apiServerPort");
const PROJECTS_BASE_URL = config.get("projectsBaseUrl");

try {
    config.validate();
} catch (error) {
    console.error('Configuration error:', error);
    process.exit(1);
}

const httpServer = app.listen(PORT, () => {
    console.log("api server running on port - ", PORT)
})

const wss = new WebSocketServer({
    server: httpServer
})

wss.on("connection", (socket: WebSocket, request: import('http').IncomingMessage) => {
    console.log("A new client connected")
    const url = new URL(request.url ?? '', `http://${request.headers.host}`)
    const projectId = url.searchParams.get('projectId')
    if (!projectId) {
        console.log("WebSocket connection rejected: missing projectId")
        socket.close(1008, "Missing projectId")
        return
    }

    socket.on("message", async (message: string) => {
        try {
            const data = JSON.parse(message)
            if (data.type === 'chat' && data.prompt) {
                await handleChatMessage(socket, projectId, data.prompt)
            } else {

                socket.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }))
            }
        } catch (e) {
            console.error("Error parsing WebSocket message:", e)
            socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }))
        }
    })

    socket.on("close", () => {
        console.log(`A client disconnected: ${projectId}`)
    })
    socket.on("error", (error) => {
        console.log("error occured in websocket server : ", error)
    })
})

// only for creating new chats
app.post("/chat", async (req, res) => {
    try {
        let { prompt } = req.body;
        if (!prompt) {
            res.sendStatus(400)
            return
        }
        const chatHistoryManager = ChatHistory.getInstance()

        const projectId = RandomIdGenerator();
        const templateName = await getProjectTemplate(prompt);
        const template = templateName === "node" ? node : next

        chatHistoryManager.createChat(projectId, templateName as 'node' | "next")

        const containerManager = SandboxContainerManager.getInstance();
        const port = getProjectPort(templateName)
        const { projectContainer, hostPort } = await containerManager.createContainer(projectId, port)

        await createFileStructure(projectContainer, template)

        await containerManager.startDevServer(projectId)
        setTimeout(() => {
            containerManager.stopDevServer(projectId);
        }, 30 * 60 * 1000);

        res.send({ projectId, projectUrl: `${PROJECTS_BASE_URL}:${hostPort}` })
        return;

    } catch (e) {
        console.log("error in chat endpoint", e)
        res.sendStatus(500);
        return;
    }
})

app.get("/health", (_req, res) => {
    res.sendStatus(200);
    return
})