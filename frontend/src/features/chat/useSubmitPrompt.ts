import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api, isOutOfCredits } from "@/lib/api";
import { pendingPrompt } from "@/lib/brand";
import { useAuth } from "@/features/auth/auth";
import { useOutOfCredits } from "@/features/billing/billing";

/** Creates a project from a prompt (or saves it and signs in first). The initial prompt travels through the socket. */
export function useStartBuild() {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const outOfCredits = useOutOfCredits();

  const m = useMutation({
    mutationFn: (prompt: string) => api.createWebsite(prompt),
    onSuccess: ({ websiteId }, prompt) => {
      qc.invalidateQueries({ queryKey: ["websites"] });
      navigate({ to: "/app/$websiteId", params: { websiteId }, search: { prompt } });
    },
    onError: (e, prompt) => {
      if (isOutOfCredits(e)) outOfCredits({ prompt });
    },
  });

  const start = (prompt: string) => {
    if (status !== "authed") {
      pendingPrompt.set({ prompt });
      signIn();
      return;
    }
    m.mutate(prompt);
  };
  return { start, ...m, errorIsCredits: isOutOfCredits(m.error) };
}
