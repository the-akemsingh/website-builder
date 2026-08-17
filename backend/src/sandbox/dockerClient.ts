import Docker from "dockerode";
import net from "node:net";
import { config } from "../config";

// Bun's HTTP client cannot connect over Windows named pipes (socketPath is ignored/broken),
// but net.connect() to the pipe works. So on Windows we bridge a local TCP port to the
// Docker named pipe and point dockerode at that TCP endpoint.
async function createDockerClient(): Promise<Docker> {
    const socketPath = config.get("dockerSocketPath");
    const isWindowsPipe = process.platform === "win32" && socketPath.includes("pipe");

    if (!isWindowsPipe) {
        return new Docker({ socketPath });
    }

    const relay = net.createServer((tcpSocket) => {
        const pipeSocket = net.connect(socketPath);
        tcpSocket.pipe(pipeSocket);
        pipeSocket.pipe(tcpSocket);
        tcpSocket.on("error", () => pipeSocket.destroy());
        pipeSocket.on("error", () => tcpSocket.destroy());
    });

    await new Promise<void>((resolve, reject) => {
        relay.once("error", reject);
        relay.listen(0, "127.0.0.1", () => resolve());
    });

    const address = relay.address();
    const port = typeof address === "object" && address ? address.port : 0;
    if (!port) throw new Error("Failed to start Docker pipe relay");

    return new Docker({ host: "127.0.0.1", port });
}

export const docker = await createDockerClient();
