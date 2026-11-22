import { createContext, type ReactNode, use } from "react";
import { SectionTitle } from "./typography.js";

/**
 * Whether what's drawn is in a column of the Footer (HF-4, 5.39): a section that fits a column
 * (Contact details, Newsletter signup) draws its column form there, without its section's frame.
 */
export const FooterColumnContext = createContext(false);

/**
 * A section's frame, or its column form in a Footer column (5.39): which one, React's context
 * says, so a section placed in a column needs no field of its own to say so.
 */
export function FramedOrColumn({
  framed,
  column,
}: {
  readonly framed: ReactNode;
  readonly column: ReactNode;
}) {
  return use(FooterColumnContext) ? column : framed;
}

/**
 * A column's title in the Footer: a section's title drawn in its column form, as a small title. An
 * empty one is left out of the export.
 */
export function FooterColumnTitle({ children }: { readonly children: ReactNode }) {
  if (typeof children === "string" && children.trim() === "") return null;
  return <SectionTitle size="small">{children}</SectionTitle>;
}
