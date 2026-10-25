import type { BindableSetting, NodeDoc } from "@webforge/model";
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

/** The Site Settings values stories show (1.17). */
const STORY_SETTINGS: Partial<Record<BindableSetting, string>> = {
  "general.name": "Rosa's Bakery",
  "contact.address": "1 High Street\nHightown\nHT1 2AB",
  "contact.phone": "+44 1234 567890",
  "contact.email": "hello@rosas-bakery.example",
  "contact.openingHoursNote": "Closed on bank holidays.",
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
  setting: (key) => STORY_SETTINGS[key],
  language: "en-GB",
  formService: { kind: "formspree", formId: "xyzAbc12" },
  openingHours: [
    { days: ["tue", "wed", "thu", "fri"], opens: "07:00", closes: "15:00" },
    { days: ["sat", "sun"], opens: "08:00", closes: "13:00" },
  ],
  socialProfiles: [
    { network: "facebook", url: "https://www.facebook.com/rosasbakery" },
    { network: "instagram", url: "https://www.instagram.com/rosasbakery" },
    { network: "x", url: "https://x.com/rosasbakery" },
    { network: "youtube", url: "https://www.youtube.com/@rosasbakery" },
    { network: "tiktok", url: "https://www.tiktok.com/@rosasbakery" },
    { network: "github", url: "https://github.com/rosasbakery" },
    { network: "linkedin", url: "https://www.linkedin.com/company/rosasbakery" },
    { network: "custom", url: "https://mastodon.social/@rosasbakery" },
  ],
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
