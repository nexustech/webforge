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

/** A joined Header `height` px tall, added to the canvas's document. */
function addHeader(height: number): HTMLElement {
  const header = document.createElement("header");
  header.setAttribute("data-wf-joined", "");
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
});
