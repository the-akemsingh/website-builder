import Docker from "dockerode";


// we can keep record of which container belongs to which project using projectId. 
// in methods we can take input - projectId,path : to file in that project, content : if its a writefile method
// but adding projectId in methods arguments is not goog approach as we will send the tool signature to LLM. and we will not send the projectId to LLM as well. so we have to manage projectId on ourself.
export class DockerSandbox {
  constructor(
    private container: Docker.Container
  ) {}

  async writeFile(
    path: string,
    content: string
  ) {}

  async readFile(
    path: string
  ) {}

  async execute(
    command: string[]
  ) {}

  async destroy() {}
}