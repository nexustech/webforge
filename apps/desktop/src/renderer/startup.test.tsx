// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import indexHtml from "./index.html?raw";
import themeScript from "./public/startup-theme.js?raw";
import { applyTheme, markFirstRender, StartFailed } from "./startup.js";

// The start-up screen (#887): index.html's markup, the classic script that sets its theme before
// the first paint, and what main.tsx shows instead of it when starting fails.

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
  delete document.documentElement.dataset.theme;
});

/** Runs public/startup-theme.js as the page would, at `search`, on a fresh `<html>`. */
function runThemeScript(search: string): string | undefined {
  const root = { dataset: {} as Record<string, string> };
  // Its own globals only: the page's `window` and `document`, as the script sees them.
  const run = new Function("window", "document", themeScript);
  run({ location: { search } }, { documentElement: root });
  return root.dataset.theme;
}

describe("startup-theme.js", () => {
  it("draws the page in the theme its address names, before any module loads", () => {
    expect(runThemeScript("?theme=light")).toBe("light");
    expect(runThemeScript("?theme=dark")).toBe("dark");
  });

  it("leaves index.html's own theme for an address without one, or with another value", () => {
    expect(runThemeScript("")).toBeUndefined();
    expect(runThemeScript("?theme=%22%3E")).toBeUndefined();
  });
});

describe("index.html's start-up screen", () => {
  const html = indexHtml;
  const root = html.slice(html.indexOf('<div id="root">'), html.indexOf("</body>"));

  it("is inside #root, which React's first render replaces", () => {
    expect(root).toContain('class="startup"');
  });

  it("sets the theme with a classic script in the head, before anything is drawn", () => {
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).toContain('<script src="/startup-theme.js"></script>');
  });

  it("has no hard-coded words, and no percentage: its progress is indeterminate", () => {
    expect(root).toContain("%WEBFORGE_APP_NAME%");
    expect(root).toContain("%WEBFORGE_STARTING%");
    expect(root).toMatch(/role="progressbar" aria-labelledby="startup-label"/);
    expect(root).not.toContain("aria-valuenow");
  });
});

describe("applyTheme", () => {
  it("sets the theme, and keeps it in the address for the next start-up screen", () => {
    window.history.replaceState(null, "", "/index.html?theme=dark");

    applyTheme("light", window);

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.location.search).toBe("?theme=light");
    expect(window.location.pathname).toBe("/index.html");
  });

  it("leaves the history alone when the address already has the theme", () => {
    window.history.replaceState(null, "", "/?theme=dark");
    const replace = vi.spyOn(window.history, "replaceState");

    applyTheme("dark", window);

    expect(replace).not.toHaveBeenCalled();
    replace.mockRestore();
  });
});

describe("StartFailed", () => {
  it("says what happened, and tries again", async () => {
    const onRetry = vi.fn();
    render(<StartFailed onRetry={onRetry} />);

    expect(screen.getByRole("alert").textContent).toContain(
      "Something went wrong starting Webforge. Your work is saved.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe("markFirstRender (#891)", () => {
  it("marks the first change to the root only: React's first render", async () => {
    performance.clearMarks();
    const root = document.createElement("div");
    root.innerHTML = '<div class="startup"></div>';
    markFirstRender(root);
    expect(performance.getEntriesByName("webforge:first-render")).toHaveLength(0);

    root.replaceChildren(document.createElement("main"));
    await Promise.resolve();
    root.append(document.createElement("aside"));
    await Promise.resolve();

    expect(performance.getEntriesByName("webforge:first-render")).toHaveLength(1);
  });
});
