import express from 'express'
import cors from 'cors'
import { config } from './config';
import WebSocket, { WebSocketServer } from 'ws';
import chatRouter from './routers/chatRouter';
import socketMessageHandler from './ws/socketMessageHandler';
import authRouter from './routers/authRouter';
import authentication from './middleware/auth';

const app = express();
app.use(express.json())
app.use(cors());

const PORT = config.get("apiServerPort");


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

//todo: also need to authenticate user before establishing ws connection
wss.on("connection", (socket: WebSocket, request: import('http').IncomingMessage) => {
    socketMessageHandler(socket, request)
})

app.use("/api/v1/auth/google", authRouter)
app.use("/api/v1/website", authentication, chatRouter)
app.get("/api/v1/health", (_req, res) => {
    res.sendStatus(200);
    return
})