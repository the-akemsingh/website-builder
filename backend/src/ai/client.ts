import { GoogleGenAI } from '@google/genai';
import { config } from '../config';

const llmClient = new GoogleGenAI({
    apiKey: config.get("geminiApiKey")
});

//prompt to find which template will be used
async function getProjectTemplate(prompt: string): Promise<string> {
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
            return response.text;
        }
        return "";
    } catch (error) {
        console.error("Error generating content:", error);
        return ""
    }
}

//the real project builder function 
async function invokeLLMWithTools(userPrompt: string, template: string, tools: string) {
    try {

    } catch (error) {
        console.error("Error generating content:", error);
        return;
    }
}

export default getProjectTemplate;