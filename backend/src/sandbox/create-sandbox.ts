import Docker from "dockerode";
import { exec } from "child_process"
const docker = new Docker();


//this just creates a container using node:22 image
// project files will be built on top of this/inside this using respective templates : node/next
async function createSandbox() {
    const container = await docker.createContainer({
        Image: "node:22",
        name: `sandbox-${crypto.randomUUID()}`,
        Cmd: ["tail", "-f", "/dev/null"],
        WorkingDir: "/workspace",
        HostConfig: {
            Memory: 512 * 1024 * 1024,
            NanoCpus: 1_000_000_000,
        },
    });

    await container.start();

    await exec(container, ["mkdir", "-p", "/workspace"]);

    return container;
}