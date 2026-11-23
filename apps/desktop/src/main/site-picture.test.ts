import type { IpcMain, IpcMainInvokeEvent, NativeImage } from "electron";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSitePicture,
  DRAW_TIMEOUT_MS,
  type PicturedWindow,
  SITE_PICTURE_SELECTOR,
  WHILE_ONE_COLOUR,
} from "./site-picture.js";

type Handler = (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;

const APP_URL = "file:///app/index.html";

/** The renderer's answer to a draw request, as the preload sends it. */
type Answer = (id: number, drawn: boolean, senderUrl?: string) => void;

function setUp(renderer: (id: number, answer: Answer) => void, crashed = false) {
  const handlers = new Map<string, Handler>();
  const ipc = {
    handle: (channel: string, handler: Handler) => handlers.set(channel, handler),
  } as unknown as Pick<IpcMain, "handle">;
  const pictures = createSitePicture(ipc, (url) => url === APP_URL);
  // A sender other than the app is refused (the handler rejects), and nothing is answered.
  const answer: Answer = (id, drawn, senderUrl = APP_URL) =>
    void handlers
      .get("project:site-picture-drawn")?.(
        { senderFrame: { url: senderUrl } } as unknown as IpcMainInvokeEvent,
        id,
        drawn,
      )
      .catch(() => undefined);
  const sent: unknown[][] = [];
  const jpeg = new Uint8Array([0xff, 0xd8]);
  // The home page drawn: more than one colour, unless a test says otherwise.
  const bitmaps: Buffer[] = [];
  const bitmap = () => bitmaps.shift() ?? Buffer.from([255, 255, 255, 255, 0, 0, 0, 255]);
  const image = {
    isEmpty: () => false,
    resize: () => ({ toJPEG: () => jpeg, toBitmap: () => bitmap() }),
  } as unknown as NativeImage;
  const executeJavaScript = vi.fn(async (_code: string) => ({
    x: 0,
    y: 0,
    width: 960,
    height: 600,
  }));
  const capturePage = vi.fn(async () => image);
  const window: PicturedWindow = {
    isDestroyed: () => false,
    webContents: {
      isCrashed: () => crashed,
      executeJavaScript,
      capturePage,
      send: (...args: unknown[]) => {
        sent.push(args);
        const [, id, step] = args;
        if (step === "draw" && typeof id === "number") renderer(id, answer);
      },
    } as unknown as PicturedWindow["webContents"],
  };
  return { pictures, window, sent, jpeg, capturePage, executeJavaScript, bitmaps };
}

describe("createSitePicture (#1175)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks the renderer to draw the home page, captures that, then has it taken away", async () => {
    const { pictures, window, sent, jpeg, capturePage, executeJavaScript } = setUp((id, answer) =>
      answer(id, true),
    );

    expect(await pictures.capture(window)).toBe(jpeg);
    expect(executeJavaScript.mock.calls[0]?.[0]).toContain(JSON.stringify(SITE_PICTURE_SELECTOR));
    expect(capturePage).toHaveBeenCalledWith({ x: 0, y: 0, width: 960, height: 600 });
    expect(sent).toEqual([
      ["app:site-picture", 1, "draw"],
      ["app:site-picture", 1, "done"],
    ]);
  });

  it("waits for a large home page: its CSS compiled, then its fonts and pictures for 1.5 s", async () => {
    const { pictures, window, jpeg } = setUp((id, answer) => {
      setTimeout(() => answer(id, true), 3_500);
    });
    const taken = pictures.capture(window);
    await vi.advanceTimersByTimeAsync(3_500);
    expect(await taken).toBe(jpeg);
    // Room to spare: the budget is more than the 1.5 s the renderer waits for what loads.
    expect(DRAW_TIMEOUT_MS).toBeGreaterThanOrEqual(3_500);
  });

  it("takes the picture again while the window still shows the stage's white box (#1323)", async () => {
    const { pictures, window, sent, jpeg, capturePage, bitmaps } = setUp((id, answer) =>
      answer(id, true),
    );
    const white = Buffer.from([255, 255, 255, 255, 255, 255, 255, 255]);
    bitmaps.push(white, white);

    const taken = pictures.capture(window);
    await vi.advanceTimersByTimeAsync(2 * WHILE_ONE_COLOUR.everyMs);
    expect(await taken).toBe(jpeg);
    expect(capturePage).toHaveBeenCalledTimes(3);
    // The drawing stays until the last picture is taken.
    expect(sent.at(-1)).toEqual(["app:site-picture", 1, "done"]);
    // Half a second at most, well within the 8 s the renderer keeps its drawing for.
    expect(WHILE_ONE_COLOUR.retries * WHILE_ONE_COLOUR.everyMs).toBeLessThanOrEqual(500);
  });

  it("takes no picture when the renderer can't draw the page, and still has it tidy up", async () => {
    const { pictures, window, sent, capturePage } = setUp((id, answer) => answer(id, false));

    expect(await pictures.capture(window)).toBeUndefined();
    expect(capturePage).not.toHaveBeenCalled();
    expect(sent.at(-1)).toEqual(["app:site-picture", 1, "done"]);
  });

  it("gives up on a renderer that doesn't answer in time, or answers from elsewhere", async () => {
    const silent = setUp(() => undefined);
    const taken = silent.pictures.capture(silent.window);
    await vi.advanceTimersByTimeAsync(DRAW_TIMEOUT_MS);
    expect(await taken).toBeUndefined();
    expect(silent.capturePage).not.toHaveBeenCalled();

    const stranger = setUp((id, answer) => answer(id, true, "https://example.com/"));
    const late = stranger.pictures.capture(stranger.window);
    await vi.advanceTimersByTimeAsync(DRAW_TIMEOUT_MS);
    expect(await late).toBeUndefined();
  });

  it("asks nothing without a window or of a crashed renderer", async () => {
    const crashed = setUp((id, answer) => answer(id, true), true);
    expect(await crashed.pictures.capture(crashed.window)).toBeUndefined();
    expect(await crashed.pictures.capture(undefined)).toBeUndefined();
    expect(crashed.sent).toEqual([]);
  });
});
