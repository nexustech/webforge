import type { SiteDoc } from "@webforge/model";
import { DEFAULT_THEME } from "@webforge/model";
import { createFakeEngine } from "@webforge/test-utils/renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasCssRequest, CanvasCssResult } from "../../shared/ipc/canvas.js";
import { starterSite } from "../../shared/starter-site.js";
import { sessionWith } from "../testing/fixtures.js";
import { classesOfHtml, connectSiteCss, SITE_CSS_DEBOUNCE_MS, siteClasses } from "./site-css.js";

function setup(
  answer: (n: number) => CanvasCssResult = (n) => ({
    status: "compiled",
    css: `.css${n}{}`,
    bodyClass: "bg-base-100",
  }),
) {
  const session = sessionWith();
  const engine = createFakeEngine();
  const answers: ((result: CanvasCssResult) => void)[] = [];
  const compile = vi.fn(
    () =>
      new Promise<CanvasCssResult>((resolve) => {
        answers.push(resolve);
      }),
  );
  const stop = connectSiteCss(engine, session, compile);
  /** Answers request `n` (0-based) and lets the promise settle. */
  const reply = async (n: number) => {
    answers[n]?.(answer(n));
    await Promise.resolve();
    await Promise.resolve();
  };
  const edit = (label: string, recipe: (draft: SiteDoc) => void) => {
    session.history.run(label, recipe);
    vi.advanceTimersByTime(SITE_CSS_DEBOUNCE_MS);
  };
  return { session, engine, compile, stop, reply, edit };
}

const firstHeading = (draft: SiteDoc) => {
  const home = draft.pages[draft.homePageId];
  const section = home?.doc.content[0];
  return (section?.props.content as { props: Record<string, unknown> }[] | undefined)?.[0]?.props;
};

describe("classesOfHtml", () => {
  it("reads class names as React escapes them, as the export does (2.9)", () => {
    expect(
      classesOfHtml(
        '<div class="grid [&amp;&gt;*:first-child]:col-span-2 [&amp;_p+p]:mt-4 [content:&quot;a&quot;]">',
      ),
    ).toEqual(["grid", "[&>*:first-child]:col-span-2", "[&_p+p]:mt-4", '[content:"a"]']);
  });
});

describe("siteClasses", () => {
  it("collects the classes of every page, the Header and the Footer", () => {
    const session = sessionWith();

    const classes = siteClasses(session.history.document.getState(), session);

    expect(classes).toContain("site-section");
    expect(classes).toContain("site-heading");
    expect(classes).toContain("navbar");
    expect(classes).toEqual([...new Set(classes)].sort());
  });

  it("collects an Image's classes as the canvas shows it, with or without its picture (#371)", () => {
    const session = sessionWith();
    session.history.run("Added Images", (draft) => {
      const section = draft.pages[draft.homePageId]?.doc.content[0];
      const content = section?.props.content;
      if (!Array.isArray(content)) throw new Error("no section");
      content.push(
        { type: "Image", props: { id: "empty", width: "small", alignment: "centre" } },
        {
          type: "Image",
          props: { id: "placed", image: { mediaId: "photo" }, width: "large", alignment: "right" },
        },
      );
    });

    const classes = siteClasses(session.history.document.getState(), session);

    // The hint's frame and the empty Image's width; the placed Image's picture, width and
    // alignment, whatever its image (one not in Media here).
    expect(classes).toEqual(
      expect.arrayContaining([
        "site-image",
        "aspect-video",
        "max-w-xs",
        "h-auto",
        "max-w-2xl",
        "ml-auto",
      ]),
    );
  });

  it("collects an image's classes with and without it, styled before it changes (#371)", () => {
    const session = sessionWith();
    session.history.run("Added Gallery", (draft) => {
      const content = draft.pages[draft.homePageId]?.doc.content[0]?.props.content;
      if (!Array.isArray(content)) throw new Error("no section");
      content.push({
        type: "Image",
        props: { id: "placed", image: { mediaId: "photo" }, width: "full", alignment: "centre" },
      });
      draft.pages[draft.homePageId]?.doc.content.push({
        type: "Gallery",
        props: {
          id: "gallery",
          images: [{ type: "GalleryImage", props: { id: "g1", image: { mediaId: "photo" } } }],
        },
      });
    });

    const classes = siteClasses(session.history.document.getState(), session);

    // Only placed images here, yet an empty Image's hint and an empty gallery square are styled
    // at once when one shows: a picture removed, or a gallery image added.
    expect(classes).toEqual(
      expect.arrayContaining(["h-auto", "aspect-video", "block", "bg-base-200"]),
    );
  });

  it("adds every spacing class a handle can drag to, styled before the next compile (1.32)", () => {
    const session = sessionWith();

    const classes = siteClasses(session.history.document.getState(), session);

    expect(classes).toEqual(expect.arrayContaining(["pt-32", "md:max-lg:mb-24", "lg:pl-0"]));
  });

  it("collects a colour field's own hex colours, which no safelist has (2.1)", () => {
    const session = sessionWith();
    session.history.run("Changed Heading colour", (draft) => {
      const heading = firstHeading(draft);
      if (heading !== undefined) {
        heading.advanced = { className: "bg-[#1f6feb] text-[#abcdef]/50" };
      }
    });

    const classes = siteClasses(session.history.document.getState(), session);

    expect(classes).toEqual(expect.arrayContaining(["bg-[#1f6feb]", "text-[#abcdef]/50"]));
  });

  it("keeps the classes of elements hidden in Layers, which the canvas still shows (#142)", () => {
    const site = starterSite();
    const home = site.pages[site.homePageId];
    if (home === undefined) throw new Error("no home page");
    const hidden: SiteDoc = {
      ...site,
      pages: {
        ...site.pages,
        [home.id]: {
          ...home,
          doc: {
            root: { props: {} },
            content: [{ type: "Hero", props: { id: "hero", title: "Hidden", hidden: true } }],
          },
        },
      },
    };
    const session = sessionWith(hidden);

    const classes = siteClasses(hidden, session);

    expect(classes).toContain("hero");
    expect(classes).toContain("hero-content");
  });
});

describe("connectSiteCss", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("compiles the site's classes at once and styles the canvas with the result", async () => {
    const { session, engine, compile, reply } = setup();

    expect(compile).toHaveBeenCalledWith({
      theme: session.history.document.getState().theme,
      candidates: siteClasses(session.history.document.getState(), session),
    });
    await reply(0);
    expect(engine.setSiteCss).toHaveBeenCalledWith(".css0{}", "bg-base-100");
  });

  it("recompiles only when the classes or the theme change, once the document is still", async () => {
    const { compile, edit } = setup();

    edit("Edited Heading text", (draft) => {
      const heading = firstHeading(draft);
      if (heading !== undefined) heading.text = "New words, same classes";
    });
    expect(compile).toHaveBeenCalledTimes(1);

    edit("Changed Heading size", (draft) => {
      const heading = firstHeading(draft);
      if (heading !== undefined) heading.size = "small";
    });
    expect(compile).toHaveBeenCalledTimes(2);

    edit("Changed theme", (draft) => {
      draft.theme = { ...DEFAULT_THEME, preset: "dark" };
    });
    expect(compile).toHaveBeenCalledTimes(3);
    expect(compile).toHaveBeenLastCalledWith(
      expect.objectContaining({ theme: expect.objectContaining({ preset: "dark" }) }),
    );
  });

  it("waits for the document to be still before collecting classes", () => {
    const { session, compile } = setup();

    session.history.run("Changed theme", (draft) => {
      draft.theme = { ...DEFAULT_THEME, preset: "dark" };
    });
    vi.advanceTimersByTime(SITE_CSS_DEBOUNCE_MS - 1);

    expect(compile).toHaveBeenCalledTimes(1);
  });

  it("drops an answer a newer request has overtaken", async () => {
    const { engine, edit, reply } = setup();
    edit("Changed theme", (draft) => {
      draft.theme = { ...DEFAULT_THEME, preset: "dark" };
    });

    await reply(0);
    expect(engine.setSiteCss).not.toHaveBeenCalled();
    await reply(1);
    expect(engine.setSiteCss).toHaveBeenCalledWith(".css1{}", "bg-base-100");
  });

  it("keeps the last styles when a compile fails, and tries again after the next change", async () => {
    const { engine, compile, reply, edit } = setup(() => ({ status: "failed" }));

    await reply(0);
    expect(engine.setSiteCss).not.toHaveBeenCalled();

    // Same classes, but the last compile failed.
    edit("Edited Heading text", (draft) => {
      const heading = firstHeading(draft);
      if (heading !== undefined) heading.text = "Again";
    });
    expect(compile).toHaveBeenCalledTimes(2);
  });

  it("handles a compile call that rejects, and tries again after the next change", async () => {
    const session = sessionWith();
    const compile = vi.fn(() => Promise.reject(new Error("IPC failed")));
    connectSiteCss(createFakeEngine(), session, compile);
    await Promise.resolve();

    session.history.run("Changed site name", (draft) => {
      draft.settings.general.name = "Bakery";
    });
    vi.advanceTimersByTime(SITE_CSS_DEBOUNCE_MS);

    expect(compile).toHaveBeenCalledTimes(2);
  });

  it("stops listening and ignores late answers once stopped", async () => {
    const { session, engine, compile, stop, reply } = setup();
    session.history.run("Changed theme", (draft) => {
      draft.theme = { ...DEFAULT_THEME, preset: "dark" };
    });

    stop();
    vi.advanceTimersByTime(SITE_CSS_DEBOUNCE_MS);
    await reply(0);

    expect(compile).toHaveBeenCalledTimes(1);
    expect(engine.setSiteCss).not.toHaveBeenCalled();
  });

  it("styles the rest of a site with a component the library lacks (#142)", () => {
    const site = starterSite();
    site.layout.header = [{ type: "NoSuchComponent", props: { id: "c" } }];
    const session = sessionWith(site);
    const compile = vi.fn(
      async (_request: CanvasCssRequest): Promise<CanvasCssResult> => ({ status: "failed" }),
    );

    connectSiteCss(createFakeEngine(), session, compile)();

    expect(compile).toHaveBeenCalledOnce();
    expect(compile.mock.calls[0]?.[0].candidates).toContain("site-section");
  });
});
