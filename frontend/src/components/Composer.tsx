import { useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ComposerProps {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
  placeholder?: string;
  tone?: "light" | "dark";
  hint?: string | undefined;
  autoFocus?: boolean;
}

export function Composer({
  onSubmit,
  disabled = false,
  placeholder = "Describe the website you want to build…",
  tone = "light",
  hint,
  autoFocus,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const empty = value.trim().length === 0;
  const dark = tone === "dark";

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    setTouched(true);
    if (empty || disabled) return;
    onSubmit(value.trim());
    setValue("");
    setTouched(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form
      onSubmit={submit}
      className={cn(
        "w-full rounded-3xl border p-3 transition-colors",
        dark
          ? "border-panel-border bg-panel-raised focus-within:border-accent"
          : "border-border bg-card focus-within:border-accent",
        disabled && "opacity-70",
      )}
    >
      <textarea
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          "w-full resize-none bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed",
          dark && "text-panel-foreground placeholder:text-panel-muted",
        )}
      />
      <div className="flex items-center justify-between gap-3 px-2 pt-1">
        <p className={cn("text-xs", dark ? "text-panel-muted" : "text-muted-foreground")}>
          {touched && empty
            ? "Write a prompt first."
            : disabled
              ? "A build is running — hold on."
              : (hint ?? "Enter to send · Shift + Enter for a new line")}
        </p>
        <Button
          type="submit"
          variant={dark ? "pill" : "pill"}
          size="pillIcon"
          disabled={disabled || empty}
          aria-label="Send prompt"
        >
          <ArrowUp />
        </Button>
      </div>
    </form>
  );
}
