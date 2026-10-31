// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createFakeEngine,
  type FakeEngine,
  scaledTestTimeout,
} from "@webforge/test-utils/renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiApi, AiRequest, AiResponse } from "../shared/ipc/ai.js";
import { applyPreferencesChange, DEFAULT_PREFERENCES } from "../shared/ipc/prefs.js";
import type { ExportRequest } from "../shared/ipc/site.js";
import type {
  ExportResult,
  PreferencesChange,
  SiteUiChange,
  UiStateResult,
} from "../shared/ipc-contract.js";
import { App, type AppProps } from "./App.js";
import { fakePreloadApi } from "./testing/preload.js";

// Each test renders the whole window (title bar, panels, Radix menus); on a busy machine that can
// take longer than Vitest's default 5 s.
vi.setConfig({ testTimeout: scaledTestTimeout(20_000) });

afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.theme;
});

const compileCss = vi.fn(async () => ({ status: "failed" as const }));

const savePreferences = vi.fn(async (change: PreferencesChange) =>
  applyPreferencesChange(DEFAULT_PREFERENCES, change),
);

const saveUiState = vi.fn(
  async (_change: SiteUiChange): Promise<UiStateResult> => ({ status: "saved" }),
);

const setSpellCheckLanguage = vi.fn(async () => null);

/** What main forwards AI apps' requests to: the window's answer while it listens. */
const ai = { answer: undefined as ((request: AiRequest) => Promise<AiResponse>) | undefined };
const answerAi = vi.fn<AiApi["onRequest"]>((answer) => {
  ai.answer = answer;
  return () => {
    ai.answer = undefined;
  };
});

/** The site's last export choices: a folder, asking for the web address. */
const exportChoices = vi.fn(
  async () =>
    ({ format: "folder", minify: false, developerFiles: false, askWebAddress: true }) as const,
);

/** The window with main's calls faked (#668): `exportSite` is main's export. */
function renderApp(
  exportSite = vi.fn(
    async (_request: ExportRequest): Promise<ExportResult> => ({
      status: "canceled",
    }),
  ),
  extra: Partial<AppProps> = {},
) {
  const api = fakePreloadApi({
    prefs: { set: savePreferences },
    project: { setUiState: (_session, change) => saveUiState(change) },
    app: { setSpellCheckLanguage },
    ai: { onRequest: answerAi },
    canvas: { compileCss },
    site: { export: exportSite, exportChoices },
  });
  render(
    <App
      api={api}
      info={{ name: "Webforge", version: "1.2.0" }}
      preferences={DEFAULT_PREFERENCES}
      createEngine={createFakeEngine}
      {...extra}
    />,
  );
  return exportSite;
}

describe("App", () => {
  it("shows the title bar with the site's name over the editor", () => {
    renderApp();

    expect(screen.getByRole("heading", { level: 1, name: "Webforge" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Search commands/ }).textContent).toContain(
      "My site",
    );
    expect(screen.getByRole("main")).toBeTruthy();
  });

  it("spell checks in the site's language (F-ED-19)", () => {
    setSpellCheckLanguage.mockClear();
    renderApp();

    expect(setSpellCheckLanguage).toHaveBeenCalledWith("en");
  });

  it("exports the site from the title bar, asking first, and says where it went (3.3)", async () => {
    const exportSite = renderApp(
      vi.fn(
        async (_request: ExportRequest): Promise<ExportResult> => ({
          status: "exported",
          format: "folder",
          name: "my-site",
          pages: 1,
          files: 6,
          bytes: 24_000,
          warnings: [],
          warningCount: 0,
        }),
      ),
    );

    await userEvent.click(screen.getByRole("button", { name: "Export Site…" }));
    // The starter site has no web address yet (X3).
    await userEvent.click(await screen.findByRole("button", { name: "Export without it" }));
    await userEvent.click(await screen.findByRole("button", { name: "Export…" }));

    expect(exportSite).toHaveBeenCalledWith({
      snapshot: expect.objectContaining({ pages: expect.any(Array), media: [] }),
      media: [],
      documents: [],
      choices: { format: "folder", minify: false, developerFiles: false, askWebAddress: true },
      output: { minify: false, developerFiles: false },
    });
    const report = await screen.findByRole("dialog", { name: "Site exported" });
    expect(report.textContent).toContain("Saved in the folder “my-site”.");
  });

  it("runs commands from their shortcuts", async () => {
    renderApp();

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true, metaKey: false, cancelable: true }),
      );
    });

    expect(await screen.findByRole("combobox")).toBeTruthy();
  });
});

describe("App's AI apps (4.8)", () => {
  it("answers AI apps while the site is open: each change an undo step, D7 asked in the window", async () => {
    renderApp();
    const ask = (request: AiRequest) => {
      if (ai.answer === undefined) throw new Error("not listening");
      return act(() => ai.answer?.(request) ?? Promise.reject(new Error("not listening")));
    };

    const outline = await ask({ kind: "query", name: "outline", input: {} });
    expect(outline).toMatchObject({ status: "done", data: { name: "My site" } });
    const pages = (outline as { data: { pages: { id: string }[] } }).data.pages;
    const added = await ask({
      kind: "command",
      name: "addNode",
      input: { location: { kind: "page", pageId: pages[0]?.id }, type: "Hero" },
      app: "Claude",
    });
    expect(added).toMatchObject({ status: "done", label: "AI (Claude): Added Hero" });
    const left = screen.getByRole("region", { name: "Left panels" });
    await userEvent.click(within(left).getByRole("tab", { name: "Undo History" }));
    expect(within(left).getByText("AI (Claude): Added Hero")).toBeTruthy();

    // A change to every page waits for the person, in the window's site-wide question (D7).
    const theme = ask({
      kind: "command",
      name: "setThemeTokens",
      input: { tokens: { spacing: "roomy" } },
      app: "Claude",
    });
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Allow Claude to change the theme?")).toBeTruthy();
    // Radix keeps pointer events off the page under the dialog, which happy-dom applies to it too.
    await act(async () => within(dialog).getByRole("button", { name: "Allow" }).click());
    expect(await theme).toMatchObject({ status: "done", label: "AI (Claude): Changed the theme" });

    cleanup();
    expect(ai.answer).toBeUndefined();
  });
});

describe("App's window layout", () => {
  it("puts the Add panel, then the editor's Undo History, in the left column", async () => {
    renderApp();

    const left = screen.getByRole("region", { name: "Left panels" });
    expect(
      within(left).getByRole("searchbox", { name: "Search sections and elements" }),
    ).toBeTruthy();
    await userEvent.click(within(left).getByRole("tab", { name: "Undo History" }));
    expect(within(left).getByText("Opened page")).toBeTruthy();
  });

  it("switches the theme from the View menu, and saves it", async () => {
    renderApp();
    expect(document.documentElement.dataset.theme).toBe("dark");

    await userEvent.click(screen.getByRole("menuitem", { name: "View" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Use Light Appearance" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(savePreferences).toHaveBeenCalledWith({ theme: "light" });
  });

  it("has title-bar buttons for the panels", () => {
    renderApp();

    for (const name of [
      "Show or Hide Left Panels",
      "Show or Hide Bottom Panel",
      "Show or Hide Right Panels",
    ]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });
});

describe("App's modes (1.10)", () => {
  it("switches between Design and Content without a reload, and remembers it with the site", async () => {
    const engines: FakeEngine[] = [];
    const createEngine = () => {
      const engine = createFakeEngine();
      engines.push(engine);
      return engine;
    };
    renderApp(undefined, { createEngine });
    const content = screen.getByRole("radio", { name: "Content" });
    expect(content.closest('[aria-label="Editing mode"]')).not.toBeNull();
    expect(screen.getByRole("radio", { name: "Design" }).getAttribute("data-state")).toBe("on");

    await userEvent.click(content);

    expect(engines.at(-1)?.setMode).toHaveBeenLastCalledWith("content");
    expect(saveUiState).toHaveBeenCalledWith({ editorMode: "content" });
    expect(engines).toHaveLength(1);
    // Clicking the chosen mode again keeps it.
    await userEvent.click(screen.getByRole("radio", { name: "Content" }));
    expect(engines.at(-1)?.setMode).toHaveBeenLastCalledWith("content");
  });

  it("opens in the mode remembered with the site, and switches back from the View menu", async () => {
    const engines: FakeEngine[] = [];
    renderApp(undefined, {
      uiState: { editorMode: "content" },
      createEngine: () => {
        const engine = createFakeEngine();
        engines.push(engine);
        return engine;
      },
    });
    expect(engines.at(-1)?.setMode).toHaveBeenLastCalledWith("content");

    await userEvent.click(screen.getByRole("menuitem", { name: "View" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Switch to Design Mode" }));

    expect(engines.at(-1)?.setMode).toHaveBeenLastCalledWith("design");
    expect(saveUiState).toHaveBeenLastCalledWith({ editorMode: "design" });
  });

  it("turns Advanced mode on per person from the View menu", async () => {
    renderApp();

    await userEvent.click(screen.getByRole("menuitem", { name: "View" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Use Advanced Mode" }));

    expect(savePreferences).toHaveBeenCalledWith({ editorLevel: "advanced" });
    await userEvent.click(screen.getByRole("menuitem", { name: "View" }));
    expect(screen.getByRole("menuitem", { name: "Use Simple Mode" })).toBeTruthy();
  });
});
