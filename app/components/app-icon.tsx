import { useState } from "react";
import { cn } from "~/lib/utils";

/** App icon from its repository; the initial on a tile when there is none. */
export function AppIcon({
  src,
  name,
  className,
}: {
  src: string | null | undefined;
  name: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const base = cn(
    "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background",
    className,
  );
  if (!src || broken) {
    return (
      <div aria-hidden className={cn(base, "bg-muted font-semibold text-muted-foreground")}>
        {name.slice(0, 1).toUpperCase()}
      </div>
    );
  }
  return (
    <div className={base}>
      <img
        src={src}
        alt=""
        loading="lazy"
        className="size-[70%] object-contain"
        onError={() => setBroken(true)}
      />
    </div>
  );
}
