import { docker } from "./dockerClient";


//this just creates a container using node:22 image
// project files will be built on top of this/inside this using respective templates : node/next
async function createSandboxContainer(projectId: string, port: number) {
    const containerPortKey = `${port}/tcp`;
    const container = await docker.createContainer({
        Image: "node:22",
        name: `sandbox-${projectId}`,
        Cmd: ["tail", "-f", "/dev/null"],
        WorkingDir: "/workspace",
        HostConfig: {
            Memory: 512 * 1024 * 1024, // Restricts to 512 MB RAM
            NanoCpus: 1_000_000_000,   // Restricts CPU usage to 1 core

            // bind container port to a random host port
            PortBindings: {
                [containerPortKey]: [{ HostPort: "" }] // "" forces Docker to choose a free port
            }
        },
        ExposedPorts: {
            [containerPortKey]: {}
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