import type { ImageMeta, MediaId, SiteDoc } from "@webforge/model";
import { describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { createAppTools, PREVIEW_AGAIN_MS } from "./app-tools.js";

/** Text that must never reach an AI app from Site Check: a file name, which a finding carries. */
const MARKER = "zz-marker-4-9";

/** The starter site with an image placed without alt text, its file named with {@link MARKER}. */
function siteWithBareImage(): SiteDoc {
  const site = starterSite();
  const image: ImageMeta = {
    id: "bare" as MediaId,
    hash: "a".repeat(64),
    name: "Shop",
    fileName: `${MARKER}.jpg`,
    kind: "image",
    mimeType: "image/jpeg",
    width: 10,
    height: 10,
    alt: "",
  };
  site.media = { [image.id]: image };
  const home = site.pages[site.homePageId];
  if (home === undefined) throw new Error("no home page");
  home.doc.content.push({
    type: "Section",
    props: {
      id: "s",
      content: [{ type: "Image", props: { id: "pic", image: { mediaId: "bare" } } }],
    },
  });
  return site;
}

function setUp(site = siteWithBareImage()) {
  let time = 0;
  const openPreview = vi.fn();
  const tools = createAppTools({
    site: () => site,
    allowListConfirmed: () => false,
    ignored: () => [],
    openPreview,
    now: () => time,
  });
  return {
    site,
    tools,
    openPreview,
    later: (ms: number) => {
      time += ms;
    },
  };
}

describe("the window's own AI tools (4.9)", () => {
  it("runs Site Check, with each finding's place by id and never its text", () => {
    const { site, tools } = setUp();

    const answer = tools({ kind: "query", name: "runSiteCheck", input: {} });

    expect(answer).toMatchObject({ status: "done", data: { mode: "export" } });
    const data = answer?.status === "done" && "data" in answer ? answer.data : undefined;
    const found = (data as { found: { rule: string; title: string; places: unknown[] }[] }).found;
    expect(found.find((each) => each.rule === "altText")).toEqual({
      rule: "altText",
      title: expect.any(String),
      level: "should",
      places: [{ kind: "element", on: site.homePageId, nodeId: "pic" }],
    });
    expect(JSON.stringify(answer)).not.toContain(MARKER);
  });

  it("counts Netlify Forms as able to send once the site has a Netlify destination (4.2)", () => {
    const site = starterSite();
    site.settings.forms.service = { kind: "netlify" };
    site.pages[site.homePageId]?.doc.content.push({ type: "ContactForm", props: { id: "c" } });
    const rules = (onNetlify: boolean) => {
      const answer = createAppTools({
        site: () => site,
        allowListConfirmed: () => false,
        ignored: () => [],
        openPreview: () => {},
        onNetlify: () => onNetlify,
      })({ kind: "query", name: "runSiteCheck", input: {} });
      const data = answer?.status === "done" && "data" in answer ? answer.data : undefined;
      return (data as { found: { rule: string }[] }).found.map(({ rule }) => rule);
    };

    expect(rules(false)).toContain("forms");
    expect(rules(true)).not.toContain("forms");
  });

  it("leaves out what the person ignored, as their Site Check does", () => {
    const site = siteWithBareImage();
    const ignored = createAppTools({
      site: () => site,
      allowListConfirmed: () => false,
      ignored: () => [`altText:${site.homePageId}/pic/image`],
      openPreview: () => undefined,
    })({ kind: "query", name: "runSiteCheck", input: {} });

    expect(JSON.stringify(ignored)).not.toContain('"altText"');
  });

  it("opens the Preview, once in a few seconds, never the phone's", () => {
    const { tools, openPreview, later } = setUp();
    const open = () => tools({ kind: "query", name: "openPreview", input: {} });

    expect(open()).toEqual({ status: "done", data: { opened: true } });
    expect(open()).toMatchObject({ status: "done", data: { opened: false } });
    later(PREVIEW_AGAIN_MS);
    expect(open()).toEqual({ status: "done", data: { opened: true } });
    expect(openPreview).toHaveBeenCalledTimes(2);
  });

  it("leaves every other request to the command layer", () => {
    const { tools } = setUp();

    expect(tools({ kind: "query", name: "outline", input: {} })).toBeUndefined();
    expect(
      tools({ kind: "command", name: "openPreview", input: {}, app: "Claude" }),
    ).toBeUndefined();
  });
});
