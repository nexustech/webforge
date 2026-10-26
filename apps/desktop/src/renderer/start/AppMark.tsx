import { LayersIcon } from "lucide-react";

/**
 * Webforge's mark on the start screen (LF-10, SC-2): a placeholder, a Lucide icon in the brand
 * colour on a rounded tile, until the real logo is designed (#454). It's in one place so the logo
 * replaces it here, for the start screen and About alike.
 */
export function AppMark() {
  return (
    <span
      className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
      aria-hidden
    >
      <LayersIcon className="size-7" />
    </span>
  );
}
