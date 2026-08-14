import Docker from "dockerode";
const docker = new Docker();


//this just creates a container using node:22 image
// project files will be built on top of this/inside this using respective templates : node/next
async function createSandboxContainer(projectId: string) {
    const container = await docker.createContainer({
        Image: "node:22",
        name: `sandbox-${projectId}`,
        Cmd: ["tail", "-f", "/dev/null"],
        WorkingDir: "/workspace",
        HostConfig: {
            Memory: 512 * 1024 * 1024, //Restricts to 512 mb ram
            NanoCpus: 1_000_000_000, // Restricts cpu usage to 1 core = 1*10^9 CPU nano-units
        },
    });

    await container.start();

    const execInstance = await container.exec({
        Cmd: ["mkdir", "-p", "/workspace"],
        AttachStdout: true,
        AttachStderr: true,
    });

    await execInstance.start({});

    return container;
}

export default createSandboxContainer