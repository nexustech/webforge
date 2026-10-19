import type { Session, WebContents } from "electron";
import { describe, expect, it, vi } from "vitest";
import {
  createSecureWebPreferences,
  hardenSession,
  hardenWebContents,
  isAppUrl,
} from "./security.js";

describe("createSecureWebPreferences", () => {
  it("isolates and sandboxes the renderer", () => {
    const prefs = createSecureWebPreferences("/app/preload/index.cjs");

    expect(prefs).toMatchObject({
      preload: "/app/preload/index.cjs",
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
    });
  });
});

describe("isAppUrl", () => {
  it("accepts the dev server origin and rejects other origins", () => {
    const appUrl = "http://localhost:5173/";

    expect(isAppUrl("http://localhost:5173/index.html", appUrl)).toBe(true);
    expect(isAppUrl("http://localhost:5174/", appUrl)).toBe(false);
    expect(isAppUrl("https://example.com/", appUrl)).toBe(false);
  });

  it("accepts only the app's own file in production", () => {
    const appUrl = "file:///C:/Program%20Files/Webforge/resources/app.asar/out/renderer/index.html";

    expect(isAppUrl(`${appUrl}#/pages`, appUrl)).toBe(true);
    expect(isAppUrl("file:///C:/Users/sam/evil.html", appUrl)).toBe(false);
    expect(isAppUrl("https://example.com/", appUrl)).toBe(false);
  });

  it("rejects malformed URLs", () => {
    expect(isAppUrl("not a url", "http://localhost:5173/")).toBe(false);
  });
});

type FakeEvent = { preventDefault: () => void };
type Listener = (event: FakeEvent, url: string) => void;

function fakeWebContents() {
  const listeners = new Map<string, Listener>();
  const setWindowOpenHandler = vi.fn();
  const contents = {
    setWindowOpenHandler,
    on: (name: string, listener: Listener) => {
      listeners.set(name, listener);
      return contents;
    },
  };
  const emit = (name: string, url = "") => {
    const event = { preventDefault: vi.fn() };
    listeners.get(name)?.(event, url);
    return event;
  };
  return { contents: contents as unknown as WebContents, setWindowOpenHandler, emit };
}

describe("hardenWebContents", () => {
  const appUrl = "http://localhost:5173/";

  it("denies every new window", () => {
    const { contents, setWindowOpenHandler } = fakeWebContents();

    hardenWebContents(contents, appUrl);

    const handler = setWindowOpenHandler.mock.calls[0]?.[0] as () => unknown;
    expect(handler()).toEqual({ action: "deny" });
  });

  it("blocks navigation away from the app but allows reloads of the app", () => {
    const { contents, emit } = fakeWebContents();

    hardenWebContents(contents, appUrl);

    expect(emit("will-navigate", "https://example.com/").preventDefault).toHaveBeenCalled();
    expect(emit("will-navigate", "http://localhost:5173/").preventDefault).not.toHaveBeenCalled();
  });

  it("blocks webview tags", () => {
    const { contents, emit } = fakeWebContents();

    hardenWebContents(contents, appUrl);

    expect(emit("will-attach-webview").preventDefault).toHaveBeenCalled();
  });
});

describe("hardenSession", () => {
  it("denies every permission request and check", () => {
    const setPermissionRequestHandler = vi.fn();
    const setPermissionCheckHandler = vi.fn();
    const session = {
      setPermissionRequestHandler,
      setPermissionCheckHandler,
    } as unknown as Session;

    hardenSession(session);

    const requestHandler = setPermissionRequestHandler.mock.calls[0]?.[0] as (
      contents: unknown,
      permission: string,
      callback: (granted: boolean) => void,
    ) => void;
    const callback = vi.fn();
    requestHandler(null, "media", callback);
    expect(callback).toHaveBeenCalledWith(false);

    const checkHandler = setPermissionCheckHandler.mock.calls[0]?.[0] as () => boolean;
    expect(checkHandler()).toBe(false);
  });
});
