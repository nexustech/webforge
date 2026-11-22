import { describe, expect, it, vi } from "vitest";
import {
  type CaptureWindow,
  createPageCapture,
  MAX_IMAGE_HEIGHT,
  mayCaptureLoad,
  WINDOW_HEIGHT,
} from "./page-capture.js";

/** A window whose page is `height` tall, recording what it was asked, in order. */
function windowOf(height: number, options: { readonly hang?: boolean } = {}) {
  const asked: string[] = [];
  const params = new Map<string, unknown>();
  const window = {
    destroyed: false,
    webContents: {
      debugger: {
        attach: vi.fn(() => {
          asked.push("attach");
        }),
        detach: vi.fn(() => {
          asked.push("detach");
        }),
        sendCommand: vi.fn(async (method: string, sent?: object) => {
          asked.push(method);
          params.set(method, sent);
          if (method === "Runtime.evaluate") return { result: { value: height } };
          if (method === "Page.captureScreenshot") {
            return { data: Buffer.from([137, 80, 78, 71]).toString("base64") };
          }
          return {};
        }),
      },
      loadURL: vi.fn(async (_url: string) => {
        asked.push("load");
        if (options.hang === true) await new Promise(() => undefined);
      }),
      printToPDF: vi.fn(async () => {
        asked.push("print");
        return Buffer.from("%PDF-1.7");
      }),
    },
    destroy: vi.fn(() => {
      window.destroyed = true;
      asked.push("destroy");
    }),
    isDestroyed: () => window.destroyed,
  };
  return { window, asked, params };
}

describe("createPageCapture (5.22)", () => {
  it("draws the whole page at the device width, with none of the site's scripts run", async () => {
    const { window, asked, params } = windowOf(3200);
    const create = vi.fn(() => window as unknown as CaptureWindow);

    const drawn = await createPageCapture(create)("http://127.0.0.1:5001/x/index.html", 375, "png");

    // Its window loads from the page's own origin only.
    expect(create).toHaveBeenCalledWith(375, WINDOW_HEIGHT, "http://127.0.0.1:5001");
    expect(Buffer.from(drawn.data).subarray(1, 4).toString()).toBe("PNG");
    expect(drawn.cut).toBe(false);
    // An empty page first, which the debugger needs; scripts off and motion reduced before the
    // page loads; the window gone once it's drawn.
    expect(window.webContents.loadURL.mock.calls.map(([url]) => url)).toEqual([
      "about:blank",
      "http://127.0.0.1:5001/x/index.html",
    ]);
    expect(asked.indexOf("attach")).toBeGreaterThan(asked.indexOf("load"));
    expect(asked.indexOf("Emulation.setScriptExecutionDisabled")).toBeLessThan(
      asked.lastIndexOf("load"),
    );
    expect(asked.indexOf("Emulation.setEmulatedMedia")).toBeLessThan(asked.lastIndexOf("load"));
    expect(params.get("Emulation.setDeviceMetricsOverride")).toMatchObject({
      width: 375,
      deviceScaleFactor: 1,
    });
    expect(params.get("Page.captureScreenshot")).toEqual({
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: 375, height: 3200, scale: 1 },
    });
    expect(asked.slice(-2)).toEqual(["detach", "destroy"]);
  });

  it("stops a picture short of a page longer than one can hold, and says so", async () => {
    const { window, params } = windowOf(MAX_IMAGE_HEIGHT + 500);
    const drawn = await createPageCapture(() => window as unknown as CaptureWindow)(
      "http://x/",
      1280,
      "png",
    );
    expect(drawn.cut).toBe(true);
    expect(params.get("Page.captureScreenshot")).toMatchObject({
      clip: { height: MAX_IMAGE_HEIGHT },
    });
  });

  it("prints a PDF as wide as the device, with its backgrounds and no margins", async () => {
    const { window } = windowOf(1920);
    const drawn = await createPageCapture(() => window as unknown as CaptureWindow)(
      "http://x/",
      768,
      "pdf",
    );
    expect(Buffer.from(drawn.data).toString()).toBe("%PDF-1.7");
    expect(window.webContents.printToPDF).toHaveBeenCalledWith({
      printBackground: true,
      pageSize: { width: 8, height: 20 },
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });
  });

  it("closes the window when the page fails, or takes too long", async () => {
    const failing = windowOf(100);
    failing.window.webContents.loadURL.mockRejectedValueOnce(new Error("ERR_CONNECTION_REFUSED"));
    await expect(
      createPageCapture(() => failing.window as unknown as CaptureWindow)("http://x/", 375, "png"),
    ).rejects.toThrow("ERR_CONNECTION_REFUSED");
    expect(failing.window.destroy).toHaveBeenCalledOnce();

    const hanging = windowOf(100, { hang: true });
    await expect(
      createPageCapture(() => hanging.window as unknown as CaptureWindow, 10)(
        "http://x/",
        375,
        "pdf",
      ),
    ).rejects.toThrow("too long");
    expect(hanging.window.destroy).toHaveBeenCalledOnce();
  });
});

describe("mayCaptureLoad (5.22)", () => {
  it("loads from the preview server's own origin, and what a page makes, nothing else", () => {
    const origin = "http://127.0.0.1:5001";
    for (const url of [
      "http://127.0.0.1:5001/0123/__webforge/capture/index.html",
      "about:blank",
      "data:image/png;base64,AA==",
      "blob:http://127.0.0.1:5001/3f2a",
    ]) {
      expect(mayCaptureLoad(url, origin)).toBe(true);
    }
    for (const url of [
      "https://cdn.example.com/script.js",
      // Another server on this computer: a site's code can't reach it through a picture.
      "http://127.0.0.1:8080/admin/delete",
      "blob:http://127.0.0.1:8080/3f2a",
      "http://192.168.1.23:5002/x/index.html",
      "http://localhost:5001/x/",
      "file:///C:/Users/sam/secret.txt",
      "webforge-app://editor/index.html",
      "not a url",
    ]) {
      expect(mayCaptureLoad(url, origin)).toBe(false);
    }
  });
});
