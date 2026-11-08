import type { ReactNode } from "react";

/** A heading over one of the cards, and its hint under it. */
export function PreviewSection({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
}) {
  return (
    <section aria-label={label} className="grid gap-1">
      <h3 className="m-0 text-xs text-muted-foreground">{label}</h3>
      {children}
      {hint === undefined ? null : <p className="m-0 text-xs text-muted-foreground">{hint}</p>}
    </section>
  );
}
