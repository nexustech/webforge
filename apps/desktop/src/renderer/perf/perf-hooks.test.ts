// @vitest-environment happy-dom
import { siteLibrary, starterPage } from "@webforge/site-components";
import { describe, expect, it } from "vitest";
import { createEditorSession, currentPage } from "../editor/editor-session.js";
import { starterSite } from "../editor/starter-site.js";
import { createPerfHooks, installPerfHooks } from "./perf-hooks.js";

const newSession = () => createEditorSession(siteLibrary, starterSite());

describe("perf hooks", () => {
  it("loads a validated page and starts with an empty history", () => {
    const session = newSession();
    const hooks = createPerfHooks(session);

    // The renderer has no Node types, so not @webforge/test-utils' largePage: two starter pages.
    const starter = starterPage();
    const page = { ...starter, content: [...starter.content, ...starterPage().content] };
    hooks.loadPage(page);

    expect(currentPage(session)?.doc).toEqual(page);
    expect(session.history.state.getState().entries).toEqual([]);
    expect(() => hooks.loadPage({ content: "not a page" })).toThrow();
  });

  it("adds undoable steps that toggle the first heading's size, labelled like real edits", () => {
    const session = newSession();
    const hooks = createPerfHooks(session);
    hooks.addSteps(3);

    const { entries } = session.history.state.getState();
    expect(entries.map((entry) => entry.label)).toEqual(Array(3).fill("Changed Heading size"));
    const sizeOf = () =>
      (
        currentPage(session)?.doc.content[0]?.props.content as
          | { props: { size: string } }[]
          | undefined
      )?.[0]?.props.size;
    const before = sizeOf();
    expect(before).toBeDefined();
    session.history.undo();
    expect(sizeOf()).not.toBe(before);
  });

  it("installs the hooks on window", () => {
    installPerfHooks(newSession());

    expect(window.__webforgePerf?.addSteps).toBeTypeOf("function");
  });
});
