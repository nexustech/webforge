import type { RenderContext, SiteBindings } from "@webforge/site-components";

/** Where a part of the canvas's render context comes from. */
type Source = "editor" | "setNavigation" | "setImages" | "setPreviews" | "setSettings";

/**
 * Which `CanvasEngine` method gives each part of the canvas's render context (#367): the editor's
 * own canvas defaults, or the method that sets it. A part added to `RenderContext` fails to compile
 * until it's listed here, so the engine says where it comes from. Site Settings' bindings, and only
 * they, come from `setSettings`, which replaces all of them at once (a binding left out goes) and
 * nothing else.
 */
export const RENDER_CONTEXT_SOURCES = {
  navigation: "setNavigation",
  link: "editor",
  href: "editor",
  image: "setImages",
  emptyImage: "setImages",
  previews: "setPreviews",
  setting: "setSettings",
  emptySetting: "setSettings",
  openingHours: "setSettings",
  socialProfiles: "setSettings",
  socialHint: "setSettings",
  language: "setSettings",
  formService: "setSettings",
  formHint: "setSettings",
} as const satisfies Record<keyof SiteBindings, "setSettings"> &
  Record<Exclude<keyof RenderContext, keyof SiteBindings>, Exclude<Source, "setSettings">>;
