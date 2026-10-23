import type { CanvasEngine, FieldDrag, Unsubscribe } from "@webforge/engine";
import { boxValueSchema } from "@webforge/model";
import type { FieldDef } from "@webforge/site-components";
import type { EditorSession, Gesture } from "./editor-session.js";
import { fieldTarget } from "./field-target.js";
import { breakpointOf, withValueAt } from "./responsive-value.js";

/** Whether a drag may set `field` to `value`. */
function accepts(field: FieldDef, value: unknown): boolean {
  return field.kind === "box" ? boxValueSchema.safeParse(value).success : value !== undefined;
}

/**
 * Records drags of field values on the canvas (1.32), such as the spacing handles, in the history.
 * Each drag is one step, shown live as it goes, written where the Edit panel writes the same change
 * (the page, the shared Header or Footer, a linked copy's shared section) and labelled as the Edit
 * panel labels it: "Changed Hero padding", "Changed Heading margin on Mobile". A cancelled drag
 * (Esc) leaves no step. `flush` ends a canvas text session first.
 */
export function connectFieldDrags(
  engine: CanvasEngine,
  session: EditorSession,
  flush: () => void,
): Unsubscribe {
  let open: {
    readonly drag: FieldDrag;
    readonly gesture: Gesture;
    readonly set: (value: unknown) => void;
    readonly commit: () => void;
  } | null = null;

  const start = (drag: FieldDrag) => {
    // A drag that never ended (its grips went) is dropped, not kept half made.
    if (open?.gesture.active === true) open.gesture.cancel();
    open = null;
    const { pageId, viewport } = session.ui.getState();
    const target = fieldTarget(
      session.history.document.getState(),
      session.library,
      pageId,
      drag.nodeId,
    );
    const field = target?.component.fields[drag.field];
    if (target === undefined || field === undefined) {
      return;
    }
    flush();
    const breakpoint = breakpointOf(viewport);
    const gesture = session.begin("props", target.labelOf(drag.field, field, breakpoint));
    open = {
      drag,
      gesture,
      set: (value) => {
        if (!accepts(field, value)) return;
        gesture.update(
          target.recipe(drag.field, (stored) =>
            field.responsive === true ? withValueAt(stored, breakpoint, value) : value,
          ),
        );
      },
      commit: () => gesture.commit({ selectionAfter: { pageId, viewport, nodeId: drag.nodeId } }),
    };
  };

  return engine.onFieldDrag((drag) => {
    if (drag.phase === "start") {
      start(drag);
      return;
    }
    const run = open;
    if (
      run === null ||
      run.drag.nodeId !== drag.nodeId ||
      run.drag.field !== drag.field ||
      !run.gesture.active
    ) {
      return;
    }
    if (drag.phase === "cancel") {
      open = null;
      run.gesture.cancel();
      return;
    }
    run.set(drag.value);
    if (drag.phase === "commit") {
      open = null;
      run.commit();
    }
  });
}
