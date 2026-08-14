import { GoogleGenAI } from '@google/genai';
import { config } from '../config';
import type { ITool } from '../types/ITool';

const llmClient = new GoogleGenAI({
    apiKey: config.get("geminiApiKey")
});

//prompt to find which template will be used
export async function getProjectTemplate(prompt: string): Promise<string> {
    try {
        const response = await llmClient.models.generateContent({
            model: "gemini-2.5-flash",
            contents:
                `
                Choose the appropriate project template for the user's request.

                Available templates:

                node:
                A Node.js + TypeScript + Express application.
                Use this for backend APIs, servers, REST APIs, webhooks, server-side logic,
                or applications that primarily require a Node.js backend.

                next:
                A Next.js + TypeScript frontend application.
                Use this for websites, landing pages, dashboards, portfolios, ecommerce
                frontends, and other user-facing web applications.

                User request:
                ${prompt}

                Return exactly one word:
                node
                or
                next
            `
            ,
            config: {
                systemInstruction:
                    `
                You are a project template classifier.
                You have exactly two possible outputs:
                node
                next
                Your response MUST contain exactly one of these values.
                Do not provide an explanation.
                Do not provide punctuation.
                Do not use JSON.
                Do not use markdown.
                Do not include whitespace or text before or after the value.
            `
            }
        });
        if (response.text) {
            return response.text.toLowerCase().trim();
        }
        return "";
    } catch (error) {
        console.error("Error generating content:", error);
        return ""
    }
}

//the real project builder function 
//we can implement custom loop to stream intermediate progress to client side - we have to use ws or sse
//we are not saving history right now
export async function invokeLLMWithTools(userPrompt: string, template: string, tools: ITool[]) {
    try {
        const geminiTools = tools.map(t => ({
            functionDeclarations: [t.declaration],
            functions: { [t.declaration.name]: t.execute }
        }));
        const chat = llmClient.chats.create({
            model: "gemini-2.5-flash",
            config: {
                systemInstruction: `You are a website builder AI. You are working inside a Docker container at /workspace.
Use the provided tools to read, write, and delete files to build the user's requested website.
The project template is already set up. Use readFile to check existing files before modifying them.
Always use writeFile to create or update files.`,
                tools: geminiTools
            }
        })

        const response = await chat.sendMessage({ message: userPrompt });

        return response.text || "";
    } catch (error) {
        console.error("Error generating content:", error);
        return;
    }
}