import { unpublishedRoots } from "@webforge/model";
import { elementPlace } from "../fields.js";
import type { CheckRule } from "../types.js";

/**
 * Elements set to **Don't Publish** (#1512): a tip each, which jumps to its element, so an element
 * left out by a click on its icon isn't missed. The outermost only, as the canvas badges them, so a
 * section left out counts once, not once for each element in it. Never something to fix, and with
 * no *Fix*: **Show** on the element's badge, or in Layers, puts it back. Listed only while there
 * is one, as most sites never leave anything out.
 */
export const unpublishedRule: CheckRule = {
  id: "unpublished",
  level: "tip",
  onlyWhenFound: true,
  check: ({ site }) =>
    unpublishedRoots(site).map(({ node, on }) => ({
      key: `${on}/${node.props.id}`,
      place: elementPlace({ on, node }),
    })),
};
