import type { NodeDoc } from "@webforge/model";
import { siteLibrary } from "../catalogue/index.js";
import { EDITOR_RENDER_CONTEXT, type RenderContext, type ResolvedImage } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";

/** A picture for stories, a warm plain colour inline: stories make no network requests (C8). */
const PICTURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAEUlEQVR4nGO4eXw5HDHg5AAAF4MbVQU8vGoAAAAASUVORK5CYII=";

/** The image every story's `photo` resolves to. */
const photo: ResolvedImage = {
  sources: [],
  src: PICTURE,
  fallback: { type: "image/png", srcset: PICTURE },
  width: 640,
  height: 427,
  alt: "Green hills under a morning sun",
};

/** What stories render with: the export's context, with a navigation, a photo and settings. */
const storyContext: RenderContext = {
  ...EDITOR_RENDER_CONTEXT,
  navigation: [
    { id: "home", label: "Home", href: "#", current: true },
    { id: "about", label: "About us", href: "#", current: false },
    { id: "book", label: "Book a table", href: "#", current: false, button: true },
  ],
  link: () => "#",
  image: (id) => (id === "photo" ? photo : null),
  setting: (key) => (key === "general.name" ? "Rosa's Bakery" : undefined),
};

/**
 * `nodes` as an exported page shows them (ADR 0005): rendered by the export's own renderer, so a
 * story is what a site shows, without the editor around it.
 */
export function SiteNodes({ nodes }: { readonly nodes: readonly NodeDoc[] }) {
  return (
    <div
      className="bg-base-100 text-base-content"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the export's own sanitised HTML.
      dangerouslySetInnerHTML={{ __html: renderNodesToHtml(nodes, siteLibrary, storyContext) }}
    />
  );
}
