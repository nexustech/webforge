import type { PageDoc } from "@webforge/model";
import type { ComponentLibrary } from "@webforge/site-components";
import { staleRichText } from "./stale-rich-text.js";
import { allNodes } from "./tree.js";

/** Per element, a number bumped to remount its rich-text editors (see `toPuckConfig`). */
export type EditorRevisions = Map<string, number>;

/**
 * Remounts the rich-text editors that a change of the page from `before` to `after` would leave
 * showing their old text (an Undo while typing, ADR 0004): bumps their revisions, and forgets the
 * elements `after` no longer has. Returns `focused`, the editor being typed in, if it is one of
 * them, so it gets the focus back.
 */
export function remountStale(
  revisions: EditorRevisions,
  library: ComponentLibrary,
  before: PageDoc,
  after: PageDoc,
  focused: string | null,
): string | null {
  let refocus: string | null = null;
  for (const id of staleRichText(library, before, after)) {
    revisions.set(id, (revisions.get(id) ?? 0) + 1);
    if (id === focused) refocus = id;
  }
  const ids = new Set(allNodes(after).map((node) => node.props.id));
  for (const id of revisions.keys()) {
    if (!ids.has(id)) revisions.delete(id);
  }
  return refocus;
}
