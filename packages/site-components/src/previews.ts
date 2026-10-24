/**
 * What the canvas can preview that a site never shows by itself (UX-26, F-ED-25): the Header's
 * small-screen menu open, for one. The canvas sets them in its render context; the export renders
 * without them (`renderNodesToHtml`), so none ever reaches a site.
 */
export type EditPreviews = {
  /** The Header's small-screen menu, shown open (*Show mobile menu*, in the Mobile view). */
  readonly mobileMenu?: boolean;
};

/**
 * Marks markup a component draws only for an edit-only preview, with the preview's name as its
 * value (`data-webforge-preview="mobile-menu"`): the canvas's CSS and tests find it by this, and a
 * test checks the export never has it.
 */
export const PREVIEW_ATTRIBUTE = "data-webforge-preview";
