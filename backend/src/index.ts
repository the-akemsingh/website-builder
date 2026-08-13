import express from 'express'
import cors from 'cors'
import RandomIdGenerator from './utils/randomIdGenerator';
import { config } from './config';
import getProjectTemplate from './ai/client';
import { node } from './templates/nodejs/template';
import { next } from './templates/nextjs/template';

const app = express();
app.use(express.json())
app.use(cors());

try {
    config.validate();
} catch (error) {
    console.error('Configuration error:', error);
    process.exit(1);
}

app.get("/health", (req, res) => {
    res.sendStatus(200);
    return
})

app.post("/new-chat", async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) {
            res.sendStatus(400)
            return
        }
        const chatId = RandomIdGenerator();
        const templateName = await getProjectTemplate(prompt);
        const template = templateName === "node" ? node : "next"

        //1 first start a container using node:22 image   

        //2 generate template files in container

        //3 write methods to manipulate files inside container

        //4 expose methods as tools for llm :
        // explore this : 
        // Closure/scope — when setting up the AI tools for a chat session, wrap them so chatId is already bound. The AI doesn't need to know about it:
        // he AI agent only deals with relative paths, and the chatId scoping is handled transparently on your server side. This also prevents the AI from accidentally (or hallucinating) accessing another user's project.
        // example : // In your chat handler, bind chatId once:
        // const tools = {
        //     getFileContent: (path: string) => getFileContent(chatId, path),
        //     writeFileContent: (path: string, content: string) => writeFileContent(chatId, path, content),
        //     // ...
        // }

        //5 send ai the template,ai tools,user prompt :
        // llm will not get the projectId - it only returns in reponse the tool_name: we handle the projectId
    } catch (e) {
        console.log("error in chat endpoint", e)
        res.sendStatus(500);
        return;
    }
})

app.post("/chat/:chatId", async (req, res) => {
    try {
        const { prompt } = req.body;
        const { chatId } = req.params
        if (!prompt || chatId) {
            res.sendStatus(400)
            return
        }

    } catch (e) {
        console.log("error in chat endpoint", e)
        res.sendStatus(500);
        return;
    }
})

const PORT = config.get("apiServerPort");
app.listen(PORT, () => {
    console.log("api server running on port - ", PORT)
})