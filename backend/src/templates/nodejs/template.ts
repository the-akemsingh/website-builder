export const node = `
<?xml version="1.0" encoding="UTF-8"?>
<template name="node" version="1.0.0">
  <metadata>
    <framework>node</framework>
    <language>typescript</language>
    <package_manager>npm</package_manager>
    <dev_command>npm run dev</dev_command>
    <build_command>npm run build</build_command>
    <start_command>npm start</start_command>
    <port>4000</port>
  </metadata>

  <files>
    <file path=".gitignore"><![CDATA[
node_modules/
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
  "name": "generated-node-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "express": "^5.1.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.3",
    "@types/node": "^24.0.0",
    "tsx": "^4.19.4",
    "typescript": "^5.9.2"
  }
}
    ]]></file>

    <file path="tsconfig.json"><![CDATA[
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": false
  },
  "include": ["src"]
}
    ]]></file>

    <file path="src/index.ts"><![CDATA[
import express from "express";
import cors from "cors";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "Hello from your Node.js application!"
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running locally on http://localhost:4000");
});
    ]]> </file>

  < file path = ".env.example" ><![CDATA[
    PORT=3000
  ]]> </file>
    </files>
    </template>
`