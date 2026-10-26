import stylesheets from "virtual:webforge-theme-css";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { type NodeDoc, pastedCopies, type ThemeTokens } from "@webforge/model";
import { CURATED_THEMES_A, CURATED_THEMES_B, CURATED_THEMES_C } from "@webforge/themes";
import { siteLibrary, starterLayout } from "./catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "./library.js";
import { renderNodesToHtml } from "./render-static.js";
import type { RenderContext } from "./schema.js";

/** The classes the export gives a page's `<body>` (`BODY_CLASS` in the pipeline). */
const BODY_CLASS = "flex min-h-screen flex-col bg-base-100 font-sans text-base-content";

/**
 * A page with every section the Add panel offers, each as it's added, between the starter Header
 * and Footer: the last section on the theme's inverse colours (2.4), as a dark band.
 */
function samplePage(): string {
  const { header, footer } = starterLayout("Rosa's Bakery");
  const types = Object.entries(siteLibrary.components)
    .filter(([, def]) => def.place === "section")
    .map(([type]) => type);
  const sections = types.map((type, at): NodeDoc => {
    const defaults = siteLibrary.components[type]?.defaults ?? {};
    const inverse = at === types.length - 1 ? { colors: "inverse" } : {};
    return { type, props: { ...structuredClone(defaults), ...inverse, id: `section-${at}` } };
  });
  return laidOut(header, sections, footer);
}

/**
 * `sections` between `header` and `footer`, laid out as the export lays out a page: the sections
 * in `<main id="main">`, which the theme's alternating sections count (2.13d).
 */
function laidOut(header: NodeDoc[], sections: NodeDoc[], footer: NodeDoc[]): string {
  const ids = new Set<string>();
  const html = (nodes: NodeDoc[]) =>
    renderNodesToHtml(pastedCopies(nodes, ids), siteLibrary, SAMPLE_CONTEXT);
  return `${html(header)}<main id="main" class="flex-1">${html(sections)}</main>${html(footer)}`;
}

/**
 * A short page for comparing themes side by side (2.13d): a Hero, Features and Stats as cards,
 * Testimonials on the theme's reversed colours and a Call to action, between the Header and
 * Footer. It shows each theme's cards, headings, corners and photos, its sections' rhythm, and
 * a reversed band: light under a dark-first theme, dark under a light one.
 */
function comparisonPage(): string {
  const { header, footer } = starterLayout("Rosa's Bakery");
  const section = (type: string, props: Record<string, unknown> = {}): NodeDoc => ({
    type,
    props: {
      ...structuredClone(siteLibrary.components[type]?.defaults ?? {}),
      ...props,
      id: type.toLowerCase(),
    },
  });
  return laidOut(
    header,
    [
      section("Hero"),
      section("Features", { variant: "cards" }),
      section("Testimonials", { variant: "cards", colors: "inverse" }),
      section("Stats", { variant: "cards" }),
      section("CallToAction"),
    ],
    footer,
  );
}

/** A small site for the page to be part of: its name in Site Settings, and a menu. */
const SAMPLE_CONTEXT: RenderContext = {
  ...EDITOR_RENDER_CONTEXT,
  setting: (key) => (key === "general.name" ? "Rosa's Bakery" : undefined),
  navigation: [
    { label: "Home", href: "#", current: true },
    { label: "Our story", href: "#", current: false },
    { label: "Menu", href: "#", current: false },
    { label: "Book a table", href: "#", current: false, button: true },
  ],
};

/** The page in `preset`'s theme, as a document of its own: its stylesheet and the page. */
function themedDocument(preset: string, page: string): string {
  return `<!doctype html>
<html lang="en" data-theme="${preset}">
<head><meta charset="utf-8"><style>${stylesheets[preset] ?? ""}</style></head>
<body class="${BODY_CLASS}">${page}</body>
</html>`;
}

/** What the story reads of its iframe: its document's height and fonts, and its own height. */
type FramedPage = {
  readonly style: { height: string };
  readonly contentDocument: {
    readonly documentElement: { readonly scrollHeight: number };
    readonly fonts: { readonly ready: Promise<unknown> };
  } | null;
};

/** The sample page in `preset`'s theme, in an iframe as tall as the page. */
function ThemedPage({ preset, page }: { readonly preset: string; readonly page: string }) {
  return (
    <iframe
      title={`The ${preset} theme`}
      srcDoc={themedDocument(preset, page)}
      style={{ display: "block", width: "100%", border: 0 }}
      onLoad={(event) => {
        // The package has no DOM types (it renders in Node): the parts of the frame used here.
        const frame = event.currentTarget as unknown as FramedPage;
        const fit = () => {
          const height = frame.contentDocument?.documentElement.scrollHeight ?? 0;
          frame.style.height = `${height}px`;
        };
        fit();
        // Again once its fonts are in, which change the page's height.
        void frame.contentDocument?.fonts.ready.then(fit);
      }}
    />
  );
}

/**
 * The themes (2.13, S3): every section in each preset, as the export styles it, for the product
 * owner's review that they look distinct. Each theme is a page of its own (`own-theme`): the
 * toolbar's theme doesn't apply, so the visual tests show each once.
 */
const meta = {
  title: "Themes",
  tags: ["own-theme"],
  parameters: { a11y: { context: "iframe" } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** One story per preset: the whole sample page. */
const pageOf = (preset: string): Story => ({
  name: preset,
  render: () => <ThemedPage preset={preset} page={samplePage()} />,
});

export const Bistro: Story = pageOf("bistro");
export const Atelier: Story = pageOf("atelier");
export const Workshop: Story = pageOf("workshop");
export const Clarity: Story = pageOf("clarity");
export const Meridian: Story = pageOf("meridian");
export const Darkroom: Story = pageOf("darkroom");
export const Market: Story = pageOf("market");
export const Gazette: Story = pageOf("gazette");
export const Harbour: Story = pageOf("harbour");
export const Linen: Story = pageOf("linen");
export const Studio: Story = pageOf("studio");
export const Playground: Story = pageOf("playground");

/**
 * A batch of curated themes side by side on the comparison page, each as narrow as a phone, for
 * comparing at a glance. A batch at a time (four themes, never more than six), so each story stays
 * well inside the visual tests' time.
 */
const sideBySide = (numbers: string, batch: readonly ThemeTokens[]): Story => ({
  name: `Side by side: ${numbers}`,
  render: () => {
    const page = comparisonPage();
    const themes = batch;
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${themes.length}, minmax(0, 1fr))`,
          gap: "8px",
        }}
      >
        {themes.map((theme) => (
          <ThemedPage key={theme.preset} preset={theme.preset} page={page} />
        ))}
      </div>
    );
  },
});

/** Themes 1–4 (2.13a, redone in 2.13d). */
export const SideBySide1to4: Story = sideBySide("1–4", CURATED_THEMES_A);

/** Themes 5–8 (2.13b). */
export const SideBySide5to8: Story = sideBySide("5–8", CURATED_THEMES_B);

/** Themes 9–12 (2.13c). */
export const SideBySide9to12: Story = sideBySide("9–12", CURATED_THEMES_C);
