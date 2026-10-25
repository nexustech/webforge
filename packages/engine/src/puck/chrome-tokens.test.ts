// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { applyChromeStyles, chromeTokens } from "./chrome.js";

// The canvas chrome in the editor's colours (R8): its theme's tokens, not colours of its own.

const tokensStyle = () =>
  document.head.querySelector("style[data-webforge-chrome-tokens]")?.textContent ?? "";

describe("the chrome's colours (R8)", () => {
  afterEach(() => {
    document.head.replaceChildren();
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-theme");
  });

  it("takes the editor's tokens, and the light theme's colours where it has none", () => {
    document.documentElement.style.setProperty("--primary", "#1d6fd0");

    expect(chromeTokens(document)).toEqual({
      primary: "#1d6fd0",
      primaryForeground: "#ffffff",
      grid: "#f028f3",
    });
  });

  it("gives the canvas the editor's colours, again when the editor's theme switches", async () => {
    document.documentElement.style.setProperty("--primary", "#0a6fb7");
    const stop = applyChromeStyles(document, document);
    expect(tokensStyle()).toContain("--wf-primary: #0a6fb7;");
    // Hover and selection outlines are the accent too (LF-1).
    expect(tokensStyle()).toContain("--wf-outline-color: #0a6fb7;");

    document.documentElement.style.setProperty("--primary", "#1d6fd0");
    document.documentElement.setAttribute("data-theme", "dark");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(tokensStyle()).toContain("--wf-primary: #1d6fd0;");
    stop();
    expect(document.head.querySelectorAll("style[data-webforge-chrome-tokens]")).toHaveLength(1);
  });
});
