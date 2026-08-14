import type { Schema } from '@google/genai';

export interface ITool {
    declaration: {
        name: string;
        description: string;
        parameters: Schema;
    };
    execute: (args: Record<string, unknown>) => Promise<string>;
}