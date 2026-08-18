import type Dockerode from "dockerode";
import { parseXmlTemplate } from "../utils/xmlParser";

async function createFileStructure(container: Dockerode.Container, template: string) {
    const allFiles = parseXmlTemplate(template)
    const allPromises = allFiles.map(async (file) => {
        const relativePath = file.path
        const fullPath = `/workspace/${relativePath}`
        const parentDir = fullPath.substring(0, fullPath.lastIndexOf("/"));

        // encode content to Base64 to handle special chars, quotes, and newlines safely
        const base64Content = Buffer.from(file.content || "").toString("base64");

        // create directory structure and decode/write content in a single shell command
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
    });
    await Promise.all(allPromises)
}
export default createFileStructure;