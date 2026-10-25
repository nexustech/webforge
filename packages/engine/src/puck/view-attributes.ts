import type { ViewOptions } from "../canvas-engine.js";

/**
 * The attribute on the canvas document's root for each View option that is on (UX-7): the view
 * options' styles key on them, and the canvas chrome reads them (SP-2's size on the name chip).
 */
export const OPTION_ATTRIBUTES: Readonly<Record<keyof ViewOptions, string>> = {
  outlines: "data-wf-view-outlines",
  spacingOnHover: "data-wf-view-spacing",
  elementNames: "data-wf-view-names",
  extraBottomSpace: "data-wf-view-extra-space",
};
