import express from 'express'
import cors from 'cors'
import RandomIdGenerator from './utils/randomIdGenerator';
import { config } from './config';
import { getProjectTemplate, invokeLLMWithTools } from './ai/client';
import { node } from './templates/nodejs/template';
import { next } from './templates/nextjs/template';
import { SandboxContainerManager } from './sandbox/sandboxContainerManager';
import createFileStructure from './sandbox/createFileStructureInContainer';
import { getAiTools } from './ai/tools';

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
        const projectId = RandomIdGenerator();
        const templateName = await getProjectTemplate(prompt);
        const template = templateName === "node" ? node : next

        const containerManager = SandboxContainerManager.getInstance();
        const projectContainer = await containerManager.createContainer(projectId)
        await createFileStructure(projectContainer, template)
        const tools = getAiTools(projectId);

        const response = await invokeLLMWithTools(prompt, template, tools)
        res.send({ response })
        return;

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