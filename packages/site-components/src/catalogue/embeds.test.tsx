import { t } from "@webforge/i18n";
import type { NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import type { RenderContext } from "../schema.js";
import { siteLibrary } from "./index.js";

const html = (node: NodeDoc, context: RenderContext = EDITOR_RENDER_CONTEXT) =>
  renderNodesToHtml([node], siteLibrary, context);

const video = (props: Record<string, unknown>): NodeDoc => ({
  type: "Video",
  props: { id: "video", ...siteLibrary.components.Video?.defaults, ...props },
});
const map = (props: Record<string, unknown>): NodeDoc => ({
  type: "Map",
  props: { id: "map", ...siteLibrary.components.Map?.defaults, ...props },
});

describe("the Video (F-CM-4)", () => {
  it("starts with its title and text, and no video until it has an address", () => {
    const drawn = html(video({}));

    expect(drawn).toContain('class="site-video');
    expect(drawn).toContain(t("starter.videoTitle"));
    expect(drawn).toContain(t("starter.videoText"));
    expect(drawn).not.toContain("data-wf-embed");
  });

  it("shows a placeholder that loads the privacy-enhanced player when played", () => {
    const drawn = html(video({ address: "https://www.youtube.com/watch?v=aqz-KE-bpKQ" }));

    expect(drawn).toContain('data-src="https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ"');
    expect(drawn).toContain(`data-title="${t("starter.videoTitle")}"`);
    expect(drawn).toContain("Play the video from YouTube");
    expect(drawn).toContain("YouTube may set cookies once it loads.");
    expect(drawn).toContain(
      '<a class="link text-sm" href="https://www.youtube.com/watch?v=aqz-KE-bpKQ" target="_blank" rel="noopener noreferrer">Watch on YouTube</a>',
    );
    // Nothing that would make the browser fetch from YouTube before the click.
    expect(drawn).not.toContain("<iframe");
    expect(drawn).not.toMatch(/\ssrc="/);
  });

  it("shows no video for an address that isn't a YouTube or Vimeo video", () => {
    expect(html(video({ address: "https://example.com/film.mp4" }))).not.toContain("data-wf-embed");
  });

  it("puts the text beside the video in the split layout", () => {
    const drawn = html(video({ address: "https://vimeo.com/76979871", variant: "split" }));

    expect(drawn).toContain("md:grid-cols-2");
    expect(drawn).toContain('data-src="https://player.vimeo.com/video/76979871?dnt=1"');
    expect(drawn).toContain("Watch on Vimeo");
  });

  it("needs the embed behaviour", () => {
    expect(siteLibrary.components.Video?.behaviours).toEqual(["embed"]);
  });
});

describe("the Map (F-CM-4, 1.17)", () => {
  it("shows Google Maps' map of its address, loaded when the visitor asks", () => {
    const drawn = html(map({ address: "1 High Street\nHightown" }));

    expect(drawn).toContain('class="site-map');
    expect(drawn).toContain(
      'data-src="https://www.google.com/maps?q=1%20High%20Street%2C%20Hightown&amp;output=embed"',
    );
    expect(drawn).toContain("Show the map from Google Maps");
    expect(drawn).toContain("Open in Google Maps");
    expect(drawn).not.toMatch(/\ssrc="/);
  });

  it("shows the address in Site Settings when bound to it, and follows it", () => {
    const context = (address: string | undefined): RenderContext => ({
      ...EDITOR_RENDER_CONTEXT,
      setting: (key) => (key === "contact.address" ? address : undefined),
    });
    const bound = map({ address: "Old Street", bindings: { address: "contact.address" } });

    expect(html(bound, context("1 High Street"))).toContain("maps?q=1%20High%20Street&amp;");
    expect(html(bound, context("2 Market Square"))).toContain("maps?q=2%20Market%20Square&amp;");
    // An empty Site Settings address: no map, rather than the field's own old text.
    expect(html(bound, context(undefined))).not.toContain("data-wf-embed");
  });

  it("shows no map without an address", () => {
    expect(html(map({}))).not.toContain("data-wf-embed");
  });
});
