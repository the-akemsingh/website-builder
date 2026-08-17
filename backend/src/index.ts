import express from 'express'
import cors from 'cors'
import RandomIdGenerator from './utils/randomIdGenerator';
import { config } from './config';
import { getProjectTemplate, invokeLLM } from './ai/client';
import { node } from './templates/nodejs/template';
import { next } from './templates/nextjs/template';
import { SandboxContainerManager } from './sandbox/sandboxContainerManager';
import createFileStructure from './sandbox/createFileStructureInContainer';
import { getAiTools } from './ai/tools';
import getProjectPort from './utils/getProjectPort';
import { ChatHistory } from './memory/chatHistory';

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

// IN-FUTURE: we have to eventually move to websockets to stream llm reponse and logs - as we can face server timeout problem and also cant hang request for too long

app.post("/chat", async (req, res) => {
    try {
        let { prompt, projectId } = req.body;
        if (!prompt) {
            res.sendStatus(400)
            return
        }

        const chatHistoryManager = ChatHistory.getInstance()
        const isNewChat = !projectId || !chatHistoryManager.getChat(projectId);

        if (isNewChat) {
            projectId = RandomIdGenerator();
            const templateName = await getProjectTemplate(prompt);
            const template = templateName === "node" ? node : next

            chatHistoryManager.createChat(projectId, templateName as 'node' | "next")
            const containerManager = SandboxContainerManager.getInstance();
            const PORT = getProjectPort(templateName)
            const projectContainer = await containerManager.createContainer(projectId, PORT)
            await createFileStructure(projectContainer, template)
            const tools = getAiTools(projectId);
            const { response, newHistory } = await invokeLLM(prompt, tools, [], template)

            for (const content of newHistory) {
                chatHistoryManager.addMessage(projectId, content)
            }

            res.send({ projectId, response })
            return;
        }

        const tools = getAiTools(projectId);
        const chatHistory = chatHistoryManager.getChat(projectId)!.history;
        const { response, newHistory } = await invokeLLM(prompt, tools, chatHistory)

        for (const content of newHistory) {
            chatHistoryManager.addMessage(projectId, content)
        }

        res.send({ projectId, response })
        return;

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