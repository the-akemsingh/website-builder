import type { Content } from "@google/genai"

export default interface IChatSession {
    projectId: string,
    templateName: "node" | "next",
    history: Content[]
}