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
    const behaviours = siteLibrary.components.Video?.behaviours;
    // A section's are a function of its values: its own, and `animate` for an entrance (2.12).
    expect(typeof behaviours === "function" ? behaviours({}) : behaviours).toEqual(["embed"]);
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

describe("the Embed video and Embed map elements (2.11, F-CM-4)", () => {
  const element = (type: string, props: Record<string, unknown>): NodeDoc => ({
    type,
    props: { id: "embed", ...siteLibrary.components[type]?.defaults, ...props },
  });
  /** The canvas's context: a hint where an element lacks what it needs. */
  const canvas: RenderContext = {
    ...EDITOR_RENDER_CONTEXT,
    elementHint: (missing) => `Missing: ${missing}`,
  };

  it("shows the sections' click-to-load player among a section's elements, named as given", () => {
    const drawn = html(
      element("EmbedVideo", { address: "https://vimeo.com/76979871", name: "Our oven" }),
    );

    expect(drawn).toContain('class="site-embed-video');
    expect(drawn).toContain('data-src="https://player.vimeo.com/video/76979871?dnt=1"');
    expect(drawn).toContain('data-title="Our oven"');
    expect(drawn).toContain("Play the video from Vimeo");
  });

  it("shows a map of the address in Site Settings when bound to it", () => {
    const drawn = html(element("EmbedMap", { bindings: { address: "contact.address" } }), {
      ...EDITOR_RENDER_CONTEXT,
      setting: () => "1 High Street, Hightown",
    });

    expect(drawn).toContain("https://www.google.com/maps?q=1%20High%20Street%2C%20Hightown");
    expect(drawn).toContain(`data-title="${t("siteText.embed.mapTitle")}"`);
  });

  it("shows nothing without an address, and on the canvas a hint saying what to add", () => {
    expect(html(element("EmbedVideo", {}))).toBe("");
    expect(html(element("EmbedMap", {}))).toBe("");
    expect(html(element("EmbedMap", {}), canvas)).toContain("Missing: mapAddress");
    // Any text is a map's address, but only a YouTube or Vimeo link is a video.
    const notVideo = html(element("EmbedVideo", { address: "https://example.com/film" }), canvas);
    expect(notVideo).toContain("Missing: videoAddress");
    expect(notVideo).not.toContain("data-wf-embed");
  });

  it("says on the canvas to fill in Site Settings when bound to an empty address", () => {
    const bound = element("EmbedMap", { bindings: { address: "contact.address" } });

    const drawn = html(bound, { ...canvas, emptySetting: (key) => `Empty: ${key}` });

    expect(drawn).toContain("Empty: contact.address");
    expect(drawn).not.toContain("Missing");
  });

  it("needs the embed behaviour only with something to load, and animate for an entrance", () => {
    const behavioursOf = (type: string, values: Record<string, unknown>) => {
      const behaviours = siteLibrary.components[type]?.behaviours;
      return typeof behaviours === "function" ? behaviours(values) : behaviours;
    };
    const video = { address: "https://youtu.be/aqz-KE-bpKQ" };

    // Nothing to load, nothing exported: no behaviour (#389 review).
    expect(behavioursOf("EmbedVideo", {})).toEqual([]);
    expect(behavioursOf("EmbedVideo", { address: "https://example.com/film" })).toEqual([]);
    expect(behavioursOf("EmbedVideo", video)).toEqual(["embed"]);
    expect(behavioursOf("EmbedVideo", { ...video, entrance: "fade" })).toEqual([
      "embed",
      "animate",
    ]);
    expect(behavioursOf("EmbedMap", {})).toEqual([]);
    expect(behavioursOf("EmbedMap", { address: "1 High Street" })).toEqual(["embed"]);
    // Bound to Site Settings, whose address isn't known here: listed.
    expect(behavioursOf("EmbedMap", { bindings: { address: "contact.address" } })).toEqual([
      "embed",
    ]);
  });
});
