import { basic } from "./basic.js";
import { carousel } from "./carousel.js";
import { contactDetails } from "./contactDetails.js";
import { elements } from "./elements.js";
import { embeds } from "./embeds.js";
import { gallery } from "./gallery.js";
import { layout } from "./layout.js";
import { sections } from "./sections.js";
import { shared } from "./shared.js";

/**
 * Each family's strings, in a file of its own beside its catalogue module (2.19): a new family
 * adds a file and a line here, so streams adding components don't edit the same file. A test
 * checks no key is in two of them.
 */
export const componentFamilies = {
  shared,
  basic,
  elements,
  layout,
  sections,
  carousel,
  embeds,
  contactDetails,
  gallery,
} as const;

/** Site components: element names, their fields, exported-site text and the starter page. */
export const components = {
  ...shared,
  ...basic,
  ...elements,
  ...layout,
  ...sections,
  ...carousel,
  ...embeds,
  ...contactDetails,
  ...gallery,
} as const;
