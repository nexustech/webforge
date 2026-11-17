import type { ReactNode } from "react";
import { RICH_TEXT_LIST_CLASSES } from "./typography.js";

/**
 * A title that opens to show what's under it: a native `<details>`, which opens and closes with
 * its `<summary>` by keyboard and pointer, and says whether it's open to screen readers, with no
 * script. The FAQ's "Questions that open" and the Accordion draw their items with it (6.16a).
 *
 * `group` is the `<details name>` of a set of which only one is open at a time: opening one closes
 * the others with the same name, in browsers that support it; in one that doesn't, each opens on
 * its own, as without it. It must be unique on the page.
 */
export function Disclosure({
  className,
  title,
  group,
  children,
}: {
  /** Its own class, which exported pages and tests find it by: `site-faq-item`. */
  readonly className: string;
  readonly title: ReactNode;
  readonly group?: string | undefined;
  readonly children: ReactNode;
}) {
  return (
    <details
      className={`${className} collapse-arrow collapse border border-base-300 bg-base-100`}
      name={group}
    >
      <summary className="collapse-title font-semibold">{title}</summary>
      <div className={`collapse-content [&_p+p]:mt-2 ${RICH_TEXT_LIST_CLASSES}`}>{children}</div>
    </details>
  );
}
