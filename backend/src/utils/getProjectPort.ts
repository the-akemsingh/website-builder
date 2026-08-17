export default function getProjectPort(template: string):number {
    if (template === "node") {
        return 4000
    }
    else if (template === "next") {
        return 4001
    }
    return 8000
}