import type { CanvasEngine } from "@webforge/engine";
import type { Area, EditorContext } from "../editor/areas.js";
import { removeSharedSection, sharedSection } from "../shared-sections/index.js";
import { followLayoutLock } from "../shell/preferences-store.js";
import { type AddPanelRegistration, registerAddPanel } from "./register-add-panel.js";

/**
 * The Add panel (1.13), hidden in Content mode (M3), and the palette's Add commands with it
 * (2.20, B1). Registered again with each canvas engine, whose drags its items start; the floating
 * + opens its Sections, ready to add one at its place (UI1).
 */
export const addPanelArea: Area<EditorContext> = {
  id: "addPanel",
  register: ({
    session,
    panels,
    commands,
    preferences,
    engine,
    siteWide,
    sectionPreviews,
    dialogs,
  }) => {
    let locked = true;
    let registration: AddPanelRegistration | null = null;
    /** The engine the registration's items drag onto: null for none, undefined when not shown. */
    let shownWith: CanvasEngine | null | undefined;
    const update = () => {
      const canvas = locked ? undefined : (engine.current()?.engine ?? null);
      if (canvas === shownWith) return;
      registration?.remove();
      registration = null;
      shownWith = canvas;
      if (canvas === undefined) return;
      registration = registerAddPanel(panels, session, {
        flush: engine.flush,
        dragSource:
          canvas === null ? undefined : (element, type) => canvas.addDragSource(element, type),
        // Rename and Delete for shared sections, those on no page included (1.29).
        sharedActions: {
          rename: (id) => {
            const shared = sharedSection(session.history.document.getState(), id);
            if (shared !== undefined) {
              dialogs.nameSharedSection({ kind: "rename", id, suggested: shared.name });
            }
          },
          remove: (id) => removeSharedSection(session, id, siteWide),
        },
        // Its favourites and recents (1.34), which it follows without being registered again (its
        // tab and + place stay).
        preferences,
        commands,
        preview: sectionPreviews,
      });
    };
    const stopLock = followLayoutLock(preferences, (next) => {
      locked = next;
      update();
    });
    const stopEngine = engine.whileMounted(({ engine: canvas }) => {
      update();
      const stopAdd = canvas.onAddRequest((at) => registration?.openAt(at));
      return () => {
        stopAdd();
        // Removed with its engine, not registered again without one: the next engine, or the
        // next switch of mode, registers it again.
        registration?.remove();
        registration = null;
        shownWith = undefined;
      };
    });
    return () => {
      stopEngine();
      stopLock();
      registration?.remove();
      registration = null;
    };
  },
};
