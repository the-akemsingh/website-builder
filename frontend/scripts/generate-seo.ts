import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const siteUrl = (process.env.VITE_SITE_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
const publicDir = resolve(import.meta.dirname, "../public");

const robots = `User-agent: *
Allow: /
Disallow: /projects
Disallow: /workspace/
Disallow: /billing/

Sitemap: ${siteUrl}/sitemap.xml
`;

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${siteUrl}/</loc></url>
  <url><loc>${siteUrl}/pricing</loc></url>
</urlset>
`;

const llms = `# Forge

Forge is a prompt-based website builder. Users describe a website, receive a live project preview, and refine the project through chat.

## Public pages

- [Forge home](${siteUrl}/): Start a website project from a natural-language prompt.
- [Forge plans](${siteUrl}/pricing): Review available plans and one-time credit top-ups.

## Private application areas

Project lists, individual workspaces, and payment confirmation pages require authentication and are not public documentation.

## Accuracy note

This file describes the public product experience visible in this repository. It is provided for AI system discovery and is not a guarantee of search ranking, indexing, or citation.
`;

const llmsFull = `# Forge

Forge is a web application for building websites from natural-language prompts. The home page invites a user to sign in with Google, submit a prompt, and start a website project. A project has a live preview and can be refined through a chat-based builder.

## Public product pages

### Home

URL: ${siteUrl}/

The home page describes the core workflow: a prompt starts a real project with a live preview, and additional chat messages can change it. Example prompts include a photographer portfolio, a coffee roastery landing page, and an indie climbing gym site.

### Plans

URL: ${siteUrl}/pricing

The plans page presents available subscription plans returned by the application backend. It also supports a one-time credit top-up. Prices, currencies, plan names, and credit amounts are loaded at runtime and should not be inferred from this file.

## Private areas

The projects list, individual workspace routes, and payment-return route are application surfaces for authenticated users. They are not public product documentation and should not be indexed as public content.

## Scope and accuracy

This summary is limited to content and behavior represented by the frontend application. It does not claim ownership, company details, social accounts, customer results, or guarantees that are not stated in the application. \`llms.txt\` and \`llms-full.txt\` are descriptive discovery aids, not guaranteed ranking, indexing, or AI citation mechanisms.
`;

await mkdir(publicDir, { recursive: true });
await Promise.all([
  writeFile(resolve(publicDir, "robots.txt"), robots),
  writeFile(resolve(publicDir, "sitemap.xml"), sitemap),
  writeFile(resolve(publicDir, "llms.txt"), llms),
  writeFile(resolve(publicDir, "llms-full.txt"), llmsFull),
]);

console.log(`Generated SEO files for ${siteUrl}`);
