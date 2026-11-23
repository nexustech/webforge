import type { ReactNode } from "react";
import { SectionTitle } from "./typography.js";

/**
 * A column's title in the Footer: a section's title drawn in its column form, as a small title. An
 * empty one is left out of the export.
 */
export function FooterColumnTitle({ children }: { readonly children: ReactNode }) {
  if (typeof children === "string" && children.trim() === "") return null;
  return <SectionTitle size="small">{children}</SectionTitle>;
}
