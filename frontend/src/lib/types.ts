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
  functionCallName: string | null;
  functionCallResponse: string | null;
  createdAt: string;
}

export interface WebsiteDetails {
  project: WebsiteSummary & { Messages: WebsiteMessage[] };
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
  | { type: "log"; message: string }
  | { type: "toolStart"; tool: ToolName }
  | { type: "toolEnd"; tool: ToolName; result?: string; error?: string }
  | { type: "final"; response: string }
  | { type: "error"; message: string };

export type SessionState =
  | "idle"
  | "creating_project"
  | "connecting"
  | "ai_processing"
  | "running_tool"
  | "completed"
  | "connection_lost"
  | "error";

export type FeedItem =
  | { kind: "user"; id: string; text: string }
  | { kind: "model"; id: string; text: string }
  | { kind: "log"; id: string; text: string }
  | {
      kind: "tool";
      id: string;
      tool: string;
      status: "running" | "done" | "failed";
      live?: boolean;
      detail?: string | undefined;
    }
  | { kind: "error"; id: string; text: string };
