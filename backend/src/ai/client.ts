import { GoogleGenAI, type Content } from '@google/genai';
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
        return "node";
    } catch (error) {
        console.error("Error generating content:", error);
        return "node"
    }
}

//the real project builder function 
//we can implement custom loop to stream intermediate progress to client side - we have to use ws or sse
export async function invokeLLM(
    userPrompt: string,
    tools: ITool[],
    chatHistory: Content[] = [],
    template?: string
): Promise<{ response: string, newHistory: Content[] }> {
    try {
        console.log("inside invokeLLM")
        const geminiTools = [{
            functionDeclarations: tools.map(t => t.declaration)
        }];

        const systemInstruction = template
            ? `You are a website builder AI working inside a Docker container at /workspace.
Use the provided tools (readFile, writeFile, deleteFile,installDependencies) to read, write, delete files and to install dependencies to build the user's requested website.

The project has been scaffolded with the following template:
${template}

Guidelines:
- Always use readFile to inspect existing files before modifying them.
- Use writeFile to create or update files with complete content.
- Use deleteFile to remove files that are no longer needed.
- Use installDependencies to install dependencies.
- Make sure all imports and dependencies are correct.
- Follow the project's existing code style and conventions.`
            : `You are a website builder AI working inside a Docker container at /workspace.
Use the provided tools (readFile, writeFile, deleteFile,installDependencies) to read, write, delete files and to install dependencies to build the user's requested website.

Guidelines:
- Always use readFile to inspect existing files before modifying them.
- Use writeFile to create or update files with complete content.
- Use deleteFile to remove files that are no longer needed.
- Use installDependencies to install dependencies.
- Make sure all imports and dependencies are correct.
- Follow the project's existing code style and conventions.`;

        const chat = llmClient.chats.create({
            model: "gemini-2.5-flash",
            config: {
                systemInstruction,
                tools: geminiTools
            },
            history: chatHistory
        });
        console.log("chat created")
        // Function calling loop: keep executing tools until we get a final text response
        let message: string | any[] = userPrompt;
        let finalResponse: string;
        const MAX_TOOL_ROUNDS = 30; // safety cap so the agent can never loop forever
        let toolRounds = 0;
        while (true) {
            console.log("sending message to chat")
            const response = await chat.sendMessage({ message });
            console.log("response received")
            const parts = response.candidates?.[0]?.content?.parts ?? [];
            const functionCalls = parts.filter(part => part.functionCall).map(part => part.functionCall!);

            // No tool calls - return the final text response
            if (functionCalls.length === 0) {
                console.log("no tool calls - returning final response")
                finalResponse = response.text || "";
                break;
            }

            console.log("tool calls found - executing tools")
            if (++toolRounds > MAX_TOOL_ROUNDS) {
                finalResponse = "Stopped: the agent exceeded the maximum number of tool execution rounds.";
                break;
            }

            // Execute each tool call and collect responses
            const toolResponses: any[] = [];
            for (const fnCall of functionCalls) {
                console.log("executing tool", fnCall.name)
                const tool = tools.find(tool => tool.declaration.name === fnCall.name);
                if (!tool) {
                    toolResponses.push({
                        functionResponse: {
                            name: fnCall.name,
                            response: { error: `Unknown tool: ${fnCall.name}` }
                        }
                    });
                    continue;
                }
                console.log("tool execution started")

                try {
                    const result = await tool.execute(fnCall.args || {});
                    toolResponses.push({
                        functionResponse: {
                            name: fnCall.name,
                            response: { result }
                        }
                    });
                    console.log("tool execution completed")
                } catch (err: any) {
                    toolResponses.push({
                        functionResponse: {
                            name: fnCall.name,
                            response: { error: err.message || "Tool execution failed" }
                        }
                    });
                    console.log("tool execution failed")
                }
            }
            // Send tool responses back to continue the loop
            message = toolResponses;
            console.log("tool responses sent back to continue the loop")
        }
        const newHistory = chat.getHistory();
        console.log("new history created")
        return { response: finalResponse, newHistory }
    } catch (error) {
        console.error("Error generating content:", error);
        return {
            response: "",
            newHistory: []
        };
    }
}