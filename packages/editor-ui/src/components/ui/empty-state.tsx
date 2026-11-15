import type { ComponentType, ReactNode } from "react";
import { cn } from "../../lib/cn.js";

/** Props of {@link EmptyState}. */
export type EmptyStateProps = {
  /** What's empty, and the next step: "This page has no sections yet. Add one from…". */
  readonly children: ReactNode;
  /** A Lucide icon over the text, for a panel's whole empty state. */
  readonly icon?: ComponentType<{ readonly className?: string; readonly "aria-hidden"?: boolean }>;
  /** The next step as a button, under the text. */
  readonly action?: ReactNode;
  /** `status` for one a screen reader should hear as it appears, as when a list has loaded empty. */
  readonly role?: "status";
  readonly className?: string;
};

/**
 * What a panel or list says when it has nothing to show (#1012, UI/UX audit §6.6): one look for
 * every empty state, the text centred and muted, with an optional icon over it and an action under
 * it. The text says what's missing and where to go next.
 */
export function EmptyState({ children, icon: Icon, action, role, className }: EmptyStateProps) {
  return (
    <div
      role={role}
      className={cn(
        "flex flex-col items-center gap-2 px-3 py-4 text-center text-xs text-muted-foreground",
        className,
      )}
    >
      {Icon === undefined ? null : <Icon aria-hidden className="size-5" />}
      <p className="m-0 max-w-72 text-balance">{children}</p>
      {action}
    </div>
  );
}
