import WebSocket from 'ws';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import handleChatMessage from '../handleChatMessage';
import dbClient from '../prisma/db';
import { config } from '../config';

async function socketMessageHandler(socket: WebSocket, request: import('http').IncomingMessage) {
    console.log("A new client connected")
    const url = new URL(request.url ?? '', `http://${request.headers.host}`)
    const websiteId = url.searchParams.get('websiteId')
    const token = url.searchParams.get('token')
    if (!websiteId || !token) {
        console.log("WebSocket connection rejected: missing credentials")
        socket.close(1008, "Missing websiteId")
        return
    }

    let userId: string;
    try {
        const payload = jwt.verify(token, config.get("jwtSecret")) as JwtPayload;
        if (typeof payload.userId !== "string") throw new Error("Missing userId");
        userId = payload.userId;
    } catch {
        console.log("WebSocket connection rejected: invalid token")
        socket.close(1008, "Invalid token")
        return
    }

    const project = await dbClient.Website.first({
        id: websiteId,
        userId,
    })
    if(!project){
        console.log("WebSocket connection rejected: invalid websiteId")
        socket.close(1008, "Invalid websiteId")
        return
    }
    socket.on("message", async (message: string) => {
        try {
            const data = JSON.parse(message)
            if (data.type === 'chat' && data.prompt) {
                await handleChatMessage(socket, websiteId, data.prompt)
            } else {
                socket.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }))
            }
        } catch (e) {
            console.error("Error parsing WebSocket message:", e)
            socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }))
        }
    })

    socket.on("close", () => {
        console.log(`A client disconnected: ${websiteId}`)
    })
    socket.on("error", (error) => {
        console.log("error occured in websocket server : ", error)
    })
}

export default socketMessageHandler