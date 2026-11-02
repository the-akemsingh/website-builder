import express from 'express'
import cors from 'cors'
import { config } from './config';
import WebSocket, { WebSocketServer } from 'ws';
import chatRouter from './routers/chatRouter';
import socketMessageHandler from './ws/socketMessageHandler';
import authRouter from './routers/authRouter';
import authentication from './middleware/auth';
import billingRouter, { webhookHandler } from './routers/billingRouter';

const app = express();
app.use(cors());

const PORT = config.get("apiServerPort");


try {
    config.validate();
} catch (error) {
    console.error('Configuration error:', error);
    process.exit(1);
}

// Capture raw body for webhook signature verification
app.use('/api/v1/webhooks', express.json({
    verify: (req: any, _res, buf) => {
        req.rawBody = buf;
    },
}));
app.post('/api/v1/webhooks/:provider', webhookHandler);

app.use(express.json())

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
app.use("/api/v1/billing", billingRouter)
app.get("/api/v1/health", (_req, res) => {
    res.sendStatus(200);
    return
})
