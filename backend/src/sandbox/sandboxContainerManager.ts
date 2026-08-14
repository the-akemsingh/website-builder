import type Dockerode from "dockerode"
import createSandboxContainer from "./createContainer"
import type IContainer from "../types/IContainer"


// we can keep record of which container belongs to which project using projectId. 
// in methods we can take input - projectId,path : to file in that project, content : if its a writefile method
// but adding projectId in methods arguments is not goog approach as we will send the tool signature to LLM. and we will not send the projectId to LLM as well. so we have to manage projectId on ourself.

export class SandboxContainerManager {
    private containers: IContainer[]
    private static instance: SandboxContainerManager
    constructor() {
        this.containers = []
    }

    public static getInstance() {
        if (!SandboxContainerManager.instance) {
            SandboxContainerManager.instance = new SandboxContainerManager()
        }
        return SandboxContainerManager.instance
    }

    public async createContainer(projectId: string): Promise<Dockerode.Container> {
        const container = await createSandboxContainer(projectId);
        this.containers.push({
            projectId,
            container
        })
        return container;
    }

    getContainer(projectId: string) {
        return this.containers.find((container) => container.projectId === projectId)?.container
    }

    //for file updation and new file creation 
    public async writeFileInContainer(projectId: string, relativePath: string, content: string) {
        const container = this.getContainer(projectId);
        if (!container) return;
        const fullPath = `/workspace/${relativePath}`
        const parentDir = fullPath.substring(0, fullPath.lastIndexOf("/"));

        const base64Content = Buffer.from(content || "").toString("base64");

        const shellScript = `mkdir -p "${parentDir}" && echo "${base64Content}" | base64 -d > "${fullPath}"`;

        const command = await container.exec({
            Cmd: ["sh", "-c", shellScript],
            WorkingDir: "/workspace"
        });
        const stream = await command.start({});
        return new Promise<void>((resolve, reject) => {
            container.modem.demuxStream(stream, process.stdout, process.stderr);
            stream.on("end", resolve);
            stream.on("error", reject);
        });
    }

    public async readFileInContainer(projectId: string, relativePath: string): Promise<string> {
        const container = this.getContainer(projectId);
        if (!container) {
            new Error(`Respective container not found for project : ${projectId}`)
            return ""
        }

        const fullPath = `/workspace/${relativePath}`

        const command = await container.exec({
            Cmd: ["sh", "-c", `base64 '${fullPath}'`],
            WorkingDir: "/workspace",
            AttachStdout: true,
            AttachStderr: true
        });

        const stream = await command.start({});

        return new Promise((resolve, reject) => {
            let base64Output = "";
            let stderrOutput = "";

            container.modem.demuxStream(
                stream,
                {
                    write: (chunk: Buffer) => { base64Output += chunk.toString("ascii"); }
                },
                {
                    write: (chunk: Buffer) => { stderrOutput += chunk.toString("utf8"); }
                }
            );

            stream.on("end", () => {
                if (stderrOutput.trim()) {
                    return reject(new Error(`Error reading file: ${stderrOutput}`));
                }
                const cleanBase64 = base64Output.replace(/\s/g, "");
                const decodedContent = Buffer.from(cleanBase64, "base64").toString("utf8");
                resolve(decodedContent);
            });
            stream.on("error", reject);
        });
    }

    public async deleteFileInContainer(projectId: string, relativePath: string): Promise<void> {
        const container = this.getContainer(projectId);
        if (!container) return;
        const fullPath = `/workspace/${relativePath}`
        const command = await container.exec({
            Cmd: ["sh", "-c", `rm -f '${fullPath}'`],
            WorkingDir: "/workspace",
            AttachStdout: true,
            AttachStderr: true
        });

        const stream = await command.start({});

        return new Promise((resolve, reject) => {
            const errorChunks: Buffer[] = [];

            container.modem.demuxStream(
                stream,
                { write: () => { } },
                { write: (chunk: Buffer) => errorChunks.push(chunk) }
            );

            stream.on("end", () => {
                if (errorChunks.length > 0) {
                    const stderr = Buffer.concat(errorChunks).toString("utf8");
                    return reject(new Error(`Failed to delete file: ${stderr}`));
                }
                resolve();
            });

            stream.on("error", reject);
        });
    }
}