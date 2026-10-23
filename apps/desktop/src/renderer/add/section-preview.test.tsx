// @vitest-environment happy-dom
import { act, cleanup, render } from "@testing-library/react";
import type { NodeDoc, SharedSectionId } from "@webforge/model";
import { siteLibrary } from "@webforge/site-components";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterSite } from "../editor/starter-site.js";
import { createSectionPreviews } from "./section-preview.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(cleanup);

const HOURS = "shared-hours" as SharedSectionId;
const { theme } = starterSite();
/** The section "Opening hours" stores: the same object until it is edited, as in the document. */
const HOURS_SECTION: NodeDoc = {
  type: "Section",
  props: { id: "s", content: [{ type: "Heading", props: { id: "t", text: "Opening hours" } }] },
};

function setUp(status: "compiled" | "failed" = "compiled") {
  const compileCss = vi.fn(async () =>
    status === "compiled"
      ? { status, css: ".wf-hero{color:red}", bodyClass: "bg-base-100" }
      : { status },
  );
  const previews = createSectionPreviews({
    library: siteLibrary,
    theme: () => theme,
    sharedSection: (id) => (id === HOURS ? HOURS_SECTION : undefined),
    compileCss,
    baseUrl: "http://localhost/",
  });
  return { previews, compileCss };
}

/** Shows `node` and waits for its drawing; the preview's shadow root, if it drew one. */
async function shown(node: ReturnType<ReturnType<typeof createSectionPreviews>>) {
  const { container } = render(<>{node}</>);
  await act(async () => undefined);
  return container.firstElementChild?.shadowRoot ?? null;
}

describe("createSectionPreviews (UX-10)", () => {
  it("draws a section with its defaults and the CSS its classes need, in a shadow root", async () => {
    const { previews, compileCss } = setUp();

    const root = await shown(previews({ type: "Hero", label: "Hero", category: "Heroes" }));

    expect(root?.querySelector("style")?.textContent).toContain(".wf-hero{color:red}");
    expect(root?.querySelector(".wf-preview")?.className).toBe("wf-preview bg-base-100");
    expect(root?.querySelector(".wf-preview")?.innerHTML).not.toBe("");
    expect(compileCss).toHaveBeenCalledWith(
      expect.objectContaining({ theme, candidates: expect.any(Array) }),
    );
  });

  it("draws a shared section as the site holds it, and each one once", async () => {
    const { previews, compileCss } = setUp();
    const item = {
      type: HOURS,
      label: "Hours",
      category: "Shared sections",
      sharedSectionId: HOURS,
    };

    await shown(previews(item));
    cleanup();
    const root = await shown(previews(item));

    expect(root?.querySelector(".wf-preview")?.textContent).toContain("Opening hours");
    expect(compileCss).toHaveBeenCalledTimes(1);
  });

  it("draws a section once, and again once the theme has changed", async () => {
    let current = theme;
    const compileCss = vi.fn(async () => ({
      status: "compiled" as const,
      css: "",
      bodyClass: "",
    }));
    const previews = createSectionPreviews({
      library: siteLibrary,
      theme: () => current,
      sharedSection: () => undefined,
      compileCss,
      baseUrl: "http://localhost/",
    });
    const hero = { type: "Hero", label: "Hero", category: "Heroes" };

    await shown(previews(hero));
    cleanup();
    await shown(previews(hero));
    expect(compileCss).toHaveBeenCalledTimes(1);

    current = { ...theme };
    cleanup();
    await shown(previews(hero));
    expect(compileCss).toHaveBeenCalledTimes(2);
  });

  it("has none for an element, a shared section gone, or CSS that failed", async () => {
    const { previews } = setUp("failed");

    expect(previews({ type: "Heading", label: "Heading", category: "Text" })).toBeNull();
    expect(
      previews({
        type: "shared-gone",
        label: "Gone",
        category: "Shared sections",
        sharedSectionId: "shared-gone" as SharedSectionId,
      }),
    ).toBeNull();
    expect(await shown(previews({ type: "Hero", label: "Hero", category: "Heroes" }))).toBeNull();
  });
});
