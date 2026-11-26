import {
  type BindableSetting,
  mediaIdSchema,
  type NodeDoc,
  type SiteCollection,
} from "@webforge/model";
import { siteLibrary } from "../catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml, renderPage } from "../render-static.js";
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

/**
 * Pictures of either shape for the Image's shapes (3.19), `landscape` and `portrait`, and a
 * business's `logo` for the Header's (HF-1), with its light version for dark backgrounds
 * (`logoLight`, HH-2).
 */
const DRAWINGS: Readonly<Record<string, ResolvedImage>> = {
  // A loaf in a circle beside a wordmark's bars: wider than tall, as most logos are.
  logo: drawing(
    240,
    80,
    "50% 50%",
    '<circle cx="40" cy="40" r="34" fill="#b5542c"/><ellipse cx="40" cy="44" rx="20" ry="12" fill="#f4e6d0"/><rect x="88" y="22" width="136" height="16" rx="4" fill="#3b2a1e"/><rect x="88" y="46" width="96" height="10" rx="3" fill="#b5542c"/>',
    "Rosa's Bakery",
  ),
  // The same logo in light colours, for dark backgrounds (HH-2).
  logoLight: drawing(
    240,
    80,
    "50% 50%",
    '<circle cx="40" cy="40" r="34" fill="#f4e6d0"/><ellipse cx="40" cy="44" rx="20" ry="12" fill="#b5542c"/><rect x="88" y="22" width="136" height="16" rx="4" fill="#ffffff"/><rect x="88" y="46" width="96" height="10" rx="3" fill="#f4e6d0"/>',
    "Rosa's Bakery",
  ),
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

/** A bakery's Blog (6.10b): posts newest first, with pictures, summaries and tags. */
const STORY_POSTS: SiteCollection = {
  id: "blog",
  name: "Blog",
  folder: "blog",
  items: [
    ["Our new ovens", "2026-11-10", "Bread out of the oven an hour earlier, every day."],
    ["Spring opening times", "2026-03-01", "Open from eight, Tuesday to Sunday."],
    ["A cake for every wedding", "2026-02-14", "Tastings on Saturday mornings."],
    ["Sourdough classes", "2026-01-20", "Learn to bake your own, in two hours."],
    ["Winter soups", "2025-12-05", "Three soups a day, with bread."],
  ].map(([title, date, summary], n) => ({
    pageId: `post-${n}`,
    path: `blog/post-${n}`,
    values: {
      title: { kind: "text", text: title ?? "" },
      date: { kind: "date", date: date ?? "" },
      summary: { kind: "text", text: summary ?? "" },
      picture: { kind: "image", mediaId: mediaIdSchema.parse("photo") },
      tags: { kind: "tags", tags: [{ name: "News", path: "blog/tag/news" }] },
    },
  })),
};

/** What stories render with: the export's context, with a navigation, a photo and settings. */
const storyContext: RenderContext = {
  posts: () => STORY_POSTS,
  ...EDITOR_RENDER_CONTEXT,
  navigation: [
    { id: "home", pageId: "home", label: "Home", href: "#", current: true },
    { id: "about", pageId: "about", label: "About us", href: "#", current: false },
    { id: "book", pageId: "book", label: "Book a table", href: "#", current: false, button: true },
  ],
  // Every page, those the menu leaves out too, for a Footer's Menu links to add (HF-8).
  pageLinks: [
    { id: "home", pageId: "home", label: "Home", href: "#", current: true },
    { id: "about", pageId: "about", label: "About us", href: "#", current: false },
    { id: "book", pageId: "book", label: "Book a table", href: "#", current: false },
    { id: "privacy", pageId: "privacy", label: "Privacy", href: "#", current: false },
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
 * A page as the export draws it (ADR 0005): its `header` over its `content`, through `renderPage`,
 * in the exported page's column. So a Header joined to the page's first section (HH-1) is drawn on
 * it, and the section makes room for it, as on a site.
 */
export function SitePage({
  header,
  content,
  context,
}: {
  readonly header: readonly NodeDoc[];
  readonly content: readonly NodeDoc[];
  /** Beside the stories' own: the logos and the theme's dark colours, for the Header's (HH-2). */
  readonly context?: Partial<RenderContext>;
}) {
  const page = renderPage({ header, content, footer: [] }, siteLibrary, {
    ...storyContext,
    ...context,
  });
  return (
    <div
      className="flex flex-col bg-base-100 text-base-content"
      dangerouslySetInnerHTML={{ __html: `${page.header}<main id="main">${page.main}</main>` }}
    />
  );
}

/**
 * `nodes` as an exported page shows them (ADR 0005): rendered by the export's own renderer, so a
 * story is what a site shows, without the editor around it.
 */
export function SiteNodes({
  nodes,
  context,
}: {
  readonly nodes: readonly NodeDoc[];
  /** Beside the stories' own: a post's fields, for a Blog's design (6.10b). */
  readonly context?: Partial<RenderContext>;
}) {
  const html = renderNodesToHtml(nodes, siteLibrary, { ...storyContext, ...context });
  return (
    <div
      className="bg-base-100 text-base-content"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the export's own sanitised HTML.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
