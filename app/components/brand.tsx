import { cn } from "~/lib/utils";

/** XDeck mark: three stacked cards. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={cn("size-5", className)}>
      <rect x="3" y="13" width="18" height="7" rx="2" fill="currentColor" opacity="0.35" />
      <rect x="3" y="8" width="18" height="7" rx="2" fill="currentColor" opacity="0.65" />
      <rect x="3" y="3" width="18" height="7" rx="2" fill="currentColor" />
    </svg>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <BrandMark />
      <span>XDeck</span>
    </div>
  );
}
