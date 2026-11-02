# 50 Educational X Posts for the Website Builder

1. An AI website builder is not just an LLM that writes code.

The hard part is making the generated code runnable:

- choose a project template
- create an isolated workspace
- write the files
- install dependencies
- build the app
- start a preview

Generation is only one part of the system.

2. I split the website builder into two main systems:

1. The AI orchestration layer decides what needs to happen.
2. The execution layer actually runs those changes.

That separation matters.

The model can reason about files and implementation, but the backend should control filesystem access, commands, containers, and resource limits.

3. The first version of the builder followed a simple flow:

User prompt -> generate files -> create sandbox -> install dependencies -> start server -> show preview.

It worked as a proof of concept.

It also made one problem obvious: installing the same dependencies for every project was too slow.

4. One of the biggest performance lessons in this project:

Predictable work should move away from request time whenever possible.

Installing baseline dependencies during Docker image creation is usually better than repeating the same install during every user request.

The request should focus on the project-specific work.

5. I considered storing `node_modules` in object storage to speed up new sandboxes.

It could work, but it adds questions about:

- archive size
- cache invalidation
- operating systems
- CPU architecture
- Node.js versions
- native modules

A faster idea is not always a simpler architecture.

6. The current template strategy starts with two known environments:

- Node.js + TypeScript + Express for APIs and backend apps
- Next.js + TypeScript + React for websites and frontend apps

Supporting fewer environments at first gives the builder predictable file layouts, commands, ports, and debugging rules.

7. Before generating a project, the backend asks the model to classify the request.

The model returns a template name and a short project title.

That means a request for a REST API can get a Node template, while a request for a dashboard can get a Next.js template.

Template selection is part of execution planning.

8. The model is not given unlimited access to the project.

It gets a small tool surface:

- `readFile`
- `writeFile`
- `deleteFile`
- `installDependency`
- `buildProject`

This makes the model useful while keeping the actual operations inside backend-controlled functions.

9. The file tools use relative paths inside `/workspace`.

That detail is more important than it looks.

The file tools, build command, and development server must all use the same project root. Otherwise, the AI may write one application while the preview serves another directory.

10. A tool-calling loop is more useful than asking an LLM for one giant code block.

The builder can:

1. read an existing file
2. decide what to change
3. write the file
4. build the project
5. inspect the result
6. fix the next issue

That turns generation into an iterative engineering process.

11. The builder tells the model to read files before changing them.

That rule protects existing work and gives the model context about the current project.

Without it, an AI agent can overwrite a working setup simply because it guessed the project structure incorrectly.

12. A build command is not just a final ceremony.

In this project, `buildProject` returns whether the build succeeded, the exit code, and the combined output.

That output goes back into the AI loop so the model can respond to real compiler errors instead of guessing.

13. The model can ask for a dependency, but the backend performs the installation.

This is a useful boundary:

The model chooses what the project needs.
The sandbox manager decides how that command runs.

The backend can then add timeouts, logging, and future policy checks in one place.

14. Docker containers give each generated project its own workspace.

The container is created with a project-specific name, a `/workspace` working directory, and a dynamically assigned host port.

That keeps generated files and running processes separated between projects.

15. The container and the development server have different lifecycles.

The container can stay alive while the backend starts and stops the app inside it with PM2.

That distinction makes it possible to restart the preview without rebuilding the entire sandbox.

16. A Docker container that is alive is not the same thing as an app that is ready.

This project keeps the container running with a long-lived command, then starts the development server separately.

Container state and application state need to be tracked as different things.

17. Docker assigns a free host port for each sandbox.

The backend inspects the container after creation, reads the mapped port, and stores the preview URL for the project.

This avoids hard-coding one host port for every generated app.

18. The builder currently limits each container to one CPU core.

Resource limits are part of the architecture, not an optional cleanup task.

An AI-generated project can run expensive builds or start a process that never exits. Isolating the work is only half the job; bounding it matters too.

19. Long-running commands need hard timeouts.

Dependency installation and builds each have a 10-minute timeout in the sandbox manager.

A timeout turns a stuck process into a visible failure instead of letting one request block the agent loop forever.

20. WebSockets are useful here because the build is not one quick request.

There are several events to show:

- AI processing started
- a tool started
- a tool finished
- a build failed
- credits were used
- the preview is ready

Streaming makes the system feel understandable while it works.

21. The WebSocket is only the communication channel.

It does not run the model or isolate code.

The backend orchestrator calls Gemini, the sandbox manager runs Docker commands, and the WebSocket sends progress to the frontend.

Each layer has a clear job.

22. WebSocket connections are checked before a chat message is accepted.

The server verifies the JWT, reads the user ID, and confirms that the requested website belongs to that user.

Authentication is enforced at the connection boundary, not only in the UI.

23. The frontend build feed turns server events into readable states:

- Thinking
- Running tool
- Done
- Disconnected
- Error

That is more useful than showing raw JSON or a spinner with no explanation.

Progress UI should describe the system's actual state.

24. The frontend keeps the build feed as a list of typed items.

A user message, model response, log, tool call, and error each have a different shape and display.

That makes the interface easier to extend than one large text log with special string parsing.

25. Tool events have a start and an end.

When a tool starts, the UI shows it as running.
When it ends, the UI updates the same item to done or failed.

This small state transition makes the build process much easier to follow.

26. The project saves chat history in the database, not only in the browser.

When the workspace opens, stored messages are converted back into feed items.

That means a refresh does not erase the story of what the AI already did.

27. The AI receives previous chat history before handling a new prompt.

This lets the user say something like “add a testimonials section” without repeating the entire project description.

Persistent history is what turns separate prompts into one ongoing build session.

28. The backend stops the current dev server before handling a new prompt.

That avoids leaving an old process running while the project is being changed.

After the AI finishes its work, the backend starts the dev server again and sends the final response.

29. Preview refreshes are tied to the build lifecycle.

The frontend marks the preview ready after the final event, then adds a timestamp query parameter when refreshing the iframe.

That helps the browser request the new generated output instead of showing an old cached document.

30. The website builder has a useful invariant:

Every file operation, build command, and dev server must point to the same project workspace.

Many “the AI generated the wrong app” bugs are really workspace or working-directory mismatches.

31. The builder uses a model for project classification and another model call flow for implementation work through the same configured Gemini client.

The important design choice is not only the model name.

It is giving the implementation call a template, tools, history, and a controlled runtime.

32. The AI loop has limits on both tool rounds and output tokens.

That keeps a confused or repetitive agent from running forever.

Agent limits are part of reliability. A successful system needs a defined stopping point, including when the result is incomplete.

33. Unknown tool calls are returned to the model as errors.

The backend does not silently ignore them.

That gives the model a chance to recover while keeping the allowed tool list explicit.

34. Tool failures are sent back into the same loop as structured error responses.

The model can then see that a file write or build failed and choose its next action.

A failure that becomes context is more useful than a failure that disappears into server logs.

35. Credits are checked before a generation starts.

If the user's balance is empty, the backend sends a specific `INSUFFICIENT_CREDITS` event and the frontend can open the pricing flow.

This keeps billing behavior connected to the actual build request.

36. Usage is charged from measured model usage, not from a vague “one prompt equals one price” rule.

The backend records input tokens, output tokens, cached input tokens, the model, and the credits charged.

That gives the billing system a useful audit trail.

37. The credit service uses idempotency keys.

If the same usage event is processed again, the ledger can return the existing transaction instead of charging twice.

Retries are normal in distributed systems, so billing needs to be retry-safe too.

38. Balance updates use compare-and-swap style checks inside transactions.

The service reads the current balance, calculates the next balance, and retries if another update changed the value first.

That is a practical way to protect concurrent credit updates.

39. The credit ledger stores the balance after each transaction.

That makes a transaction useful on its own: you can see the amount, reason, idempotency key, and resulting balance.

Billing data should help answer “what happened?” without reconstructing the entire system state.

40. The project treats generated applications as disposable environments.

That makes experimentation easier, but it creates a cleanup requirement.

A future inactivity policy should stop or delete old sandboxes so idle projects do not keep consuming memory, CPU, and disk space.

41. Keeping a container alive improves the experience because several operations can reuse the same workspace.

But persistence has a cost: stale processes, storage growth, and idle resources.

The right lifecycle depends on how long a user is actively working on a project.

42. A preview URL is only useful if the server behind it is healthy.

The system needs to think about startup failures, stopped containers, missing port bindings, and processes that exit after launch.

Returning a URL is not the same as proving the application is ready.

43. The Node template gives generated apps a small, known starting point:

- Express
- TypeScript
- a build command
- a dev command
- a health endpoint
- port 4000

A good template removes setup noise so the model can spend its effort on the user's actual request.

44. The generated Node template includes a `/health` endpoint.

That tiny endpoint is useful because it gives the running app a simple way to report that it is alive.

Small operational details like this make generated projects easier to inspect.

45. The template includes both `build` and `typecheck` scripts.

That gives the generated project a clear path for compiling TypeScript and checking it without emitting files.

Templates should include the commands the execution system expects, not just the source files.

46. The backend can download the source code from the workspace through the frontend.

That matters because a preview is not the final product.

Users should be able to take the generated files out of the builder and continue working with them elsewhere.

47. The frontend disables the composer while the agent is busy.

That prevents multiple prompts from racing through the same project workspace at once.

For stateful build systems, blocking conflicting mutations is often simpler than trying to merge them later.

48. The project separates “connection lost” from “invalid connection.”

A normal disconnect can be retried.
A WebSocket close with code 1008 indicates invalid credentials or project access.

Different failure causes deserve different user actions.

49. The design log helped me see that streamed logs are not a complete lifecycle model.

A real builder benefits from explicit states such as:

CREATED -> PREPARING -> GENERATING -> INSTALLING -> BUILDING -> STARTING -> READY

Errors and cancellation should be states too, not just lines in a log.

50. The biggest lesson from building this project:

The AI is only one component.

A useful website builder also needs templates, sandboxing, tool boundaries, build feedback, process management, authentication, persistence, billing, and a preview lifecycle.

The product is the system around the model.
