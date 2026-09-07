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

export function contentToDbMessage(contents: Content[], websiteId: string) {
    const messages: message[] = [];

    for (const content of contents) {
        let singleMessage: message = {
            id: RandomIdGenerator(),
            websiteId,
            role: "model"
        };

        for (const part of content.parts ?? []) {
            if ('text' in part && part.text !== undefined) {
                singleMessage.text = part.text;
            }

            if ('functionCall' in part && part.functionCall?.name) {
                singleMessage.functionCallName = part.functionCall.name
            }

            if ('functionResponse' in part && part.functionResponse?.name) {
                singleMessage.functionCallResponse = JSON.stringify(part.functionResponse.response!["output"])
            }
        }
        messages.push(singleMessage)
    }

    return messages;
    // return contents.flatMap(content => {
    //     const messages = [];

    //     const textParts = content.parts!.filter(part => 'text' in part);
    //     if (textParts.length > 0) {
    //         const text = textParts.map(p => (p as { text: string }).text).join(' ');
    //         messages.push({
    //             websiteId,
    //             role: content.role,
    //             text,
    //             functionCallName: undefined,
    //             functionCallResponse: undefined
    //         });
    //     }

    //     const functionCallParts = content.parts!.filter(part => 'functionCall' in part);
    //     functionCallParts.forEach(part => {
    //         const fnCall = (part as { functionCall: { name: string; args: any } }).functionCall;
    //         messages.push({
    //             websiteId,
    //             role: content.role,
    //             text: undefined,
    //             functionCallName: fnCall.name,
    //             functionCallResponse: undefined
    //         });
    //     });

    //     const functionResponseParts = content.parts!.filter(part => 'functionResponse' in part);
    //     functionResponseParts.forEach(part => {
    //         const fnResponse = (part as { functionResponse: { name: string; response: any } }).functionResponse;
    //         messages.push({
    //             websiteId,
    //             role: content.role,
    //             text: undefined,
    //             functionCallName: fnResponse.name,
    //             functionCallResponse: JSON.stringify(fnResponse.response)
    //         });
    //     });

    //     return messages;
    // });
}
