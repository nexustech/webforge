import { eachElement } from "@webforge/model";
import { elementPlace } from "../fields.js";
import type { CheckRule, Finding } from "../types.js";

/**
 * Notes on elements still open (UX-17, #868): a tip each, which jumps to its element, its note as
 * the line's detail, until it's resolved. Every element's, not published or on a draft page included
 * (`drafts`), as a note is for the person, never on the website.
 */
export const notesRule: CheckRule = {
  id: "notes",
  level: "tip",
  drafts: true,
  check: ({ site }) => {
    const found: Finding[] = [];
    eachElement(site, (node, on) => {
      const { note } = node.props;
      if (typeof note !== "string" || note === "") return;
      found.push({
        key: `${on}/${node.props.id}/note`,
        place: elementPlace({ on, node }),
        values: { note },
      });
    });
    return found;
  },
};
