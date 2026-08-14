import type IParsedFile from "../types/IParsedFile"

export function parseXmlTemplate(xml: string): IParsedFile[] {
    const files: IParsedFile[] = []
    const fileRegex = /<file\s+path="([^"]+)">\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/file>/g
    let match: RegExpExecArray | null

    while ((match = fileRegex.exec(xml)) !== null) {
        files.push({
            path: match[1].trim(),
            content: match[2].trim()
        })
    }

    return files
} 