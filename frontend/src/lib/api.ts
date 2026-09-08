import type {
  CreateWebsiteResponse,
  LoginResponse,
  WebsiteDetails,
  WebsiteSummary,
} from "./types";

export const API_URL =
  (import.meta.env["VITE_API_URL"] as string | undefined) ??
  "http://localhost:3000/api/v1";

export const WS_URL = API_URL.replace(/^http/, "ws");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

function messageForStatus(status: number, fallback?: string): string {
  if (fallback) return fallback;
  if (status === 400) return "That request was missing something. Check your prompt and try again.";
  if (status === 401) return "Your session expired. Please sign in again.";
  if (status === 404) return "That project no longer exists.";
  if (status >= 500) return "The server had a problem. Try again in a moment.";
  return `Request failed (${status}).`;
}

async function request<T>(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<T | null> {
  const { token, headers, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        ...(rest.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Is the backend running?");
  }

  if (!response.ok) {
    let detail: string | undefined;
    try {
      const body = await response.json();
      if (body && typeof body.message === "string") detail = body.message;
    } catch {
      /* empty or non-JSON body */
    }
    throw new ApiError(response.status, messageForStatus(response.status, detail));
  }

  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function loginWithGoogle(googleToken: string): Promise<LoginResponse> {
  const data = await request<LoginResponse>("/auth/google/", {
    method: "POST",
    body: JSON.stringify({ token: googleToken }),
  });
  if (!data) throw new ApiError(500, "The sign-in response was empty.");
  return data;
}

export async function createWebsite(
  prompt: string,
  token: string,
): Promise<CreateWebsiteResponse> {
  const data = await request<CreateWebsiteResponse>("/website", {
    method: "POST",
    token,
    body: JSON.stringify({ prompt }),
  });
  if (!data) throw new ApiError(500, "The server didn't return a project.");
  return data;
}

export async function listWebsites(token: string): Promise<WebsiteSummary[]> {
  const data = await request<WebsiteSummary[]>("/website/", { token });
  return data ?? [];
}

export async function getWebsite(
  websiteId: string,
  token: string,
): Promise<WebsiteDetails> {
  const data = await request<WebsiteDetails>(`/website/${encodeURIComponent(websiteId)}`, {
    token,
  });
  if (!data) throw new ApiError(404, "That project no longer exists.");
  return data;
}

export async function deleteWebsite(websiteId: string, token: string): Promise<void> {
  await request<null>(`/website/${encodeURIComponent(websiteId)}`, {
    method: "DELETE",
    token,
  });
}
