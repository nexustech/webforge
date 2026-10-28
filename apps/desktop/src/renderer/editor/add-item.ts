import type { SharedSectionId } from "@webforge/model";

/** A component the Add panel offers. */
export type AddItem = {
  /** Its component type ("Hero"); for a shared section, its id. */
  readonly type: string;
  /** Its display name ("Hero"). */
  readonly label: string;
  /** Its group in the panel ("Heroes"); empty when it has none. */
  readonly category: string;
  /**
   * Words a search finds it by besides its name and group: a section's category ("Heroes"), which
   * the Sections tab no longer shows as a group (#523).
   */
  readonly keywords?: string;
  /** Set for a shared section, which a click places as a linked copy; it can't be dragged. */
  readonly sharedSectionId?: SharedSectionId;
  /** Set for an item listed again, among the favourites or recently used. */
  readonly repeat?: true;
  /**
   * Set for an item under Suggested (SP-12): a List's item, a Columns' column, offered only there,
   * so it can't be a favourite.
   */
  readonly suggested?: true;
  /** Set for a component offered in Advanced mode only (Custom Code, F-ED-11). */
  readonly advancedOnly?: true;
  /**
   * Set for a component's preset (the Booking button, a Button, 2.11), whose `type` is
   * {@link presetKey}'s. A click places it; it can't be dragged, as the canvas drags in components.
   */
  readonly preset?: true;
};
