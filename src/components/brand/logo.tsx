import { cn } from "@/lib/utils";

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 28 28"
        className={cn("size-7", inverted ? "text-ink" : "text-fg")}
        aria-hidden
      >
        <rect width="28" height="28" rx="6" fill="currentColor" opacity="0.08" />
        <path
          d="M6 22 L14 6 L22 22"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="square"
        />
        <path d="M10 22 H18" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
      <span
        className={cn(
          "font-display text-xl tracking-tight",
          inverted ? "text-ink" : "text-fg",
        )}
      >
        Yard
      </span>
    </span>
  );
}
