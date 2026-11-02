# AI Website Builder — Engineering Thinking Process & Architecture

## 1. Project Overview

I wanted to build an AI-powered website builder where users could describe an application in natural language and have the system generate the code, execute it, build it, and provide a live preview.

The goal was not simply to generate code using an LLM. I wanted to build the infrastructure around it so generated applications could actually run.

The system needed to:

- Understand the user's prompt and select an appropriate project structure.
- Give the LLM tools to create, read, modify, and delete files.
- Execute generated code inside an isolated, disposable environment.
- Install dependencies and run builds.
- Stream execution logs and tool-call updates to the frontend.
- Start a development server and expose a preview URL.
- Handle errors and allow the AI to iterate on its implementation.

I approached the project as two connected systems:

1. **AI orchestration layer:** Understands the request, reasons about the implementation, and decides which tools to call.
2. **Execution layer:** Runs the generated application, manages dependencies and processes, and exposes the preview.

The execution layer became one of the most important engineering challenges.

---

## 2. How My Thinking Evolved

### Phase 1: Generate Code and Make It Runnable

My initial approach was straightforward: use an LLM to generate application files inside a sandbox, install the required dependencies, start the development server, and expose a preview URL.

The initial workflow looked like this:

```text
User Prompt
    |
    v
LLM Generates Application Files
    |
    v
Create Sandbox
    |
    v
Install Dependencies
    |
    v
Start Development Server
    |
    v
Expose Preview URL
```

This was enough to establish the basic concept, but it introduced a significant performance problem: setting up a new environment required installing dependencies repeatedly.

### Phase 2: Identify Dependency Installation as a Bottleneck

During development, dependency installation could take more than five minutes.

The problem was that each new sandbox repeated much of the same setup work, even when the application started from an identical template.

I realized that dependency installation was predictable work and did not necessarily need to happen every time a user requested a website.

The main question became:

**How can I avoid repeating expensive environment setup for every new project?**

### Phase 3: Consider Storing `node_modules` in Object Storage

My first optimization idea was to install dependencies once, package the resulting `node_modules` directory, and store it in object storage.

The workflow would look like this:

```text
Prepare Template
    |
    v
Install Dependencies Once
    |
    v
Archive node_modules
    |
    v
Upload Archive to Object Storage
    |
    v
New Sandbox Requests Template
    |
    v
Download and Extract Archive
    |
    v
Start Application
```

This approach could reduce repeated package installation work.

However, it also introduced additional complexity:

- Uploading and downloading large archives.
- Extracting dependencies during sandbox startup.
- Managing cache versions and invalidation.
- Ensuring compatibility across operating systems, architectures, and Node.js versions.
- Handling native modules and dependencies that differ between environments.

Although this was a reasonable optimization to explore, it made me reconsider whether I was solving the problem at the right architectural level.

### Phase 4: Move Toward Prebuilt Docker Template Images

My next approach was to package the baseline project environment into Docker images.

Instead of repeatedly installing the same dependencies at runtime, I could build the template images in advance and install their baseline dependencies during image creation.

I planned separate environments for Node.js and Next.js applications.

The revised workflow became:

```text
                    IMAGE BUILD TIME

                Prepare Project Template
                         |
                         v
                Install Baseline Packages
                         |
                         v
                  Build Docker Image
                         |
                         v
                  Publish Image to Registry


                    REQUEST TIME

                     User Prompt
                         |
                         v
                  Select Template Type
                         |
                         v
                  Create Docker Sandbox
                         |
                         v
                 Generate Application Code
                         |
                         v
                 Install Additional Packages
                         |
                         v
                    Build and Run
                         |
                         v
                   Expose Preview
```

The important realization was that I could move predictable setup work from request time to image build time.

This approach made the baseline environment reusable and versionable.

It did not eliminate every dependency installation. If the AI introduced a package that was not already available, the system would still need to install it.

### Phase 5: Introduce Explicit Node.js and Next.js Templates

I decided to start with two well-defined templates instead of attempting to support arbitrary frameworks immediately.

#### Node.js Template

- Node.js
- TypeScript
- Express
- Backend-oriented applications and APIs
- Express development server

#### Next.js Template

- Next.js
- TypeScript
- React
- Full-stack web applications
- Next.js development server

The backend would classify the user's prompt and select the appropriate template before starting code generation.

This decision offered several advantages:

- More predictable project structures.
- Consistent runtime environments.
- Framework-specific instructions for the LLM.
- Easier debugging and error classification.
- A clear path for adding more templates later.

Instead of asking the LLM to construct every project from scratch, I could give it a known environment and let it focus on implementing the requested application.

### Phase 6: Build a Template-Aware AI Execution Pipeline

Once the template and sandbox concepts were established, I needed to connect them to the AI orchestration layer.

The architecture used a Next.js frontend, a Node.js and Express backend, Docker-based sandboxes, Gemini for LLM orchestration, LangGraph for structuring the orchestration flow, and WebSockets for streaming execution events.

The intended request lifecycle was:

```text
User Prompt
    |
    v
Frontend Sends Request
    |
    v
Backend Receives Request
    |
    v
Gemini Classifies Template
    |
    +----------------------+
    |                      |
    v                      v
 Node.js Template      Next.js Template
    |                      |
    v                      v
 Node.js Sandbox       Next.js Sandbox
    |                      |
    +----------+-----------+
               |
               v
        LLM Tool-Calling Loop
               |
               v
       Read and Modify Files
               |
               v
       Install Dependencies
               |
               v
         Build Application
               |
               v
        Start Development Server
               |
               v
         Expose Preview URL
```

The template classification step was important because the backend needed to know which environment to create before the generated application could run.

### Phase 7: Add Tool Calling for File Operations and Execution

I did not want the LLM to simply return a large block of source code and leave the backend to figure out what to do with it.

Instead, I gave the model a set of tools through which it could interact with the project workspace.

| Tool | Responsibility |
|---|---|
| `readFile` | Read existing project files |
| `writeFile` | Create or update project files |
| `deleteFile` | Remove files when required |
| `installDependency` | Install additional packages |
| `buildProject` | Execute the build and capture its output |

The conceptual loop was:

```text
LLM Receives Project Context
          |
          v
LLM Chooses a Tool
          |
          v
Backend Validates Tool Call
          |
          v
Tool Executes in Sandbox
          |
          v
Tool Result Returns to LLM
          |
          v
LLM Evaluates Result
          |
          +-------> Another Tool Call
          |
          v
      Implementation Complete
```

The LLM could read the existing project, modify files, install packages, inspect build results, and continue making changes when necessary.

This turned code generation into an iterative execution process rather than a single model response.

The backend remained responsible for executing tool calls and enforcing which operations were allowed.

### Phase 8: Add WebSocket Streaming

Another important part of the architecture was providing visibility into what the system was doing.

Code generation, dependency installation, and builds are multi-step operations. Users should not have to wait without feedback while the system executes them.

I introduced a WebSocket communication layer to stream logs, tool-call updates, and execution progress to the frontend.

The flow was:

```text
Frontend
   |
   | Sends generation request
   v
Backend Orchestrator
   |
   +------> Gemini / LangGraph
   |
   +------> Sandbox Manager
   |              |
   |              v
   |         Tool Execution
   |              |
   |              v
   |         Build and Run
   |
   v
WebSocket Server
   |
   | Streams execution events
   v
Frontend Progress and Logs
   |
   v
Live Application Preview
```

This made it possible to expose useful execution details while the application was being generated.

The WebSocket layer served as a communication mechanism. It did not itself execute the model or isolate application code.

---

## 3. Docker Sandbox Lifecycle

The sandbox manager was responsible for managing the lifecycle of project containers.

The Docker environment used a Node.js 22 base image for the discussed setup. Containers could be kept alive using a command such as:

```dockerfile
CMD ["tail", "-f", "/dev/null"]
```

The purpose was to keep the container running while the backend executed commands inside it.

The application development server could then be started and managed separately.

The conceptual lifecycle was:

```text
Create Container
      |
      v
Prepare Workspace
      |
      v
Write Application Files
      |
      v
Install Missing Dependencies
      |
      v
Build Application
      |
      v
Start Development Server
      |
      v
Monitor Process and Logs
      |
      v
Stop or Destroy Sandbox
```

Process management was another consideration. I explored using PM2 to manage the development server, including stopping the server through commands such as:

```bash
pm2 stop dev
```

This highlighted an important distinction: the lifecycle of a Docker container and the lifecycle of the development server inside it are separate concerns.

A robust implementation needs explicit handling for server startup, shutdown, errors, timeouts, and cleanup.

---

## 4. Debugging the Preview and Workspace Problem

One of the runtime problems I encountered was that the preview sometimes displayed the original template instead of the generated application.

The investigation pointed toward a mismatch between where the LLM wrote the generated files and the directory from which the development server served the application.

For example, the generated files could end up under `/src` while the application server was running from `/app`.

The underlying issue was not necessarily incorrect AI-generated code. It could be a disagreement between the workspace layout, tool implementation, and server working directory.

The debugging process was:

1. Verify the workspace path used by file tools.
2. Verify where the generated files were actually written.
3. Inspect the development server's working directory.
4. Check which project entry point and configuration the server was using.
5. Confirm that the preview URL mapped to the correct running process.

This reinforced the importance of having a single, explicit project root shared by the file tools, build process, and development server.

A useful invariant for the system is:

**Every file operation, build command, and development server must operate on the same intended project workspace.**

---

## 5. Architectural Responsibilities

The system can be understood as a collection of components with distinct responsibilities.

| Component | Responsibility |
|---|---|
| Next.js frontend | User prompt input, progress display, and application preview |
| Node.js and Express backend | Request handling, orchestration, and coordination |
| Gemini | Prompt understanding, implementation reasoning, and tool selection |
| LangGraph | Structuring the AI orchestration flow |
| Template manager | Selecting and preparing Node.js or Next.js project templates |
| Docker sandbox manager | Creating and managing execution containers |
| File tools | Reading, writing, and deleting project files |
| Dependency installer | Installing packages required by generated code |
| Build executor | Running builds and capturing errors |
| Process manager | Starting, monitoring, and stopping development servers |
| WebSocket server | Streaming execution events and logs |
| Preview service | Making the running application accessible to the frontend |

The main architectural principle was to separate decision-making from execution.

The LLM decided what needed to be done. The backend controlled how tool calls were executed. The sandbox provided the application workspace, and the preview service exposed the result.

---

## 6. Important Engineering Trade-offs

### Dependency Installation vs. Prebuilt Environments

Installing dependencies at startup is straightforward but can make every request slow.

Prebuilt images reduce repeated setup work, but they require image maintenance, version management, and a strategy for additional dependencies.

### Flexible Generation vs. Known Templates

Allowing arbitrary project structures provides flexibility but makes execution and debugging harder.

Starting with Node.js and Next.js templates constrained the initial scope and made the runtime more predictable.

### LLM Reasoning vs. Deterministic Backend Logic

The LLM is useful for interpreting requirements and deciding which files to change.

However, filesystem access, command execution, resource limits, process management, and cleanup should remain controlled by the backend.

### Container Persistence vs. Resource Management

Keeping a container alive allows multiple operations to run within the same workspace.

However, containers also consume resources. The system needs a defined lifecycle, inactivity policy, cleanup mechanism, and limits on concurrent execution.

### Progress Streaming vs. Execution State

Streaming logs over WebSockets improves visibility, but a stream of log messages is not a complete lifecycle model.

The backend should maintain explicit states such as:

```text
CREATED
   |
   v
PREPARING
   |
   v
GENERATING
   |
   v
INSTALLING
   |
   v
BUILDING
   |
   v
STARTING
   |
   v
READY
```

Failure and cancellation should be represented explicitly rather than treated as ordinary log messages.

---
## 7. Rethinking Execution: Server-Side Docker vs. In-Browser WebContainers

### The Problem with Server-Side Execution

In the initial architecture, generated applications run inside Docker containers on the project server.

Although this provides control over the runtime environment, it introduces an infrastructure cost that can grow with usage.

Each active sandbox may consume CPU, memory, storage, and network resources. As the number of concurrent users increases, the platform may need more compute capacity to support their applications.

The cost problem becomes particularly important when users create multiple projects, leave previews running, or trigger dependency installation and builds simultaneously.

The original execution model was:

```text
User Prompt
    |
    v
Project Server
    |
    v
Create Docker Sandbox
    |
    v
Install Dependencies / Build
    |
    v
Run Development Server
    |
    v
Serve Preview
```

This architecture makes the project server responsible for both coordinating AI generation and providing compute resources for application execution.

At scale, that could increase cloud infrastructure costs and create additional operational complexity.

### An Alternative: Run Applications in the Browser

I started considering whether application execution could move from the project server into the user's browser.

One technology that makes this possible is **WebContainers by StackBlitz**, the browser-based runtime technology used by Bolt.new.

WebContainers provide a Node.js-compatible execution environment inside the browser, allowing supported Node.js applications to run without provisioning a separate server-side container for every project.

This introduces a different execution model:

```text
                         USER PROMPT
                              |
                              v
                       PROJECT BACKEND
                              |
                       AI ORCHESTRATION
                              |
                              v
                      GENERATED PROJECT FILES
                              |
                              v
                      TRANSFER PROJECT FILES
                              |
                              v
                       USER'S BROWSER
                              |
                              v
                       WEBCONTAINER RUNTIME
                              |
                  +-----------+-----------+
                  |           |           |
                  v           v           v
              FILE SYSTEM  PACKAGES   DEV SERVER
                  |           |           |
                  +-----------+-----------+
                              |
                              v
                       LIVE PREVIEW
```

In this design, the backend continues to handle AI orchestration and project generation, while the browser handles application execution.

The main architectural change is that application execution no longer necessarily requires a dedicated cloud container for each user project.

### Why This Could Reduce Costs

Moving execution into the browser could reduce the server-side compute required for:

- Running development servers for generated applications.
- Maintaining idle project containers.
- Allocating CPU and memory to interactive previews.
- Scaling execution infrastructure with the number of concurrently active projects.

The user's device supplies much of the compute required to run the application, while the backend continues to handle the operations that genuinely need server-side processing.

However, this does not eliminate cloud costs entirely. AI inference, backend APIs, storage, authentication, networking, and any server-side services remain part of the infrastructure.

It also shifts some resource requirements to the user's device and introduces browser compatibility and runtime limitations.

### Comparing the Two Approaches

| Consideration | Server-Side Docker | In-Browser WebContainers |
|---|---|---|
| Execution location | Project server | User's browser |
| Compute resources | Cloud infrastructure | Primarily the user's device |
| Per-project execution cost | Can grow with active sandboxes | Can reduce server-side execution costs |
| Runtime control | Greater control over the container environment | Constrained by browser runtime capabilities |
| Supported environments | Depends on configured images and host capabilities | Depends on WebContainer compatibility |
| Native binaries and system tools | Can support many tools with appropriate images | More limited than a general-purpose Linux container |
| Dependency installation | Runs on the server | Runs inside the browser runtime |
| Preview delivery | Requires a server-side preview mechanism | Can use a browser-local development server and preview |
| Security model | Requires container and host isolation | Requires browser sandboxing and WebContainer security boundaries |
| Offline or restricted environments | Depends on server connectivity | Still subject to package availability, network policies, and runtime constraints |

### What Would Change in My Architecture?

The project would evolve from a server-centric execution architecture into a hybrid architecture.

**Responsibilities retained by the backend:**

- Accept user prompts and manage authentication.
- Run Gemini and LangGraph orchestration.
- Generate or update project files.
- Manage project metadata and persistence.
- Handle AI API calls and other server-side operations.
- Coordinate project state and transfer generated files.

**Responsibilities moved into the browser:**

- Initialize the WebContainer runtime.
- Create and update the in-browser filesystem.
- Install supported project dependencies.
- Run supported development commands.
- Start the development server.
- Display the generated application in a preview.

This would require adapting the existing tool-calling system. Instead of every file operation and command being executed through the Docker sandbox manager, browser-compatible operations would need to be routed to the WebContainer runtime.

It would also require reconsidering how the AI accesses files. One option would be to keep the existing backend tool interface and route the actual operations through a runtime bridge. Another would be to generate changes on the backend and synchronize those changes to the browser.

The important requirement is that the LLM's tool interface and the execution environment remain consistent, even if the execution location changes.

### Challenges and Trade-offs

Moving execution into the browser is not a universal replacement for Docker.

Several considerations need to be addressed:

1. **Runtime compatibility:** WebContainers are designed for supported browser-based Node.js workflows, not unrestricted execution of every Linux program or arbitrary container image.
2. **Dependency installation:** Dependencies still need to be downloaded and installed in the browser environment. Prebuilt Docker images cannot simply be reused as WebContainer environments.
3. **Browser compatibility:** Supported browsers, cross-origin isolation requirements, and deployment headers must be considered.
4. **Device resources:** Large builds can consume significant memory and CPU on the user's device.
5. **Security:** Generated code remains untrusted. The system must carefully manage secrets, permissions, network access, and interactions with backend services.
6. **Persistence:** Browser-local project files need an explicit persistence or synchronization strategy if users expect to resume work across sessions or devices.
7. **Execution limitations:** Projects that require unsupported native dependencies, system services, or unrestricted operating-system access may still need server-side execution.

### A Hybrid Execution Strategy

Rather than removing Docker entirely, I could support both execution environments.

```text
                 GENERATED PROJECT
                         |
                         v
                  RUNTIME SELECTION
                         |
              +----------+----------+
              |                     |
              v                     v
       BROWSER-COMPATIBLE       SERVER-REQUIRED
              |                     |
              v                     v
         WEBCONTAINER          DOCKER SANDBOX
              |                     |
              v                     v
       IN-BROWSER PREVIEW     SERVER-SIDE PREVIEW
              |                     |
              +----------+----------+
                         |
                         v
                  PREVIEW INTERFACE
```

The browser runtime would be the preferred option for compatible projects, while Docker would remain available for workloads requiring greater operating-system control or unsupported dependencies.

This approach could reduce infrastructure costs for common web-development workloads without sacrificing the flexibility of the existing server-side runtime.

### The Architectural Lesson

The original problem was how to make AI-generated applications run reliably. Initially, I addressed that by building a server-side sandbox environment and optimizing dependency installation through reusable templates and prebuilt images.

The next architectural question is whether every generated application needs to execute on the project server at all.

WebContainers offer a way to move supported execution workloads to the client, potentially reducing the compute resources the platform must provision as usage grows.

The broader design principle is to separate **AI orchestration from application execution** so that the runtime can evolve independently of the generation pipeline.

This keeps the AI system flexible while allowing execution to move between server-side containers, browser-based runtimes, or a hybrid of both.

---

## 8. Updated Architecture Direction

The evolution of my thinking can now be summarized in four stages:

1. **Initial implementation:** Generate code, install dependencies, and run applications in server-side sandboxes.
2. **Performance optimization:** Explore cached dependencies and prebuilt Node.js and Next.js Docker images to reduce repeated setup work.
3. **Runtime reliability:** Formalize tool execution, project workspaces, process lifecycle, build validation, and preview management.
4. **Cost optimization:** Evaluate StackBlitz WebContainers to execute supported applications in the browser, retaining Docker for workloads that require server-side execution.

The long-term objective is not simply to make code generation faster. It is to build a reliable AI development platform that can generate, execute, and preview applications while using infrastructure efficiently.

*Implementation note: WebContainers are an architectural option to evaluate, not a drop-in replacement for Docker. Any expected cost savings should be validated through a prototype and measured against real workloads, browser limitations, and total infrastructure costs.*