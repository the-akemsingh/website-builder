import { Type } from '@google/genai';
import { SandboxContainerManager } from "../sandbox/sandboxContainerManager";
import type { ITool } from "../types/ITool";

export function getAiTools(projectId: string): ITool[] {
    const manager = SandboxContainerManager.getInstance();

    const readFile: ITool = {
        declaration: {
            name: "readFile",
            description: "Read the content of a file from the project workspace. Provide the relative file path.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    path: {
                        type: Type.STRING,
                        description: "Relative path of the file to read, e.g. 'src/index.ts'"
                    }
                },
                required: ["path"]
            }
        },
        execute: async (args) => {
            const result = await manager.readFileInContainer(projectId, args.path as string);
            return result;
        }
    };

    const writeFile: ITool = {
        declaration: {
            name: "writeFile",
            description: "Write content to a file in the project workspace. Creates parent directories if they don't exist.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    path: {
                        type: Type.STRING,
                        description: "Relative path of the file to write, e.g. 'src/routes/api.ts'"
                    },
                    content: {
                        type: Type.STRING,
                        description: "The full content to write to the file"
                    }
                },
                required: ["path", "content"]
            }
        },
        execute: async (args) => {
            await manager.writeFileInContainer(
                projectId,
                args.path as string,
                args.content as string
            );
            return `File written successfully: ${args.path}`;
        }
    };

    const deleteFile: ITool = {
        declaration: {
            name: "deleteFile",
            description: "Delete a file from the project workspace.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    path: {
                        type: Type.STRING,
                        description: "Relative path of the file to delete, e.g. 'src/old-file.ts'"
                    }
                },
                required: ["path"]
            }
        },
        execute: async (args) => {
            await manager.deleteFileInContainer(projectId, args.path as string);
            return `File deleted successfully: ${args.path}`;
        }
    };

    // TODO: 
    // tools for installing dependencies
    // build project
    // run project
    return [readFile, writeFile, deleteFile];
}