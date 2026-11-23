import type { ImageMeta, MediaId, SiteDoc } from "@webforge/model";
import { describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { createAppTools, openPreviewFor, PREVIEW_AGAIN_MS } from "./app-tools.js";

/** The address a preview opened at: on this computer, with its secret base. */
const PAGE_ADDRESS = "http://127.0.0.1:54321/a1b2c3d4/index.html";

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
  const openPreview = vi.fn(async (): Promise<string | null> => PAGE_ADDRESS);
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
  it("checks a held reply's draft, by its stage, and the site for any other request (5.18)", () => {
    const draft = siteWithBareImage();
    const site = starterSite();
    const asked: (string | undefined)[] = [];
    const tools = createAppTools({
      site: (stage) => {
        asked.push(stage);
        return stage === "stage-1" ? draft : site;
      },
      allowListConfirmed: () => false,
      ignored: () => [],
      openPreview: async () => null,
    });
    const rules = (answer: ReturnType<typeof tools.runSiteCheck>) =>
      answer.status === "done" && "data" in answer
        ? (answer.data as { found: { rule: string }[] }).found.map((each) => each.rule)
        : [];

    expect(rules(tools.runSiteCheck({ stage: "stage-1" }))).toContain("altText");
    expect(rules(tools.runSiteCheck())).not.toContain("altText");
    expect(asked).toEqual(["stage-1", undefined]);
  });

  it("runs Site Check, with each finding's place by id and its facts, never its text", () => {
    const { site, tools } = setUp();

    const answer = tools.runSiteCheck();

    expect(answer).toMatchObject({ status: "done", data: { mode: "export" } });
    const data = answer?.status === "done" && "data" in answer ? answer.data : undefined;
    const found = (data as { found: { rule: string; title: string; places: unknown[] }[] }).found;
    expect(found.find((each) => each.rule === "altText")).toEqual({
      rule: "altText",
      title: expect.any(String),
      level: "should",
      places: [{ kind: "element", on: site.homePageId, nodeId: "pic" }],
      // The Media item it shows, by id; never its file name (#1253).
      facts: [{ mediaId: "bare" }],
    });
    expect(JSON.stringify(answer)).not.toContain(MARKER);
  });

  it("says which colours a theme contrast finding is about, and its ratios (#1253)", () => {
    const site = siteWithBareImage();
    // Text nearly the page's own colour: hard to read on every surface.
    site.theme = {
      ...site.theme,
      colors: { ...site.theme.colors, "base-content": { l: 0.93, c: 0, h: 0 } },
    };
    // A page named with the marker: its title is never a fact.
    const home = site.pages[site.homePageId];
    if (home !== undefined) home.title = MARKER;
    const { tools } = setUp(site);

    const answer = tools.runSiteCheck();
    const data = answer?.status === "done" && "data" in answer ? answer.data : undefined;
    const found = (
      data as {
        found: { rule: string; places: { kind: string }[]; facts?: Record<string, unknown>[] }[];
      }
    ).found;
    const contrast = found.find((each) => each.rule === "contrast");

    expect(contrast?.places).toContainEqual({ kind: "theme" });
    const atTheme = contrast?.places.flatMap((place, at) =>
      place.kind === "theme" ? [contrast.facts?.[at]] : [],
    );
    expect(atTheme).toContainEqual({
      palette: "colors",
      background: "base-100",
      foreground: "base-content",
      ratio: expect.any(Number),
      required: 4.5,
    });
    for (const facts of atTheme ?? []) {
      expect(facts?.ratio as number).toBeLessThan(facts?.required as number);
    }
    // Facts are numbers and listed names: never the site's own text.
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
        openPreview: async () => null,
        onNetlify: () => onNetlify,
      }).runSiteCheck();
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
      openPreview: async () => null,
    }).runSiteCheck();

    expect(JSON.stringify(ignored)).not.toContain('"altText"');
  });

  it("opens the Preview, once in a few seconds, never the phone's, with its page's address", async () => {
    const { tools, openPreview, later } = setUp();
    const open = () => tools.openPreview();

    // The page's address on this computer, for the app to look at its work (#1255).
    expect(await open()).toEqual({
      status: "done",
      data: { opened: true, address: PAGE_ADDRESS },
    });
    expect(await open()).toMatchObject({ status: "done", data: { opened: false } });
    later(PREVIEW_AGAIN_MS);
    // One that doesn't open says so, with no address.
    openPreview.mockResolvedValueOnce(null);
    expect(await open()).toEqual({
      status: "done",
      data: { opened: false, reason: "The preview didn't open." },
    });
    expect(openPreview).toHaveBeenCalledTimes(2);
  });
});

describe("openPreviewFor (#1255)", () => {
  it("asks for the next address before the command runs, and tells main when it can't run", async () => {
    const order: string[] = [];
    let tell: (address: string | null) => void = () => undefined;
    const preview = (runs: boolean) => ({
      next: () => {
        order.push("next");
        return new Promise<string | null>((resolve) => {
          tell = resolve;
        });
      },
      run: () => {
        order.push("run");
        return runs;
      },
      cancel: vi.fn(async () => {
        tell(null);
        return null;
      }),
    });

    const ran = preview(true);
    const opened = openPreviewFor(ran);
    expect(order).toEqual(["next", "run"]);
    tell(PAGE_ADDRESS);
    expect(await opened).toBe(PAGE_ADDRESS);
    expect(ran.cancel).not.toHaveBeenCalled();

    // A command that can't run now: main's waiter is told at once that none follows.
    const disabled = preview(false);
    expect(await openPreviewFor(disabled)).toBeNull();
    expect(disabled.cancel).toHaveBeenCalledOnce();
  });
});
