import type { Content } from "@google/genai"

export default interface IChatSession {
    websiteId: string,
    templateName: "node" | "next",
    history: Content[]
}