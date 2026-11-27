import { createUsePuck, registerOverlayPortal, useGetPuck } from "@puckeditor/core";
import { t } from "@webforge/i18n";
import { EyeOffIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { TIP_ATTRIBUTE } from "./frame-tooltips.js";

const usePuck = createUsePuck();

/** The class of an element's *Not published* badge on the canvas (#1512). */
export const UNPUBLISHED_BADGE_CLASS = "wf-unpublished";

/** What an unpublished element's badge can do (#1512). */
export type UnpublishedActions = {
  /**
   * Whether element `id` can be shown again from this page: one of the page's own, or a linked
   * copy's, as the element bar's *Show* (not one of the shared Header's or Footer's).
   */
  readonly canShow: (id: string) => boolean;
  /** Shows element `id` again, as one undo step ("Showed …"), as Layers' *Show* does. */
  readonly show: (id: string) => void;
};

/** A badge that only says so: for a canvas that can't show an element again. */
export const NO_UNPUBLISHED_ACTIONS: UnpublishedActions = {
  canShow: () => false,
  show: () => undefined,
};

/**
 * The *Not published* badge of element `id`, set to *Don't Publish* (#1512): in the corner of
 * Puck's wrapper around it, over the page, so nothing on the page moves. It is always there, beside
 * the element's dimming, so the element doesn't read as on the website. A click selects the
 * element, and while it's selected the badge offers *Show*, where the layout may change (not in
 * Content mode, M3). Only the outermost unpublished element has one: the canvas's CSS hides a badge
 * inside another unpublished element (`chrome.tsx`).
 *
 * Canvas chrome only: Preview, the export, the pictures saved from Preview and the Recent list's
 * picture are drawn from the static page, which leaves the element out.
 */
export function UnpublishedBadge({
  id,
  actions,
}: {
  readonly id: string;
  readonly actions: UnpublishedActions;
}) {
  const getPuck = useGetPuck();
  const selected = usePuck((state) => state.selectedItem?.props.id === id);
  const layoutOpen = usePuck((state) => state.getPermissions().insert === true);
  const showable = selected && layoutOpen && actions.canShow(id);
  const badge = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = badge.current;
    if (element === null) return undefined;
    // One of Puck's own controls inside an element: it takes the pointer, which Puck gives an
    // element's content none of, and starts no drag of the element.
    const unregister = registerOverlayPortal(element, { disableDrag: true });
    // Its clicks are its own, here, before they reach Puck's wrappers: the wrapper of each element
    // around it would select that one in turn, the outermost last. So the badge selects its own
    // element as Puck does (the app hears of it as of a click), or shows it again.
    const onClick = (event: MouseEvent) => {
      event.stopPropagation();
      const target = event.target as Partial<Element> | null;
      if (target?.closest?.(`.${UNPUBLISHED_BADGE_CLASS}__show`) != null) {
        actions.show(id);
        return;
      }
      const puck = getPuck();
      const itemSelector = puck.getSelectorForId(id);
      if (itemSelector !== undefined) puck.dispatch({ type: "setUi", ui: { itemSelector } });
    };
    element.addEventListener("click", onClick);
    return () => {
      element.removeEventListener("click", onClick);
      unregister?.();
    };
  }, [id, actions, getPuck]);
  return (
    <span ref={badge} className={UNPUBLISHED_BADGE_CLASS} data-wf-unpublished-badge="">
      <button
        type="button"
        className={`${UNPUBLISHED_BADGE_CLASS}__label`}
        aria-label={t("canvas.notPublished.label")}
        // The canvas's own tooltip (#1011), not the browser's `title`.
        {...{ [TIP_ATTRIBUTE]: t("canvas.notPublished.label") }}
      >
        <EyeOffIcon aria-hidden size={12} />
        {t("canvas.notPublished")}
      </button>
      {showable ? (
        <button type="button" className={`${UNPUBLISHED_BADGE_CLASS}__show`}>
          {t("canvas.show")}
        </button>
      ) : null}
    </span>
  );
}
