import type { NodeDoc } from "@webforge/model";
import { siteLibrary } from "../catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import type { RenderContext, ResolvedImage } from "../schema.js";

/**
 * A picture for stories: 640 × 427 of a warm plain colour, inline, as stories make no network
 * requests (C8). Real size, so the image lays out as a photo does.
 */
const PICTURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAoAAAAGrCAIAAADfLLEcAAAFVklEQVR42u3VMQ0AAAgEsfdvBClowA0uWGhSBbdcpgsAOBYJAMCAAcCAAQADBgADBgAMGAAMGAAwYAAwYADAgAHAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAwIABwIABwIABAAMGAAMGAAwYAAwYADBgADBgAMCAAcCAAcCAAQADBgADBgAMGAAMGAAwYAAwYADAgAHAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAwIABwIABwIABAAMGAAMGAAwYAAwYADBgADBgAMCAAcCAAcCAAQADBgADBgAMGAAMGAAwYAAwYADAgAHAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAwIABwIABwIABAAMGAAMGAAwYAAwYADBgADBgAMCAAcCAAcCAVQAAAwYAAwYADBgADBgAMGAAMGAAwIABwIABAAMGAAMGAAMGAAwYAAwYADBgADBgAMCAAcCAAQADBgADBgADBgAMGAAMGAAwYAAwYADAgAHAgAEAAwYAAwYAAwYADBgADBgAMGAAMGAAwIABwIABAAMGAAMGAAMGAAwYAAwYADBgADBgAMCAAcCAAQADBgADBgADBgAMGAAMGAAwYAAwYADAgAHAgAEAAwYAAwYAAwYADBgADBgAMGAAMGAAwIABwIABAAMGAAMGAAMGAAwYAAwYADBgADBgAMCAAcCAAQADBgADBgADBgAMGAAMGAAwYAAwYADAgAHAgAEAAwYAAwYAA1YBAAwYAAwYADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAMGAAwYAAwYADAgAHAgAEAAwYAAwYADBgADBgADBgAMGAAMGAAwIABwIABAAMGAAMGAAwYAAwYAAwYADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAMGAAwYAAwYADAgAHAgAEAAwYAAwYADBgADBgADBgAMGAAMGAAwIABwIABAAMGAAMGAAwYAAwYAAwYADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAMGAAwYAAwYADAgAHAgAEAAwYAAwYADBgADBgADBgAMGAAMGAAwIABwIABAAMGAAMGAAwYAAwYAAwYADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAMWAIAMGAAMGAAwIABwIABAAMGAAMGAAwYAAwYADBgADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAwYAAwYAAwYADAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAMGAAwIABwIABAAMGAAMGAAwYAAwYADBgADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAwYAAwYAAwYADAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAMGAAwIABwIABAAMGAAMGAAwYAAwYADBgADBgADBgAMCAAcCAAQADBgADBgAMGAAMGAAwYAAwYAAwYADAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAMGAVAMCAAcCAAQADBgADBgAMGAAMGAAwYAAwYADAgAHAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAwIABwIABwIABAAMGAAMGAAwYAAwYADBgADBgAMCAAcCAAcCAAQADBgADBgAMGAAMGAAwYAAwYADAgAHAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAwIABwIABwIABAAMGAAMGAAwYAAwYADBgADBgAMCAAcCAAcCAAQADBgADBgAMGAAMGAAwYAAwYADAgAHAgAHAgAEAAwYAAwYADBgADBgAMGAAMGAAwIABwIABwIABAAMGAAMGAAwYAAwYADBgADBgAMCAAcCAAcCAVQAAAwaABxZW7J7yvSSywgAAAABJRU5ErkJggg==";

/** The image every story's `photo` resolves to. */
const photo: ResolvedImage = {
  sources: [],
  src: PICTURE,
  // A width, as the export's srcsets give: the image is laid out at the size `sizes` asks for, not
  // at the few pixels the placeholder really has.
  fallback: { type: "image/png", srcset: `${PICTURE} 640w` },
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
