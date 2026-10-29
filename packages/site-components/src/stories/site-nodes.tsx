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

/**
 * A drawn picture for stories, `width` × `height`, inline (C8), with its subject off centre, so a
 * story shows where a crop cuts it and that the focal point stays in view.
 */
function drawing(
  width: number,
  height: number,
  objectPosition: string,
  shapes: string,
  alt: string,
): ResolvedImage {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${shapes}</svg>`;
  const src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  return {
    sources: [],
    src,
    fallback: { type: "image/png", srcset: `${src} ${width}w` },
    width,
    height,
    alt,
    objectPosition,
  };
}

/** Pictures of either shape for the Image's shapes (3.19): `landscape` and `portrait`. */
const DRAWINGS: Readonly<Record<string, ResolvedImage>> = {
  // A sun a quarter of the way across, over hills.
  landscape: drawing(
    640,
    427,
    "25% 35%",
    '<rect width="640" height="427" fill="#bfe3f2"/><circle cx="160" cy="150" r="60" fill="#f2b632"/><path d="M0 330 Q160 250 320 320 T640 300 V427 H0Z" fill="#5c9e5a"/><path d="M0 380 Q200 330 400 380 T640 370 V427 H0Z" fill="#3f7a40"/>',
    "A sun over green hills",
  ),
  // A tree on the right, near the top.
  portrait: drawing(
    400,
    600,
    "70% 30%",
    '<rect width="400" height="600" fill="#f4e6d0"/><rect x="270" y="200" width="20" height="300" fill="#7a5230"/><circle cx="280" cy="180" r="80" fill="#4f8f4c"/><rect y="500" width="400" height="100" fill="#c9b18a"/>',
    "A tree on a sandy hill",
  ),
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
  image: (id) => (id === "photo" ? photo : (DRAWINGS[id] ?? null)),
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
