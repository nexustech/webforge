// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import type { RenderedPage } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterSite } from "../../shared/starter-site.js";
import { canvasLayout } from "./shared-layout.js";
import { homePageDocument, SitePictureStage } from "./site-picture.js";

afterEach(cleanup);

const drawn: RenderedPage = {
  header: '<header class="site-header">Rosa\'s Bakery</header>',
  main: '<section class="site-hero py-16">Fresh bread</section>',
  footer: "",
};

describe("homePageDocument (#1175)", () => {
  it("draws the home page with its Header and Footer, as the export lays the page out", async () => {
    const site = starterSite();
    const staticPage = vi.fn(() => drawn);
    const compileCss = vi.fn(async () => ({
      status: "compiled" as const,
      css: ".py-16 { padding-block: 4rem; }",
      bodyClass: "flex flex-col min-h-screen",
    }));

    const html = await homePageDocument(site, { staticPage }, compileCss);

    expect(staticPage).toHaveBeenCalledWith(
      site.pages[site.homePageId]?.doc,
      canvasLayout(site, site.homePageId),
      site.sharedSections,
    );
    // The classes its markup uses, the export's <main>'s among them.
    expect(compileCss).toHaveBeenCalledWith({
      theme: site.theme,
      candidates: ["flex-1", "py-16", "site-header", "site-hero"],
    });
    expect(html).toContain(`<html data-theme="${site.theme.preset}">`);
    expect(html).toContain(".py-16 { padding-block: 4rem; }");
    expect(html).toContain('<body class="flex flex-col min-h-screen">');
    expect(html).toContain(
      `${drawn.header}\n<main id="main" class="flex-1">${drawn.main}</main>\n</body>`,
    );
  });

  it("draws nothing without a home page, before the engine has its library, or without CSS", async () => {
    const site = starterSite();
    const compiled = async () => ({ status: "compiled" as const, css: "", bodyClass: "" });

    const homeless = { ...site, pages: {} };
    expect(await homePageDocument(homeless, { staticPage: () => drawn }, compiled)).toBeUndefined();
    expect(await homePageDocument(site, { staticPage: () => undefined }, compiled)).toBeUndefined();
    expect(
      await homePageDocument(site, { staticPage: () => drawn }, async () => ({
        status: "failed" as const,
      })),
    ).toBeUndefined();
  });
});

describe("SitePictureStage (#1175)", () => {
  /** The stage with an app whose requests the test makes, as the main process does. */
  function setUp(draw: () => Promise<string | undefined>) {
    let requests: { draw: () => Promise<boolean>; done: () => void } | undefined;
    const stop = vi.fn();
    const app = {
      onSitePicture: (onDraw: () => Promise<boolean>, onDone: () => void) => {
        requests = { draw: onDraw, done: onDone };
        return stop;
      },
    };
    const view = render(<SitePictureStage app={app} draw={draw} />);
    const asked = () => {
      if (requests === undefined) throw new Error("not listening");
      return requests;
    };
    const frame = () => document.querySelector<HTMLIFrameElement>("[data-site-picture] iframe");
    return { view, asked, frame, stop };
  }

  it("draws the page where it's pictured, says so once loaded, and takes it away when done", async () => {
    const { asked, frame } = setUp(async () => "<p>Home</p>");

    let answer: Promise<boolean> | undefined;
    await act(async () => {
      answer = asked().draw();
    });
    const shown = frame();
    expect(shown?.getAttribute("srcdoc")).toBe("<p>Home</p>");
    // Scripts never run in it.
    expect(shown?.getAttribute("sandbox")).toBe("allow-same-origin");
    if (shown === null) throw new Error("no frame");
    fireEvent.load(shown);
    await expect(answer).resolves.toBe(true);

    act(() => asked().done());
    expect(frame()).toBeNull();
  });

  it("answers that nothing is drawn when the page can't be, or is taken away first", async () => {
    const nothing = setUp(async () => undefined);
    await expect(nothing.asked().draw()).resolves.toBe(false);
    expect(nothing.frame()).toBeNull();
    nothing.view.unmount();

    const { asked, frame } = setUp(async () => "<p>Home</p>");
    let answer: Promise<boolean> | undefined;
    await act(async () => {
      answer = asked().draw();
    });
    act(() => asked().done());
    await expect(answer).resolves.toBe(false);
    expect(frame()).toBeNull();
  });

  it("stops listening once the editor goes", () => {
    const { view, stop } = setUp(async () => undefined);
    view.unmount();
    expect(stop).toHaveBeenCalledOnce();
  });
});
