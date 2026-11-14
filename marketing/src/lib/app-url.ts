const appUrl = import.meta.env["NEXT_PUBLIC_APP_URL"] as string | undefined;
export const signInUrl = appUrl ? `${appUrl.replace(/\/$/, "")}/signin` : "/signin";
