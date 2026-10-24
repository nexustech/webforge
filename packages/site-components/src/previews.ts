/**
 * What the canvas can preview that a site never shows by itself (UX-26, F-ED-25): the Header's
 * small-screen menu open, for one. The canvas sets them in its render context; the export renders
 * without them (`renderNodesToHtml`), so none ever reaches a site.
 */
export type EditPreviews = {
  /** The Header's small-screen menu, shown open (*Show mobile menu*, in the Mobile view). */
  readonly mobileMenu?: boolean;
  /** Each Column's edges outlined, to see where columns go (*Show column outlines*, 2.17). */
  readonly columnOutlines?: boolean;
};

/** Whether each preview is on in a set of previews: a new preview fails to compile until it's here. */
const IS_ON: { readonly [name in keyof EditPreviews]-?: (previews: EditPreviews) => boolean } = {
  mobileMenu: (previews) => previews.mobileMenu === true,
  columnOutlines: (previews) => previews.columnOutlines === true,
};

/** Whether `a` and `b` show the same previews (one left out is off). */
export function samePreviews(a: EditPreviews, b: EditPreviews): boolean {
  return Object.values(IS_ON).every((isOn) => isOn(a) === isOn(b));
}

/**
 * Marks markup a component draws only for an edit-only preview, with the preview's name as its
 * value (`data-webforge-preview="mobile-menu"`): the canvas's CSS and tests find it by this, and a
 * test checks the export never has it.
 */
export const PREVIEW_ATTRIBUTE = "data-webforge-preview";
