# Deployment

The public marketing site and the authenticated application are separate Vercel
projects:

| Project | Vercel root directory | Domain |
| --- | --- | --- |
| Marketing | `marketing` | `askdocs.com` |
| Application | `frontend` | `app.askdocs.com` |

## Environment variables

Set `NEXT_PUBLIC_APP_URL=https://app.askdocs.com` in the Marketing project.
The marketing site's Get started, Sign up, and Sign in links use this value and
append `/signin`; no production domain is embedded in the source.

Set the existing application variables in the Application project:

- `VITE_API_URL`
- `VITE_WS_URL`
- `VITE_GOOGLE_CLIENT_ID`

`VITE_API_URL` must be the public backend URL, including `/api/v1` (for example,
`https://api.example.com/api/v1`). It is compiled into the frontend at build
time; changing backend `.env` does not change it. The backend must be reachable
over HTTPS from the browser, and the VM firewall/security group must allow the
backend port or its reverse proxy.

The backend Compose service publishes port `8000` on all interfaces so a
reverse proxy can reach it. For production, put it behind HTTPS and restrict
direct access to port `8000` to the reverse proxy where possible.

For local development, copy each app's `.env.example` to `.env` and use the
local application URL for `NEXT_PUBLIC_APP_URL`.

## Build settings

Each project installs dependencies and runs `npm run build` from its own root
directory. The marketing project is a static Vite app; the application project
uses the existing TanStack Start/Vite build.
