import type { IpcMain, IpcMainInvokeEvent } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BundleFetch, BundleNetwork } from "./bundle-download.js";
import { registerBundleHandlers } from "./bundle-ipc.js";
import { setLogSink } from "./log.js";
import type { ProjectSession, StoreBlobsResult } from "./project-session.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const APP_URL = "file:///app/index.html";
const SESSION = "9b2f6c1e-4d3a-4f7b-8e21-5c6d7a8b9c0d";
const WIDGET = "https://cdn.example.com/widget.js?key=secret123";

function setUp(fetch: BundleFetch, stored: StoreBlobsResult = { status: "stored", hashes: [] }) {
  const handlers = new Map<string, Handler>();
  const ipc = {
    handle: (channel: string, handler: Handler) => handlers.set(channel, handler),
  } as unknown as Pick<IpcMain, "handle">;
  const site = {
    storeBlobs: vi.fn(async (files: readonly unknown[]) =>
      stored.status === "stored"
        ? { status: "stored" as const, hashes: files.map((_, index) => `${index}`.repeat(64)) }
        : stored,
    ),
  };
  const session = {
    staleReason: vi.fn((sessionId: string) =>
      sessionId === SESSION ? undefined : "stale-session",
    ),
    forSession: vi.fn(() => site),
  } as unknown as Pick<ProjectSession, "staleReason" | "forSession">;
  const network: BundleNetwork = { fetch, resolve: async () => ["93.184.215.14"] };
  registerBundleHandlers(ipc, (url) => url === APP_URL, session, network);
  const bundle = (sessionId: string, url: string) =>
    handlers.get("site:bundle-file")?.(
      { senderFrame: { url: APP_URL } } as IpcMainInvokeEvent,
      sessionId,
      url,
    );
  return { bundle, site };
}

const script: BundleFetch = async () =>
  new Response("window.widget = 1;", { headers: { "content-type": "text/javascript" } });

afterEach(() => setLogSink());

describe("registerBundleHandlers (3.9)", () => {
  it("downloads the file and stores it in the site, answering what to keep", async () => {
    const { bundle, site } = setUp(script);

    const result = await bundle(SESSION, WIDGET);

    expect(site.storeBlobs).toHaveBeenCalledOnce();
    expect(result).toEqual({
      status: "bundled",
      files: [
        {
          url: WIDGET,
          file: expect.stringMatching(/^widget-[0-9a-f]{8}\.js$/),
          hash: "0".repeat(64),
          mime: "text/javascript",
        },
      ],
    });
  });

  it("downloads nothing for a site that's no longer the open one", async () => {
    const fetch = vi.fn(script);
    const { bundle } = setUp(fetch);

    expect(await bundle("00000000-0000-0000-0000-000000000000", WIDGET)).toEqual({
      status: "failed",
      reason: "stale-session",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("logs a failed download's host and reason, never its address", async () => {
    const lines: string[] = [];
    setLogSink((_level, line) => lines.push(line));
    const { bundle, site } = setUp(async () => new Response("gone", { status: 404 }));

    expect(await bundle(SESSION, WIDGET)).toEqual({ status: "failed", reason: "not-found" });
    expect(site.storeBlobs).not.toHaveBeenCalled();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("host=cdn.example.com");
    expect(lines[0]).toContain("reason=not-found");
    expect(lines[0]).not.toContain("secret123");
  });

  it("says why the site couldn't keep the file", async () => {
    const { bundle } = setUp(script, { status: "failed", reason: "read-only" });

    expect(await bundle(SESSION, WIDGET)).toEqual({ status: "failed", reason: "read-only" });
  });
});
