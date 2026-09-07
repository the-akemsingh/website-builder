import type Dockerode from "dockerode";

export default interface IContainer {
    websiteId: string,
    container: Dockerode.Container,
    hostPort:number,
    url:string
}

