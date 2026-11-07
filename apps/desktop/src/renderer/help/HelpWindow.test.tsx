// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { HelpTarget } from "../../shared/ipc/help.js";
import { HelpWindow } from "./HelpWindow.js";
import { helpLibraryOf } from "./help-library.js";

afterEach(cleanup);
beforeAll(() => {
  // happy-dom draws nothing, so it has nowhere to scroll to.
  Element.prototype.scrollIntoView = vi.fn();
});

const front = (id: string, title: string, extra = "") =>
  `---\nid: ${id}\ntitle: ${title}\nsummary: All about ${title.toLowerCase()}.\nrelated: []\nupdated: 2026-11-07\n${extra}---\n\n`;

const LIBRARY = helpLibraryOf(
  {
    "/help/site-check.md": `${front("site-check", "Site Check")}# Site Check\n\n**Site Check** lists what to fix in {appName}. See [Forms](forms.md#sending), [the web](https://www.example.org/) or [mail](mailto:a@example.org).\n\n## Tips\n\n| Check | What it means |\n|---|---|\n| **Year** | Shows \`{year}\` |\n\nSome <b>bold</b> HTML.`,
    "/help/forms.md": `${front("forms", "Forms", "status: partial\n")}# Forms\n\n## Sending\n\nForms send messages. Back to [Site Check](site-check.md).`,
  },
  "## Contents\n\n**Checking**\n- [Site Check](site-check.md)\n- [Forms](forms.md)\n",
);

function setUp(start: HelpTarget = {}, opened = true) {
  const openExternal = vi.fn(async (_url: string) => opened);
  let show: ((target: HelpTarget) => void) | undefined;
  const stop = vi.fn();
  const onShow = vi.fn((listener: (target: HelpTarget) => void) => {
    show = listener;
    return stop;
  });
  const view = render(
    <HelpWindow library={LIBRARY} start={start} openExternal={openExternal} onShow={onShow} />,
  );
  const main = within(screen.getByRole("main"));
  const contents = within(screen.getByRole("navigation", { name: "Contents" }));
  return {
    view,
    main,
    contents,
    openExternal,
    stop,
    show: (target: HelpTarget) => act(() => show?.(target)),
  };
}

describe("HelpWindow (5.4b, HP-6)", () => {
  it("starts at the contents, then shows a page from them", async () => {
    const { main, contents } = setUp();
    expect(main.getByRole("heading", { level: 1, name: "All help pages" })).toBeTruthy();
    expect(main.getByText("All about forms.")).toBeTruthy();

    await userEvent.click(contents.getByRole("button", { name: "Site Check" }));
    expect(main.getByRole("heading", { level: 1, name: "Site Check" })).toBeTruthy();
    expect(contents.getByRole("button", { name: "Site Check" }).getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("draws the page from its Markdown: the app's name, anchors, tables, code, and HTML only as text", () => {
    const { main } = setUp({ page: "site-check" });
    expect(main.getByText(/lists what to fix in Webforge/)).toBeTruthy();
    expect(main.getByRole("heading", { level: 2, name: "Tips" }).id).toBe("tips");
    expect(main.getByRole("columnheader", { name: "What it means" })).toBeTruthy();
    expect(main.getByText("{year}").tagName).toBe("CODE");
    expect(main.getByText(/<b>/)).toBeTruthy();
    expect(document.querySelector("main b")).toBeNull();
    // A link to nowhere the window can go is its text.
    expect(main.queryByRole("link", { name: "mail" })).toBeNull();
    expect(main.getByText(/or mail\./)).toBeTruthy();
  });

  it("follows a link to another page's heading, notes a partial page, and goes Back", async () => {
    const { main } = setUp({ page: "site-check" });
    await userEvent.click(main.getByRole("link", { name: "Forms" }));
    expect(main.getByRole("heading", { level: 2, name: "Sending" })).toBeTruthy();
    expect(main.getByText(/Part of this is still to come/)).toBeTruthy();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

    await userEvent.click(main.getByRole("button", { name: "Back to the page before" }));
    expect(main.getByRole("heading", { level: 1, name: "Site Check" })).toBeTruthy();
    expect(main.queryByRole("button", { name: "Back to the page before" })).toBeNull();
  });

  it("opens a page on the web in the browser, and says so when it couldn't", async () => {
    const { main, openExternal } = setUp({ page: "site-check" }, false);
    const link = main.getByRole("link", { name: "the web" });
    expect(link.getAttribute("title")).toBe("the web (opens in your web browser)");
    await userEvent.click(link);
    expect(openExternal).toHaveBeenCalledWith("https://www.example.org/");
    expect(await main.findByText(/Your web browser didn't open/)).toBeTruthy();
  });

  it("searches the pages' words, and says when none has them all", async () => {
    setUp();
    const search = screen.getByRole("searchbox", { name: "Search help" });
    await userEvent.type(search, "messages");
    const results = within(screen.getByRole("region", { name: "Pages with those words" }));
    await userEvent.click(results.getByRole("button", { name: "Forms" }));
    expect(screen.getByRole("heading", { level: 1, name: "Forms" })).toBeTruthy();
    expect((search as HTMLInputElement).value).toBe("");

    await userEvent.type(search, "messages volcano");
    expect(screen.getByText(/No page has all of those words/)).toBeTruthy();
  });

  it("moves where it's opened again, and stops listening when it goes", () => {
    const { main, show, view, stop } = setUp({ page: "forms" });
    show({ page: "site-check", anchor: "tips" });
    expect(main.getByRole("heading", { level: 1, name: "Site Check" })).toBeTruthy();
    show({ page: "nowhere" });
    expect(main.getByText(/isn't in this version of Webforge/)).toBeTruthy();
    expect(main.getByRole("heading", { level: 1, name: "All help pages" })).toBeTruthy();
    view.unmount();
    expect(stop).toHaveBeenCalled();
  });
});
