import dotenv from 'dotenv';
dotenv.config();

interface Config {
    apiServerPort: number;
    geminiApiKey: string;
}

class ConfigLoader {
    private static instance: ConfigLoader;
    private config: Config;

    private constructor() {
        this.config = {
            apiServerPort: Number(process.env.API_SERVER_PORT) || 3000,
            geminiApiKey: process.env.GEMINI_API_KEY || '',
        };
    }

    public static getInstance(): ConfigLoader {
        if (!ConfigLoader.instance) {
            ConfigLoader.instance = new ConfigLoader();
        }
        return ConfigLoader.instance;
    }

    public get<K extends keyof Config>(key: K): Config[K] {
        return this.config[key];
    }

    public validate(): void {
        if (!this.config.geminiApiKey) {
            throw new Error('GEMINI_API_KEY is required');
        }
        if (!this.config.apiServerPort) {
            throw new Error(' is required');
        }
    }
}

export const config = ConfigLoader.getInstance();