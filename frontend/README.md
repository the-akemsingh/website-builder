# Backend Contract for Frontend Integration This document describes how the frontend communicates...

# Backend Contract for Frontend Integration

This document describes how the frontend communicates with the backend through HTTP APIs and WebSockets. Frontend developers should not need to inspect backend code.

## 1. Base URLs

Configure the backend URL through an environment variable:

```env
VITE_API_URL=http://localhost:3000/api/v1
```

Default value:

```text
http://localhost:3000/api/v1
```

WebSocket URL:

```ts
const WS_URL = API_URL.replace(/^http/, "ws");
```

Example:

```text
ws://localhost:3000/api/v1/?websiteId=<WEBSITE_ID>
```

The backend WebSocket server runs on the same host and port as the HTTP server.

## 2. Authentication

Authentication uses Google OAuth followed by a backend-generated JWT.

### Login

```http
POST /auth/google/
Content-Type: application/json
```

Request:

```json
{
  "token": "GOOGLE_ID_TOKEN"
}
```

The `token` is the Google credential returned by Google Sign-In.

Successful response:

```json
{
  "message": "Login successful",
  "token": "BACKEND_JWT_TOKEN",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "User Name",
    "image": "https://profile-image-url"
  }
}
```

The backend JWT expires after seven days.

Store the backend JWT and send it with protected API requests:

```http
Authorization: Bearer BACKEND_JWT_TOKEN
```

### Authentication status codes

| Status | Meaning |
|---|---|
| `200` | Login successful |
| `400` | Google token is missing or invalid |
| `500` | Unexpected server or database error |

Possible error responses:

```json
{
  "message": "Google token is required"
}
```

```json
{
  "message": "Invalid Google token"
}
```

## 3. Health Check

### Request

```http
GET /health
```

Authentication is not required.

### Successful response

```http
200 OK
```

The response body is empty.

### Frontend usage

```ts
async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
```

## 4. Create a Website Project

### Request

```http
POST /website
Authorization: Bearer BACKEND_JWT_TOKEN
Content-Type: application/json
```

Request body:

```json
{
  "prompt": "Build a modern portfolio website for a photographer"
}
```

### Successful response

```json
{
  "websiteId": "website-id",
  "projectUrl": "http://localhost:4001"
}
```

`websiteId` identifies the project. `projectUrl` is the live preview URL.

### Status codes

| Status | Meaning |
|---|---|
| `200` | Project created successfully |
| `400` | `prompt` is missing or empty |
| `401` | Missing, invalid, or expired JWT |
| `500` | Project creation, Docker, database, or AI failure |

Possible `400` response:

```http
400 Bad Request
```

The response body may be empty.

### Important behavior

This endpoint:

1. Validates the prompt.
2. Uses AI to choose a project template.
3. Creates a database project.
4. Creates a project container.
5. Installs dependencies.
6. Starts the preview server.
7. Returns the project ID and preview URL.

The initial prompt is not processed by the AI builder yet. The frontend must send the prompt again through the WebSocket after connecting.

## 5. List the Current User’s Websites

### Request

```http
GET /website/
Authorization: Bearer BACKEND_JWT_TOKEN
```

### Successful response

```json
[
  {
    "id": "website-id",
    "title": "Photography Portfolio",
    "createdAt": "2026-09-08T10:00:00.000Z",
    "templateName": "next"
  }
]
```

### Status codes

| Status | Meaning |
|---|---|
| `200` | Websites returned |
| `401` | Missing, invalid, or expired JWT |
| `500` | Database or server error |

## 6. Get a Website by ID

### Request

```http
GET /website/:websiteId
Authorization: Bearer BACKEND_JWT_TOKEN
```

Example:

```http
GET /website/abc123
```

### Successful response

```json
{
  "project": {
    "id": "abc123",
    "title": "Photography Portfolio",
    "createdAt": "2026-09-08T10:00:00.000Z",
    "templateName": "next",
    "Messages": [
      {
        "id": "message-id",
        "role": "user",
        "text": "Build a portfolio website",
        "createdAt": "2026-09-08T10:01:00.000Z"
      },
      {
        "id": "message-id-2",
        "role": "model",
        "text": "I created the portfolio layout.",
        "createdAt": "2026-09-08T10:02:00.000Z"
      }
    ]
  },
  "url": "http://localhost:4001"
}
```

### Status codes

| Status | Meaning |
|---|---|
| `200` | Website returned |
| `401` | Missing, invalid, or expired JWT |
| `404` | Website does not exist |
| `500` | Database or server error |

## 7. Delete a Website

### Request

```http
DELETE /website/:websiteId
Authorization: Bearer BACKEND_JWT_TOKEN
```

Example:

```http
DELETE /website/abc123
```

### Successful response

```http
200 OK
```

The current backend sends an empty response body. Do not assume that it returns:

```json
{
  "success": true
}
```

### Status codes

| Status | Meaning |
|---|---|
| `200` | Website deleted |
| `401` | Missing, invalid, or expired JWT |
| `404` | Missing website ID |
| `500` | Delete operation failed |

## 8. WebSocket Connection

The WebSocket is used for sending prompts and receiving live AI/build progress.

### Connection URL

```text
ws://localhost:3000/api/v1/?websiteId=<WEBSITE_ID>
```

Example:

```ts
const socket = new WebSocket(
  `${WS_URL}/?websiteId=${encodeURIComponent(websiteId)}`
);
```

The current WebSocket connection does not use the JWT in the connection request.

### Connection rejection

The backend closes the socket with code `1008` when:

- `websiteId` is missing
- `websiteId` does not exist

Example frontend handling:

```ts
socket.onclose = (event) => {
  if (event.code === 1008) {
    showError("This project is invalid or no longer exists.");
  }
};
```

## 9. Send a Chat Prompt

After the WebSocket opens, send:

```json
{
  "type": "chat",
  "prompt": "Add a testimonials section with three customer quotes"
}
```

TypeScript helper:

```ts
function sendPrompt(socket: WebSocket, prompt: string) {
  const value = prompt.trim();

  if (!value) {
    return;
  }

  socket.send(
    JSON.stringify({
      type: "chat",
      prompt: value,
    }),
  );
}
```

The backend processes one prompt at a time. The frontend should disable the prompt input while a build is running.

## 10. WebSocket Server Events

All WebSocket messages from the backend are JSON strings.

### Log event

```json
{
  "type": "log",
  "message": "Starting AI processing..."
}
```

Use this for progress messages.

### Tool started event

```json
{
  "type": "toolStart",
  "tool": "readFile"
}
```

Possible tool names:

```ts
type ToolName =
  | "readFile"
  | "writeFile"
  | "deleteFile"
  | "installDependency"
  | "buildProject";
```

### Tool completed event

Successful tool result:

```json
{
  "type": "toolEnd",
  "tool": "writeFile",
  "result": "File written successfully: src/App.tsx"
}
```

Failed tool result:

```json
{
  "type": "toolEnd",
  "tool": "buildProject",
  "error": "Build failed"
}
```

A `toolEnd` event contains either `result` or `error`, never both.

### Final event

```json
{
  "type": "final",
  "response": "The website has been updated successfully."
}
```

When this event arrives:

1. Mark the build as complete.
2. Re-enable the prompt input.
3. Refresh the preview iframe.

Example:

```ts
const refreshedUrl = `${projectUrl}?refresh=${Date.now()}`;
```

### Error event

```json
{
  "type": "error",
  "message": "Internal server error"
}
```

When this event arrives:

1. Stop the loading state.
2. Display the error.
3. Keep the existing WebSocket open if possible.
4. Allow the user to retry.

### Invalid JSON

If the frontend sends malformed JSON:

```json
{
  "type": "error",
  "message": "Invalid JSON"
}
```

### Invalid message format

For an unsupported message:

```json
{
  "type": "error",
  "message": "Invalid message format"
}
```

## 11. Recommended WebSocket State Machine

```ts
type SessionState =
  | "idle"
  | "creating_project"
  | "connecting"
  | "ai_processing"
  | "running_tool"
  | "completed"
  | "connection_lost"
  | "error";
```

Recommended transitions:

```text
idle
  -> creating_project
  -> connecting
  -> ai_processing
  -> running_tool
  -> ai_processing
  -> completed
```

Error paths:

```text
creating_project -> error
connecting -> error
ai_processing -> error
running_tool -> error
any state -> connection_lost
```

## 12. Complete Frontend Flow

### Existing project

1. Load the JWT from the authentication state.
2. Request the website list.
3. User selects a website.
4. Request the website details.
5. Display the saved messages.
6. Display the returned preview URL.
7. Connect to the WebSocket using the website ID.
8. Send prompts through the WebSocket.
9. Render progress events.
10. Refresh the preview after a `final` event.

### New project

1. User signs in with Google.
2. Frontend receives the backend JWT.
3. User enters a website prompt.
4. Frontend sends `POST /website`.
5. Backend returns `websiteId` and `projectUrl`.
6. Frontend navigates to the workspace.
7. Frontend opens the WebSocket.
8. After `onopen`, frontend sends the original prompt again.
9. Frontend renders `log`, `toolStart`, `toolEnd`, `final`, and `error` events.
10. Frontend refreshes the preview after `final`.

Example:

```ts
const project = await createProject(prompt, token);

const socket = new WebSocket(
  `${WS_URL}/?websiteId=${encodeURIComponent(project.websiteId)}`
);

socket.onopen = () => {
  socket.send(
    JSON.stringify({
      type: "chat",
      prompt,
    }),
  );
};
```

## 13. Suggested Shared Types

```ts
export interface User {
  id: string;
  email: string;
  name: string;
  image?: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

export interface WebsiteSummary {
  id: string;
  title: string;
  createdAt: string;
  templateName: string;
}

export interface WebsiteMessage {
  id: string;
  role: string;
  text: string | null;
  createdAt: string;
}

export interface WebsiteDetails {
  project: WebsiteSummary & {
    Messages: WebsiteMessage[];
  };
  url: string;
}

export interface CreateWebsiteResponse {
  websiteId: string;
  projectUrl: string;
}

export type ToolName =
  | "readFile"
  | "writeFile"
  | "deleteFile"
  | "installDependency"
  | "buildProject";

export type ServerEvent =
  | {
      type: "log";
      message: string;
    }
  | {
      type: "toolStart";
      tool: ToolName;
    }
  | {
      type: "toolEnd";
      tool: ToolName;
      result?: string;
      error?: string;
    }
  | {
      type: "final";
      response: string;
    }
  | {
      type: "error";
      message: string;
    };
```

## 14. Frontend Error Handling

The frontend should handle:

- Backend unavailable
- `401` by clearing the session and redirecting to login
- `400` by displaying an input validation error
- `404` by displaying that the project no longer exists
- `500` by displaying a retryable server error
- WebSocket close code `1008` by returning the user to the project list or new-project screen
- WebSocket disconnects by showing a reconnect option
- Invalid or empty prompts before sending them
- Duplicate prompt submissions while a build is active

## 15. Current Contract Limitations

The current backend does not expose endpoints for:

- File browsing
- File downloading
- Publishing
- Sharing
- Billing
- Project renaming
- Manual build triggering
- Project restoration
- WebSocket authentication

The frontend should not build UI for these features unless the backend contract is extended.

## Copy-Paste Prompt for a Frontend Developer or AI

```text
Build the frontend against this backend contract.

Backend base URL:
VITE_API_URL defaults to http://localhost:3000/api/v1.

Authentication:
- POST /auth/google/
- Request: { token: string }
- Response: { message, token, user: { id, email, name, image? } }
- Store the returned JWT.
- Send Authorization: Bearer <jwt> with every /website request.
- JWT expires after seven days.

HTTP endpoints:
- GET /health
  - Public.
  - Returns 200 with an empty body when healthy.

- POST /website
  - Requires JWT.
  - Body: { prompt: string }
  - Returns: { websiteId: string, projectUrl: string }
  - 400 for missing prompt, 401 for invalid JWT, 500 for server failure.
  - This creates the project but does not process the prompt through the AI builder.

- GET /website/
  - Requires JWT.
  - Returns an array of:
    { id, title, createdAt, templateName }

- GET /website/:websiteId
  - Requires JWT.
  - Returns:
    {
      project: {
        id,
        title,
        createdAt,
        templateName,
        Messages: [
          { id, role, text, createdAt }
        ]
      },
      url
    }
  - Returns 404 when the project does not exist.

- DELETE /website/:websiteId
  - Requires JWT.
  - Returns 200 with an empty body on success.
  - Do not expect a JSON success object.

WebSocket:
- Connect to:
  ws://localhost:3000/api/v1/?websiteId=<websiteId>
- The current WebSocket does not use JWT authentication.
- Close code 1008 means the websiteId is missing or invalid.
- Send prompts as:
  { type: "chat", prompt: string }

Handle these server events:
- { type: "log", message: string }
- { type: "toolStart", tool: "readFile" | "writeFile" | "deleteFile" | "installDependency" | "buildProject" }
- { type: "toolEnd", tool, result? }
- { type: "toolEnd", tool, error? }
- { type: "final", response: string }
- { type: "error", message: string }

When a final event arrives:
- Stop the loading state.
- Re-enable the prompt input.
- Refresh the preview iframe using:
  `${projectUrl}?refresh=${Date.now()}`

New project flow:
1. Call POST /website with the prompt.
2. Receive websiteId and projectUrl.
3. Open the WebSocket.
4. After socket.onopen, send the original prompt through the WebSocket.
5. Display live build events.
6. Show the project preview using projectUrl.

Do not implement file browsing, publishing, sharing, billing, downloads, or other endpoints because they are not part of the current backend contract.
````````````



Do: flat colors, one non-purple accent, pill-shaped primary buttons and a large-radius composer card (per the reference), dark chat / light preview split on the dashboard, monospace for tool names/URLs/IDs.

Don't: add any gradient or purple/violet,  add a display serif headline (that's a different product), or invent multi-page/publish/billing behavior this API doesn't define.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4d42bc88-0330-4f76-94d7-ef19ad1bff45).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
