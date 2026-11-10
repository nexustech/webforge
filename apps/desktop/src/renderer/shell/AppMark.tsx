import { cn } from "@webforge/editor-ui";
import appIcon from "../../../branding/icon.svg";

/**
 * Webforge's icon (#454): the logo's master, as the app icon draws it from 48 px up, beside the
 * app's name on the start screen (LF-10, SC-2) and in About. Decorative: the name beside it says
 * what it is. The ring keeps the charcoal tile's edge in sight on the dark theme.
 */
export function AppMark({ className }: { readonly className?: string }) {
  return (
    <img
      src={appIcon}
      alt=""
      draggable={false}
      className={cn("size-12 shrink-0 rounded-[22%] ring-1 ring-border", className)}
    />
  );
}
