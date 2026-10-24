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
  language: "setSettings",
  formService: "setSettings",
  formHint: "setSettings",
} as const satisfies Record<keyof SiteBindings, "setSettings"> &
  Record<Exclude<keyof RenderContext, keyof SiteBindings>, Exclude<Source, "setSettings">>;

/** A render context's parts that don't come from Site Settings. */
export type CanvasParts = Omit<RenderContext, keyof SiteBindings>;

/**
 * `context` split by {@link RENDER_CONTEXT_SOURCES}: Site Settings' bindings, and every other part
 * as it is. A default added to the editor's render context lands on its side of the split without
 * the engine naming it.
 */
export function splitRenderContext(context: RenderContext): {
  readonly parts: CanvasParts;
  readonly bindings: SiteBindings;
} {
  const parts: Record<string, unknown> = {};
  const bindings: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    const source: string | undefined = (RENDER_CONTEXT_SOURCES as Record<string, string>)[key];
    (source === "setSettings" ? bindings : parts)[key] = value;
  }
  // Each key went where its type says: the map is checked against both types above.
  return { parts: parts as CanvasParts, bindings: bindings as SiteBindings };
}
