// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { followJoinedHeight } from "./joined-height.js";

// The canvas gives a Header joined to its first section its real height (HH-1), as the exported
// site's script does.

/** The callbacks of every ResizeObserver made, to call as a resize would. */
const resized: (() => void)[] = [];

afterEach(() => {
  document.body.innerHTML = "";
  resized.length = 0;
  vi.unstubAllGlobals();
});

/**
 * A joined Header `height` px tall, added to the canvas's document; or one with its own band over a
 * first section filling the window (`data-wf-height`, HH-4).
 */
function addHeader(height: number, mark = "data-wf-joined"): HTMLElement {
  const header = document.createElement("header");
  header.setAttribute(mark, "");
  Object.defineProperty(header, "offsetHeight", { value: height, configurable: true });
  document.body.append(header);
  return header;
}

/** Lets the mutation observers report. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const height = () => document.documentElement.style.getPropertyValue("--wf-header-h");

describe("followJoinedHeight (HH-1)", () => {
  it("gives the page the joined Header's height, as it comes, changes and goes", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resized.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const stop = followJoinedHeight(document);
    expect(height()).toBe("");

    const header = addHeader(72);
    await settle();
    expect(height()).toBe("72px");

    Object.defineProperty(header, "offsetHeight", { value: 96, configurable: true });
    for (const callback of resized) callback();
    expect(height()).toBe("96px");

    header.remove();
    await settle();
    expect(height()).toBe("");

    addHeader(64);
    await settle();
    stop();
    expect(height()).toBe("");
  });

  it("follows a Header with its own band over a first section filling the window too (HH-4)", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const stop = followJoinedHeight(document);
    addHeader(64, "data-wf-height");
    await settle();
    expect(height()).toBe("64px");
    stop();
  });

  it("gives the page where a section filling the window starts, under a bar too (#1489)", async () => {
    const observed: Element[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resized.push(callback);
        }
        observe(target: Element) {
          observed.push(target);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    const above = () => document.documentElement.style.getPropertyValue("--wf-above-h");
    const stop = followJoinedHeight(document);
    expect(above()).toBe("");

    const bar = document.createElement("section");
    bar.setAttribute("data-wf-announcement", "");
    document.body.append(bar);
    addHeader(64, "data-wf-height");
    const hero = document.createElement("section");
    let top = 100;
    hero.getBoundingClientRect = () => new DOMRect(0, top, 960, 600);
    hero.setAttribute("data-wf-fills", "");
    document.body.append(hero);
    await settle();
    expect(above()).toBe("100px");
    // The bar is watched, so its change of size moves the section's start.
    expect(observed).toContain(bar);

    top = 64;
    for (const callback of resized) callback();
    expect(above()).toBe("64px");

    hero.remove();
    await settle();
    expect(above()).toBe("");
    hero.setAttribute("data-wf-fills", "");
    document.body.append(hero);
    await settle();
    stop();
    expect(above()).toBe("");
  });
});
