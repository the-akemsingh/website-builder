import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

type LogContext = Record<string, unknown>;

function serializeError(error: unknown) {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
            cause: error.cause instanceof Error ? error.cause.message : error.cause,
        };
    }

    return { value: String(error) };
}

export function logError(message: string, error: unknown, context: LogContext = {}) {
    console.error(JSON.stringify({
        level: "error",
        message,
        error: serializeError(error),
        ...context,
    }));
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
    const requestId = randomUUID();
    const startedAt = Date.now();
    res.setHeader("X-Request-Id", requestId);

    res.on("finish", () => {
        console.info(JSON.stringify({
            level: res.statusCode >= 500 ? "error" : "info",
            message: "http_request",
            requestId,
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: Date.now() - startedAt,
        }));
    });

    next();
}

export function requestId(res: Response) {
    return String(res.getHeader("X-Request-Id") ?? "unknown");
}
