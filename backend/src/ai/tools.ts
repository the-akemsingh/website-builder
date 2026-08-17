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

    const installDependency: ITool = {
        declaration: {
            name: "installDependency",
            description: "Install a dependency in the project. Provide the package name (e.g. 'axios', 'lodash'). If no package name is provided, runs npm install to install all dependencies from package.json.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    package: {
                        type: Type.STRING,
                        description: "The name of the npm package to install, e.g. 'axios'. Leave empty to install all dependencies from package.json."
                    }
                },
                required: []
            }
        },
        execute: async (args) => {
            const pkg = args.package as string | undefined;
            await manager.installDependencies(projectId, pkg || undefined);
            return pkg
                ? `Dependency installed successfully: ${pkg}`
                : `All dependencies installed successfully from package.json`;
        }
    };

    // TODO: 
    // build project
    // run project
    return [readFile, writeFile, deleteFile, installDependency];
}