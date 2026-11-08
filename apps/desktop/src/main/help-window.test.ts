import type { BrowserWindowConstructorOptions } from "electron";
import { describe, expect, it, vi } from "vitest";
import {
  createHelpWindows,
  type HelpBrowserWindow,
  helpPageAddress,
  isHelpPageUrl,
} from "./help-window.js";

const PAGE = "webforge-app://editor/help.html";

/** A window as the Help window uses one, recording what's done to it. */
function fakeWindow() {
  const handlers = new Map<string, ((...args: unknown[]) => void)[]>();
  const contentsHandlers = new Map<string, ((...args: unknown[]) => void)[]>();
  const add = (map: typeof handlers, name: string, handler: (...args: unknown[]) => void) =>
    map.set(name, [...(map.get(name) ?? []), handler]);
  let destroyed = false;
  let minimized = false;
  let loading = false;
  let openHandler: (() => { action: string }) | undefined;
  const window = {
    show: vi.fn(),
    focus: vi.fn(),
    restore: vi.fn(() => {
      minimized = false;
    }),
    isMinimized: () => minimized,
    isDestroyed: () => destroyed,
    close: vi.fn(() => {
      destroyed = true;
      for (const handler of handlers.get("closed") ?? []) handler();
    }),
    once: vi.fn((name: string, handler: (...args: unknown[]) => void) =>
      add(handlers, name, handler),
    ),
    on: vi.fn((name: string, handler: (...args: unknown[]) => void) =>
      add(handlers, name, handler),
    ),
    loadURL: vi.fn(async (_url: string) => undefined),
    setBackgroundColor: vi.fn(),
    webContents: {
      send: vi.fn(),
      isLoading: () => loading,
      setWindowOpenHandler: vi.fn((handler: () => { action: string }) => {
        openHandler = handler;
      }),
      on: vi.fn((name: string, handler: (...args: unknown[]) => void) =>
        add(contentsHandlers, name, handler),
      ),
    },
  };
  return {
    window: window as unknown as HelpBrowserWindow,
    raw: window,
    emit: (name: string) => {
      for (const handler of handlers.get(name) ?? []) handler();
    },
    /** Whether the page may navigate to `url`, as the Help window decides. */
    mayNavigate: (url: string) => {
      const event = { preventDefault: vi.fn() };
      for (const handler of contentsHandlers.get("will-navigate") ?? []) handler(event, url);
      return event.preventDefault.mock.calls.length === 0;
    },
    opensPopUp: () => openHandler?.().action !== "deny",
    minimize: () => {
      minimized = true;
    },
    setLoading: (now: boolean) => {
      loading = now;
    },
  };
}

function setUp(theme: "dark" | "light" = "dark") {
  const made: ReturnType<typeof fakeWindow>[] = [];
  const options: BrowserWindowConstructorOptions[] = [];
  const help = createHelpWindows({
    create: (given) => {
      options.push(given);
      const fake = fakeWindow();
      made.push(fake);
      return fake.window;
    },
    pageUrl: PAGE,
    preload: "/app/out/preload/help.cjs",
    title: "Webforge Help",
    theme: () => theme,
    background: (look) => (look === "dark" ? "#111111" : "#ffffff"),
    onLoadFailed: vi.fn(),
  });
  return { help, made, options };
}

describe("the Help window (5.4b, HP-10)", () => {
  it("opens one window, secured as the editor's, at the page and heading asked for", () => {
    const { help, made, options } = setUp("light");
    help.open({ page: "site-check", anchor: "tips" });

    expect(made).toHaveLength(1);
    expect(options[0]).toMatchObject({
      title: "Webforge Help",
      backgroundColor: "#ffffff",
      show: false,
      webPreferences: {
        preload: "/app/out/preload/help.cjs",
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    const [window] = made;
    expect(window?.raw.loadURL).toHaveBeenCalledWith(
      `${PAGE}?page=site-check&anchor=tips&theme=light`,
    );
    // Shown once ready, with the focus: the person asked for it.
    expect(window?.raw.show).not.toHaveBeenCalled();
    window?.emit("ready-to-show");
    expect(window?.raw.show).toHaveBeenCalled();
    expect(window?.raw.focus).toHaveBeenCalled();
    expect(help.is(window?.window)).toBe(true);
    expect(help.is({})).toBe(false);
  });

  it("moves the open window to another page and brings it to the front, rather than opening another", () => {
    const { help, made } = setUp();
    help.open({});
    const [window] = made;
    window?.minimize();

    help.open({ page: "publish" });

    expect(made).toHaveLength(1);
    expect(window?.raw.webContents.send).toHaveBeenCalledWith("help:show", { page: "publish" });
    expect(window?.raw.restore).toHaveBeenCalled();
    expect(window?.raw.show).toHaveBeenCalled();
    expect(window?.raw.focus).toHaveBeenCalled();
  });

  it("loads the page again at the new place while it's still loading, as it would miss the message", () => {
    const { help, made } = setUp();
    help.open({});
    const [window] = made;
    window?.setLoading(true);

    help.open({ page: "export", anchor: "options" });

    expect(window?.raw.webContents.send).not.toHaveBeenCalled();
    expect(window?.raw.loadURL).toHaveBeenLastCalledWith(
      `${PAGE}?page=export&anchor=options&theme=dark`,
    );
  });

  it("closes with the editor, and opens a new one after", () => {
    const { help, made } = setUp();
    help.close();
    help.open({});
    help.close();
    expect(made[0]?.raw.close).toHaveBeenCalled();
    expect(help.is(made[0]?.window)).toBe(false);

    help.open({ page: "export" });
    expect(made).toHaveLength(2);
  });

  it("follows the editor's look while it's open", () => {
    const { help, made } = setUp();
    help.setTheme("light");
    help.open({});
    help.setTheme("light");
    expect(made[0]?.raw.setBackgroundColor).toHaveBeenCalledWith("#ffffff");
    expect(made[0]?.raw.webContents.send).toHaveBeenCalledWith("help:theme", "light");
  });

  it("stays on its own page: no pop-ups, and no going to another page, the editor's included", () => {
    const { help, made } = setUp();
    help.open({});
    const [window] = made;
    expect(window?.opensPopUp()).toBe(false);
    expect(window?.mayNavigate(`${PAGE}?page=export`)).toBe(true);
    expect(window?.mayNavigate("webforge-app://editor/index.html")).toBe(false);
    expect(window?.mayNavigate("https://www.example.org/")).toBe(false);
  });
});

describe("isHelpPageUrl", () => {
  it("tells the Help page from the editor's, in the app and on the dev server alike", () => {
    expect(isHelpPageUrl(`${PAGE}?page=export#x`, PAGE)).toBe(true);
    expect(isHelpPageUrl("webforge-app://editor/index.html", PAGE)).toBe(false);
    // Another host or scheme, whose origin Node calls "null" too, and a file (S33).
    expect(isHelpPageUrl("webforge-app://attacker.example/help.html", PAGE)).toBe(false);
    expect(isHelpPageUrl("evil://editor/help.html", PAGE)).toBe(false);
    expect(isHelpPageUrl("file:///app/out/renderer/help.html", PAGE)).toBe(false);
    const file = "file:///app/out/renderer/help.html";
    expect(isHelpPageUrl("file://attacker.example/app/out/renderer/help.html", file)).toBe(false);
    const dev = "http://localhost:5173/help.html";
    expect(isHelpPageUrl("http://localhost:5173/help.html?page=x", dev)).toBe(true);
    expect(isHelpPageUrl("http://localhost:5173/", dev)).toBe(false);
    expect(isHelpPageUrl("http://localhost:5174/help.html", dev)).toBe(false);
    expect(isHelpPageUrl("not a url", dev)).toBe(false);
  });

  it("gives the page's address with where to start and the look", () => {
    expect(helpPageAddress(PAGE, {}, "dark")).toBe(`${PAGE}?theme=dark`);
  });
});
