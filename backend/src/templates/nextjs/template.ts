export const next = `
<?xml version="1.0" encoding="UTF-8"?>
<template name="next" version="1.0.0">
  <metadata>
    <framework>nextjs</framework>
    <language>typescript</language>
    <package_manager>npm</package_manager>
    <dev_command>npm run dev</dev_command>
    <build_command>npm run build</build_command>
    <start_command>npm start</start_command>
    <port>4001</port>
  </metadata>

  <files>
    <file path=".gitignore"><![CDATA[
node_modules/
.next/
out/
dist/
.env
.env.*
!.env.example
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
.DS_Store
.vscode/
.idea/
    ]]></file>

    <file path="package.json"><![CDATA[
{
  "name": "generated-next-app",
  "private": true,
  "version": "0.0.0",
  "scripts": {
    "dev": "next dev -p 4001",
    "build": "next build",
    "start": "next start -p 4001",
    "lint": "eslint"
  },
  "dependencies": {
    "next": "^15.5.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "lucide-react": "^0.468.0",
    "@tailwindcss/postcss": "^4.1.13"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3.3.1",
    "@types/node": "^24.0.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "eslint": "^9.35.0",
    "eslint-config-next": "^15.5.0",
    "tailwindcss": "^4.1.13",
    "typescript": "^5.9.2"
  }
}
    ]]></file>

    <file path="tsconfig.json"><![CDATA[
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    ".next/types/**/*.ts",
    "**/*.ts",
    "**/*.tsx"
  ],
  "exclude": ["node_modules"]
}
    ]]></file>

    <file path="next-env.d.ts"><![CDATA[
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript
    ]]></file>

    <file path="next.config.ts"><![CDATA[
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true
};

export default nextConfig;
    ]]></file>

    <file path="eslint.config.mjs"><![CDATA[
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript")
];

export default eslintConfig;
    ]]></file>

    <file path="postcss.config.mjs"><![CDATA[
export default {
  plugins: {
    "@tailwindcss/postcss": {}
  }
};
    ]]></file>

    <file path="src/app/layout.tsx"><![CDATA[
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Generated Website",
  description: "Built with Next.js"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
    ]]></file>

    <file path="src/app/page.tsx"><![CDATA[
export default function Home() {
  return (
    <main className="min-h-screen bg-white text-black">
      <section className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            Start prompting to build your website
          </h1>

          <p className="mt-4 text-gray-600">
            Your AI-generated website will appear here.
          </p>
        </div>
      </section>
    </main>
  );
}
    ]]></file>

    <file path="src/app/globals.css"><![CDATA[
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
    ]]></file>
  </files>
</template>
`