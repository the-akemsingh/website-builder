import type Dockerode from "dockerode"
import createSandboxContainer from "./createContainer"
import type IContainer from "../types/IContainer"
import { docker } from "./dockerClient"
import { config } from "../config"

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

    private getContainer(websiteId: string) {
        return this.containers.find((container) => container.websiteId === websiteId)?.container
    }

    async createContainer(websiteId: string, port: number, templateName: string): Promise<{ projectContainer: Dockerode.Container, hostPort: string }> {
        console.log("creating container")
        const image = templateName === "next" ? config.get("nextTemplateImage") : config.get("nodeTemplateImage")
        const container = await createSandboxContainer(websiteId, port, image);
        const containerInfo = await container.inspect();
        const hostPort = containerInfo.NetworkSettings.Ports[`${port}/tcp`][0].HostPort;
        this.containers.push({
            websiteId,
            container,
            hostPort: Number(hostPort),
            url: `http://localhost:${hostPort}`
        })
        return { projectContainer: container, hostPort };
    }

    async deletContainer(websiteId: string) {
        const containerName = `sandbox-${websiteId}`;
        try {
            const container = docker.getContainer(containerName);
            await container.remove({
                force: true
            });
            console.log(`Deleted container: ${containerName}`);
        } catch (error: any) {
            if (error.statusCode === 404) {
                console.log(`Container ${containerName} not found`);
                return;
            }
            throw error;
        }
    }

    async getContainerUrl(
        websiteId: string,
        templateName: string
    ): Promise<string | null> {
        try {
            const containerName = `sandbox-${websiteId}`
            const containerPort = templateName === 'node' ? 4000 : 4001
            const container = docker.getContainer(containerName);

            let info = await container.inspect();

            if (!info.State.Running) {
                await container.start();
                await this.startDevServer(websiteId)
                info = await container.inspect();
            }
            const portKey = `${containerPort}/tcp`;
            const portBinding = info.NetworkSettings.Ports?.[portKey]?.[0];

            if (!portBinding?.HostPort) {
                return null;
            }
            return `http://localhost:${portBinding.HostPort}`;

        } catch (error: any) {
            if (error.statusCode === 404) {
                console.log(`Container not found`);
                return null;
            }
            throw error;
        }
    }

    async installDependencies(websiteId: string, dependencyName?: string): Promise<void> {
        const container = this.getContainer(websiteId);
        if (!container) throw new Error("Container not found");
        // No TTY here: a TTY makes npm wait on interactive behavior and swallows exit signals.
        const exec = await container.exec({
            Cmd: dependencyName ? ["npm", "install", dependencyName] : ["npm", "install"],
            WorkingDir: "/workspace",
            AttachStdout: true,
            AttachStderr: true
        });

        const stream = await exec.start({});
        return new Promise((resolve, reject) => {
            // Hard timeout so a hung npm/stream can never block the agent loop forever
            const timeout = setTimeout(() => {
                stream.destroy();
                reject(new Error("npm install timed out after 10 minutes"));
            }, 10 * 60 * 1000);

            // stream npm output to server logs for visibility
            container.modem.demuxStream(stream, process.stdout, process.stderr);

            stream.on("error", (err) => {
                clearTimeout(timeout);
                reject(new Error(`Stream error during npm install: ${err.message}`));
            });
            stream.on("data", (data) => {
                console.log(data.toString())
            })
            stream.on("end", async () => {
                clearTimeout(timeout);
                try {
                    const inspectData = await exec.inspect();
                    if (inspectData.ExitCode === 0) {
                        resolve();
                    } else {
                        reject(new Error(`npm install failed with exit code ${inspectData.ExitCode}`));
                    }
                } catch (err) {
                    reject(err);
                }
            });
        });
    }

    async buildProject(websiteId: string): Promise<{
        success: boolean;
        exitCode: number | null;
        output: string;
    }> {
        const container = this.getContainer(websiteId);

        if (!container) {
            throw new Error("Container not found");
        }
        const exec = await container.exec({
            Cmd: ["npm", "run", "build"],
            WorkingDir: "/workspace",
            AttachStdout: true,
            AttachStderr: true
        });

        const stream = await exec.start({});

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                stream.destroy();
                reject(new Error("Build timed out after 10 minutes"));
            }, 10 * 60 * 1000);

            let stdout = "";
            let stderr = "";

            container.modem.demuxStream(
                stream,
                {
                    write: (chunk: Buffer) => {
                        stdout += chunk.toString("utf8");
                        process.stdout.write(chunk);
                    }
                },
                {
                    write: (chunk: Buffer) => {
                        stderr += chunk.toString("utf8");
                        process.stderr.write(chunk);
                    }
                }
            );

            stream.on("data", (data) => {
                console.log("Project: ", websiteId, "build logs-", data.toString())
            });
            stream.on("error", (err) => {
                clearTimeout(timeout);
                reject(
                    new Error(`Stream error during build: ${err.message}`)
                );
            });

            stream.on("end", async () => {
                clearTimeout(timeout);

                try {
                    const inspectData = await exec.inspect();
                    resolve({
                        success: inspectData.ExitCode === 0,
                        exitCode: inspectData.ExitCode,
                        output: `${stdout}\n${stderr}`.trim()
                    });

                } catch (err) {
                    reject(err);
                }
            });
        });
    }

    async startDevServer(websiteId: string) {
        const container = this.getContainer(websiteId);
        if (!container) throw new Error("Container not found");

        const exec = await container.exec({
            Cmd: [
                "pm2",
                "start",
                "npm",
                "--name",
                "dev",
                "--",
                "run",
                "dev"
            ],
            WorkingDir: "/workspace",
            AttachStdout: true,
            AttachStderr: true,
            Tty: true
        });

        // Start execution without blocking on process completion
        const stream = await exec.start({
            Tty: true
        });

        // We can broadcast logs over WebSockets to client side
        stream.on("data", (data) => {
            console.log(`[Dev Server ${websiteId}]:`, data.toString());
        });
        stream.on("error", (err) => {
            console.error(`[Dev Server Error ${websiteId}]:`, err);
        });

        return exec;
    }

    //Docker Engine API does not provide a direct exec.kill() method on exec instances. Calling stream.destroy() only closes your host connection to the logs—the dev server will keep running in the background inside the container.
    async stopDevServer(websiteId: string): Promise<void> {
        const container = this.getContainer(websiteId);

        if (!container) {
            throw new Error("Container not found");
        }

        console.log("Stopping dev server:", websiteId);

        const stopExec = await container.exec({
            Cmd: [
                "sh",
                "-c",
                "pm2 delete dev || true"
            ],
            WorkingDir: "/workspace",
            AttachStdout: true,
            AttachStderr: true
        });

        const stream = await stopExec.start({});

        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.log("PM2 stop command timed out:", websiteId);
                // Close our Docker log connection.
                stream.destroy();

                resolve();
            }, 15_000);

            stream.on("end", () => {
                clearTimeout(timeout);
                resolve();
            });

            stream.on("error", (err) => {
                clearTimeout(timeout);
                reject(err);
            });

            container.modem.demuxStream(
                stream,
                process.stdout,
                process.stderr
            );
        });

        console.log("Dev server stop command completed:", websiteId);
    }

    //for file updation and new file creation 
    async writeFileInContainer(websiteId: string, relativePath: string, content: string) {
        const container = this.getContainer(websiteId);
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

    async readFileInContainer(websiteId: string, relativePath: string): Promise<string> {
        const container = this.getContainer(websiteId);
        if (!container) {
            new Error(`Respective container not found for project : ${websiteId}`)
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

    async deleteFileInContainer(websiteId: string, relativePath: string): Promise<void> {
        const container = this.getContainer(websiteId);
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

    async getSourceArchive(websiteId: string) {
        const container = docker.getContainer(`sandbox-${websiteId}`);

        await container.inspect();

        const exportPath = "/tmp/source-export";

        // Create a temporary copy
        const exec = await container.exec({
            Cmd: [
                "sh",
                "-c",
                `
                rm -rf ${exportPath} &&
                cp -a /workspace ${exportPath} &&
                rm -rf \
                    ${exportPath}/node_modules \
                    ${exportPath}/.next \
                    ${exportPath}/dist \
                    ${exportPath}/.git
            `,
            ],
            WorkingDir: "/workspace",
            AttachStdout: true,
            AttachStderr: true,
        });

        const stream = await exec.start({});

        await new Promise<void>((resolve, reject) => {
            stream.on("end", resolve);
            stream.on("error", reject);

            stream.resume();
        });

        const archive = await container.getArchive({
            path: exportPath,
        });

        archive.on("end", async () => {
            try {
                const cleanupExec = await container.exec({
                    Cmd: [
                        "rm",
                        "-rf",
                        exportPath,
                    ],
                    AttachStdout: true,
                    AttachStderr: true,
                });

                const cleanupStream = await cleanupExec.start({});

                cleanupStream.on("error", (error) => {
                    console.error(
                        "Failed to cleanup source export:",
                        error
                    );
                });

                cleanupStream.resume();

            } catch (error) {
                console.error(
                    "Failed to start source export cleanup:",
                    error
                );
            }
        });

        return archive;
    }
}

