import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/features/auth/auth";
import { OutOfCreditsProvider } from "@/features/billing/billing";

function NotFoundComponent() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <h1 className="display text-7xl">404</h1>
        <p className="mt-3">This page doesn't exist.</p>
        <Link to="/" className="btn btn-primary mt-6">Go home</Link>
      </div>
    </main>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <h1 className="display text-3xl">This page didn't load</h1>
        <p className="mt-2">Something went wrong. Try again.</p>
        <button className="btn btn-primary mt-6" onClick={() => { router.invalidate(); reset(); }}>
          Try again
        </button>
      </div>
    </main>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Sitewright — AI website builder" },
      { name: "description", content: "Describe a website and an AI agent builds it live." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          // Applies the saved theme before first paint so light-theme users never see a dark flash.
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("sw_theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OutOfCreditsProvider>
          <Outlet />
        </OutOfCreditsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
