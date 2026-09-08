import type { Content } from '@google/genai';
import dbClient from '../prisma/db';
import RandomIdGenerator from './randomIdGenerator';


export async function dbMessageToContent(websiteId: string): Promise<Content[]> {
    const messages = await dbClient.Message.where({ websiteId: websiteId }).all()
    return messages.map(message => {
        const content: Content = {
            role: message.role,
            parts: []
        };

        if (message.text) {
            content.parts?.push({ text: message.text });
        }

        if (message.functionCallName) {
            content.parts?.push({
                functionCall: {
                    name: message.functionCallName,
                    args: {}
                }
            });
        }

        if (message.functionCallResponse) {
            try {
                const response = JSON.parse(message.functionCallResponse);
                content.parts?.push({
                    functionResponse: {
                        name: message.functionCallName as string,
                        response: response
                    }
                });
            } catch (e) {
                // If not JSON, treat as plain text
                content.parts?.push({
                    functionResponse: {
                        name: message.functionCallName as string,
                        response: { output: message.functionCallResponse }
                    }
                });
            }
        }

        return content;
    });
}

interface message {
    id: string,
    websiteId: string,
    role: string,
    text?: string,
    functionCallName?: string,
    functionCallResponse?: string,
}

export function contentToDbMessage(
    contents: Content[],
    websiteId: string
) {
    const messages: message[] = [];

    for (const content of contents) {
        for (const part of content.parts ?? []) {

            // Text
            if ("text" in part && part.text) {
                messages.push({
                    id: RandomIdGenerator(),
                    websiteId,
                    role: content.role ?? "model",
                    text: part.text,
                });
            }

            // Tool call
            if ("functionCall" in part && part.functionCall?.name) {
                messages.push({
                    id: RandomIdGenerator(),
                    websiteId,
                    role: "model",
                    functionCallName: part.functionCall.name,
                });
            }

            // Tool result
            if ("functionResponse" in part && part.functionResponse?.name) {
                messages.push({
                    id: RandomIdGenerator(),
                    websiteId,
                    role: "tool",
                    functionCallName: part.functionResponse.name,
                    functionCallResponse: JSON.stringify(
                        part.functionResponse.response
                    ),
                });
            }
        }
    }

    return messages;
}