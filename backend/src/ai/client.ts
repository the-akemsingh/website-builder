import { GoogleGenAI, type Content } from '@google/genai';
import { config } from '../config';
import type { ITool } from '../types/ITool';

const llmClient = new GoogleGenAI({
    apiKey: config.get("geminiApiKey")
});

//prompt to find which template will be used
export async function getProjectNameAndTemplate(prompt: string): Promise<{ templateName: string; title: string }> {
    try {
        const response = await llmClient.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents:
                `
                Choose the appropriate project templateName and the project title for the user's request.

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

                Return response exactly like this in json :
                {templateName:"node",title:"Todo app"}
                or
                {templateName:"next",title:"Personal Portfolio"}
            `,
            config: {
                systemInstruction: `
You are a project templateName classifier and project title generator.

Your task is to:
1. Choose the most appropriate project templateName.
2. Generate a short, descriptive project title based on the user's request.

You have exactly two possible templateNames:

- "node": Use for Node.js + TypeScript + Express applications, including backend APIs,
  REST APIs, webhooks, servers, server-side logic, and backend-focused applications.

- "next": Use for Next.js + TypeScript applications, including websites, landing pages,
  dashboards, portfolios, ecommerce frontends, and other user-facing web applications.

Your response MUST be valid JSON with exactly these two fields:

{
  "templateName": "node" | "next",
  "title": "Project Name"
}

Rules:
- "templateName" MUST be exactly either "node" or "next".
- "title" MUST be a short, descriptive title for the project.
- Do not include any additional fields.
- Do not provide an explanation.
- Do not use markdown.
- Do not wrap the JSON in code fences.
- Return JSON only.

Example:
{"templateName":"node","title":"Todo API"}

Example:
{"templateName":"next","title":"Personal Portfolio"}
`
            }
        });
        if (response.text) {
            return JSON.parse(response.text);
        }
        return { "templateName": "next", "title": "New App" };
    } catch (error) {
        console.error("Error generating content:", error);
        return { "templateName": "next", "title": "New App" };
    }
}

//the real project builder function
//we can implement custom loop to stream intermediate progress to client side - we have to use ws or sse
export async function invokeLLM(
    userPrompt: string,
    tools: ITool[],
    chatHistory: Content[] = [],
    template?: string,
    onEvent?: (event: any) => void
): Promise<{ response: string, newHistory: Content[] }> {
    try {
        console.log("inside invokeLLM")
        onEvent?.({ type: 'log', message: 'Starting AI processing...' });
        const geminiTools = [{
            functionDeclarations: tools.map(t => t.declaration)
        }];

        const systemInstruction = template
            ? `You are a website builder AI working inside a Docker container at /workspace.
Use the provided tools (readFile, writeFile, deleteFile,installDependencies,buildProject) to read, write, delete files and to install dependencies to build the user's requested website.

The project has been scaffolded with the following template:
${template}

Guidelines:
- Always use readFile to inspect existing files before modifying them.
- Use writeFile to create or update files with complete content.
- Use deleteFile to remove files that are no longer needed.
- Use installDependencies to install dependencies.
- Use buildProject to generate the build of the project and get outcome if it succeded or failed.
- Make sure all imports and dependencies are correct.
- Follow the project's existing code style and conventions.`
            : `You are a website builder AI working inside a Docker container at /workspace.
Use the provided tools (readFile, writeFile, deleteFile,installDependencies,buildProject) to read, write, delete files and to install dependencies to build the user's requested website.

Guidelines:
- Always use readFile to inspect existing files before modifying them.
- Use writeFile to create or update files with complete content.
- Use deleteFile to remove files that are no longer needed.
- Use installDependencies to install dependencies.
- Use buildProject to generate the build of the project and get outcome if it succeded or failed.
- Make sure all imports and dependencies are correct.
- Follow the project's existing code style and conventions.`;

        const chat = llmClient.chats.create({
            model: "gemini-3.1-flash-lite",
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
                onEvent?.({ type: 'toolStart', tool: fnCall.name });
                const tool = tools.find(tool => tool.declaration.name === fnCall.name);
                if (!tool) {
                    toolResponses.push({
                        functionResponse: {
                            name: fnCall.name,
                            response: { error: `Unknown tool: ${fnCall.name}` }
                        }
                    });
                    onEvent?.({ type: 'toolEnd', tool: fnCall.name, error: `Unknown tool: ${fnCall.name}` });
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
                    onEvent?.({ type: 'toolEnd', tool: fnCall.name, result });
                } catch (err: any) {
                    toolResponses.push({
                        functionResponse: {
                            name: fnCall.name,
                            response: { error: err.message || "Tool execution failed" }
                        }
                    });
                    console.log("tool execution failed")
                    onEvent?.({ type: 'toolEnd', tool: fnCall.name, error: err.message || "Tool execution failed" });
                }
            }
            // Send tool responses back to continue the loop
            message = toolResponses;
            console.log("tool responses sent back to continue the loop")
        }
        const newHistory = chat.getHistory();
        console.log("new history created")
        onEvent?.({ type: 'log', message: 'Finished AI processing.' });
        return { response: finalResponse, newHistory }
    } catch (error) {
        console.error("Error generating content:", error);
        onEvent?.({ type: 'error', message: 'Internal server error in AI processing' });
        return {
            response: "",
            newHistory: []
        };
    }
}