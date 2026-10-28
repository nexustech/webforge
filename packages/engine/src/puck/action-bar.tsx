import { createUsePuck } from "@puckeditor/core";
import { APPEARANCE_FIELDS, type ComponentLibrary } from "@webforge/site-components";
import { type ComponentProps, useSyncExternalStore } from "react";
import type { ElementRequest, Unsubscribe } from "../canvas-engine.js";
import { type ElementActions, QuickActionBar } from "./chrome.js";
import { memoByDocs } from "./engine-support.js";
import type { CanvasDocs } from "./route-edit.js";
import { copiesOn, copyShownBy } from "./shared-copies.js";
import { composePage, isSharedRegion } from "./shared-layout.js";
import { startTextEditing } from "./text-editing.js";
import { findNode } from "./tree.js";

const usePuck = createUsePuck();

/** The Appearance group's id (3.12), which every look field is in. */
const APPEARANCE_GROUP_ID = APPEARANCE_FIELDS.lookShadow.optionGroup.id;

/** What the selected element's bar needs from the engine. */
export type ActionBarOptions = {
  /** What the canvas shows now. */
  readonly docs: () => CanvasDocs;
  readonly library: () => ComponentLibrary | null;
  /** The canvas's document: the iframe's, or the editor's without one. */
  readonly document: () => Document | undefined;
  /** Asks the app to pick an image or to hide or show an element. */
  readonly request: (request: ElementRequest) => void;
  /** Whether several elements are selected, and when that changes (1.31). */
  readonly several: {
    readonly get: () => boolean;
    readonly subscribe: (cb: () => void) => Unsubscribe;
  };
};

/**
 * The selected element's quick actions (1.12, F-ED-25), for the page as it is now: locked on the
 * shared Header and Footer themselves (F-ED-7) and while several elements are selected, with *Edit*
 * and *Hide* asked for the page as the bar was drawn (R2).
 */
export function createActionBar(options: ActionBarOptions) {
  const fieldsOf = (type: string) =>
    Object.values(options.library()?.components[type]?.fields ?? {});
  /** What the bars ask while drawing, made once per change of the page: a new page gives them new functions, so they ask again (R2). */
  const barProps = memoByDocs((shown: CanvasDocs) => {
    const elementActions: ElementActions = {
      canEdit: (type) =>
        fieldsOf(type).some(
          (field) =>
            field.kind === "media" ||
            ((field.kind === "text" || field.kind === "richtext") && field.inline === true),
        ),
      edit: (id, type) => {
        const doc = options.document();
        if (doc !== undefined && startTextEditing(doc, id, false)) return;
        if (fieldsOf(type).some((field) => field.kind === "media")) {
          options.request({ kind: "pickImage", nodeId: id });
        }
      },
      canHide: (id) => {
        if (findNode(shown.page, id) !== undefined) return true;
        // A linked copy is one of the page's own, shown by its section's id.
        const node = findNode(composePage(shown.page, shown.layout, shown.shared), id);
        return (
          node !== undefined &&
          copyShownBy(node, copiesOn(shown.page.content), shown.shared) !== undefined
        );
      },
      toggleHidden: (id) => options.request({ kind: "toggleHidden", nodeId: id }),
      // Its Appearance fields, which *Style this ‹kind›…* shows (3.13a).
      canStyle: (type) =>
        fieldsOf(type).some((field) => field.optionGroup?.id === APPEARANCE_GROUP_ID),
      style: (id) => options.request({ kind: "style", nodeId: id }),
    };
    return { isLocked: (id: string) => isSharedRegion(shown.layout, id), elementActions };
  });

  return function SharedAwareActionBar(props: ComponentProps<typeof QuickActionBar>) {
    // Through Puck's store, which changes with every page Puck shows: never a value kept from an
    // earlier drawing.
    const { isLocked, elementActions } = usePuck(() => barProps(options.docs()));
    // While several elements are selected, the bar names the one shown: what it would do to one,
    // the Edit menu does to all (1.31).
    const several = useSyncExternalStore(options.several.subscribe, options.several.get);
    return (
      <QuickActionBar
        {...props}
        isLocked={(id) => several || isLocked(id)}
        elementActions={elementActions}
      />
    );
  };
}
