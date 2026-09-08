import WebSocket from 'ws';
import handleChatMessage from '../handleChatMessage';
import dbClient from '../prisma/db';

async function socketMessageHandler(socket: WebSocket, request: import('http').IncomingMessage) {
    console.log("A new client connected")
    const url = new URL(request.url ?? '', `http://${request.headers.host}`)
    const websiteId = url.searchParams.get('websiteId')
    if (!websiteId) {
        console.log("WebSocket connection rejected: missing websiteId")
        socket.close(1008, "Missing websiteId")
        return
    }
    const project = await dbClient.Website.first({
        id:websiteId
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