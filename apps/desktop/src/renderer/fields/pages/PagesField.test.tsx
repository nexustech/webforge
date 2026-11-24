// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { insertPage, newId, type PageId } from "@webforge/model";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionWith } from "../../testing/fixtures.js";
import { PagesField, pageChoices } from "./PagesField.js";

afterEach(cleanup);

/** A starter site with pages Menu, and Download hidden from the menu. */
function siteWithPages() {
  const session = sessionWith();
  const ids: Record<string, PageId> = {};
  session.edit("insert", "Added pages", (draft) => {
    for (const title of ["Menu", "Download"]) {
      const id = newId("page");
      ids[title] = id;
      insertPage(draft, id, title);
    }
    const download = ids.Download === undefined ? undefined : draft.pages[ids.Download];
    if (download !== undefined) download.settings.hideFromNavigation = true;
  });
  return { session, ids };
}

describe("the pages a pages field offers (HF-8)", () => {
  it("offers the menu's pages to leave out, and every other page to add", () => {
    const { session, ids } = siteWithPages();
    const site = session.history.document.getState();
    const menu = pageChoices(site, "menu");
    const others = pageChoices(site, "others");

    expect(menu.map((each) => each.value)).toContain(ids.Menu);
    expect(menu.map((each) => each.value)).not.toContain(ids.Download);
    expect(others.map((each) => each.value)).toEqual([ids.Download]);
    // "Page not found" is never offered.
    const notFound = Object.values(site.pages).find((page) => page.kind === "not-found")?.id;
    expect([...menu, ...others].map((each) => each.value)).not.toContain(notFound);
  });
});

describe("PagesField", () => {
  it("ticks the pages it holds, and reports the pages ticked, done at once", () => {
    const { session, ids } = siteWithPages();
    const onChange = vi.fn();
    const onCommit = vi.fn();
    render(
      <>
        <span id="label">Add</span>
        <PagesField
          id="field"
          labelId="label"
          field={{ kind: "pages", label: "Add", from: "others" }}
          value={[]}
          onChange={onChange}
          onCommit={onCommit}
          session={session}
        />
      </>,
    );

    const download = screen.getByRole("checkbox", { name: "Download" });
    expect((download as HTMLInputElement).checked).toBe(false);
    act(() => {
      fireEvent.click(download);
    });

    expect(onChange).toHaveBeenCalledWith([ids.Download]);
    expect(onCommit).toHaveBeenCalledOnce();
    expect(screen.getByRole("group", { name: "Add" })).toBeTruthy();
  });
});
