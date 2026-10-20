import type { SiteDoc } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasCssResult } from "../../shared/ipc/canvas.js";
import { withCanvasFonts } from "./canvas-fonts.js";
import { createEditorSession } from "./editor-session.js";
import { createFakeEngine } from "./fake-engine.test-helper.js";
import { connectSiteCss, SITE_CSS_DEBOUNCE_MS, siteClasses } from "./site-css.js";
import { starterSite } from "./starter-site.js";

const BASE = "file:///app/index.html";

function setup(
  answer: (n: number) => CanvasCssResult = (n) => ({
    status: "compiled",
    css: `.css${n}{}`,
    bodyClass: "bg-base-100",
  }),
) {
  const session = createEditorSession(siteLibrary, starterSite());
  const engine = createFakeEngine();
  const answers: ((result: CanvasCssResult) => void)[] = [];
  const compile = vi.fn(
    () =>
      new Promise<CanvasCssResult>((resolve) => {
        answers.push(resolve);
      }),
  );
  const stop = connectSiteCss(engine, session, compile, BASE);
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

describe("siteClasses", () => {
  it("collects the classes of every page, the Header and the Footer", () => {
    const session = createEditorSession(siteLibrary, starterSite());

    const classes = siteClasses(session.history.document.getState(), session);

    expect(classes).toContain("site-section");
    expect(classes).toContain("site-heading");
    expect(classes).toContain("navbar");
    expect(classes).toEqual([...new Set(classes)].sort());
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
      draft.theme = { name: "dark" };
    });
    expect(compile).toHaveBeenCalledTimes(3);
    expect(compile).toHaveBeenLastCalledWith(expect.objectContaining({ theme: { name: "dark" } }));
  });

  it("waits for the document to be still before collecting classes", () => {
    const { session, compile } = setup();

    session.history.run("Changed theme", (draft) => {
      draft.theme = { name: "dark" };
    });
    vi.advanceTimersByTime(SITE_CSS_DEBOUNCE_MS - 1);

    expect(compile).toHaveBeenCalledTimes(1);
  });

  it("drops an answer a newer request has overtaken", async () => {
    const { engine, edit, reply } = setup();
    edit("Changed theme", (draft) => {
      draft.theme = { name: "dark" };
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
    const session = createEditorSession(siteLibrary, starterSite());
    const compile = vi.fn(() => Promise.reject(new Error("IPC failed")));
    connectSiteCss(createFakeEngine(), session, compile, BASE);
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
      draft.theme = { name: "dark" };
    });

    stop();
    vi.advanceTimersByTime(SITE_CSS_DEBOUNCE_MS);
    await reply(0);

    expect(compile).toHaveBeenCalledTimes(1);
    expect(engine.setSiteCss).not.toHaveBeenCalled();
  });

  it("skips a site with a component the library lacks", () => {
    const site = starterSite();
    site.layout.header = [{ type: "Carousel", props: { id: "c" } }];
    const session = createEditorSession(siteLibrary, site);
    const compile = vi.fn();

    connectSiteCss(createFakeEngine(), session, compile, BASE)();

    expect(compile).not.toHaveBeenCalled();
  });
});

describe("withCanvasFonts", () => {
  it("points known fonts at the editor's files, as absolute URLs, and leaves the others", () => {
    const css = [
      '@font-face { src: url("webforge-font:inter-latin-400-normal.woff2") format("woff2"); }',
      '@font-face { src: url("webforge-font:unknown.woff2") format("woff2"); }',
    ].join("\n");

    const result = withCanvasFonts(css, BASE);

    expect(result).not.toContain("webforge-font:inter-latin-400-normal.woff2");
    expect(result).toMatch(/url\("[a-z]+:\/\/[^"]*inter-latin-400-normal[^"]*\.woff2"\)/);
    expect(result).toContain('url("webforge-font:unknown.woff2")');
  });
});
