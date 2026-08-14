import type Dockerode from "dockerode";

export default interface IContainer {
    projectId: string,
    container: Dockerode.Container
}

