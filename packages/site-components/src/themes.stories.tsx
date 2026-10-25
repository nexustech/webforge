import stylesheets from "virtual:webforge-theme-css";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { type NodeDoc, pastedCopies } from "@webforge/model";
import { CURATED_THEMES } from "@webforge/themes";
import { siteLibrary, starterLayout } from "./catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "./library.js";
import { renderNodesToHtml } from "./render-static.js";

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
  const nodes = pastedCopies([...header, ...sections, ...footer], new Set());
  return renderNodesToHtml(nodes, siteLibrary, EDITOR_RENDER_CONTEXT);
}

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

/** The curated themes side by side, each as narrow as a phone, for comparing at a glance. */
export const SideBySide: Story = {
  name: "Side by side",
  render: () => {
    const page = samplePage();
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${CURATED_THEMES.length}, minmax(0, 1fr))`,
          gap: "8px",
        }}
      >
        {CURATED_THEMES.map((theme) => (
          <ThemedPage key={theme.preset} preset={theme.preset} page={page} />
        ))}
      </div>
    );
  },
};
