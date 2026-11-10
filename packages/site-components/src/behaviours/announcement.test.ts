import { Window } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BEHAVIOUR_SCRIPTS } from "../behaviours.js";
import { siteLibrary } from "../catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";

// The "announcement" behaviour (6.4) on the Announcement bar as the export writes it.

const windows: Window[] = [];
afterEach(async () => {
  vi.useRealTimers();
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

/** The bar's HTML with `props` over its defaults. */
const barHtml = (props: Record<string, unknown> = {}) =>
  renderNodesToHtml(
    [
      {
        type: "AnnouncementBar",
        props: { id: "news", ...siteLibrary.components.AnnouncementBar?.defaults, ...props },
      },
    ],
    siteLibrary,
    EDITOR_RENDER_CONTEXT,
  );

/**
 * A page with the bar and a link after it, `announcement.js` run on it, in a tab whose
 * sessionStorage is `storage` (a new one if not given), on `today` if given.
 */
function page(props: Record<string, unknown> = {}, storage?: Storage) {
  const happy = new Window();
  windows.push(happy);
  const window = happy as unknown as typeof globalThis;
  const { document } = window;
  if (storage !== undefined) {
    Object.defineProperty(window, "sessionStorage", { value: storage, configurable: true });
  }
  document.body.innerHTML = `${barHtml(props)}<a href="#main">Skip</a>`;
  new Function("document", "window", "HTMLElement", BEHAVIOUR_SCRIPTS.announcement ?? "")(
    document,
    window,
    window.HTMLElement,
  );
  const bar = document.querySelector<HTMLElement>("[data-wf-announcement]");
  const close = document.querySelector<HTMLElement>("[data-wf-announcement-close]");
  if (bar === null || close === null) throw new Error("No bar");
  return { window, document, bar, close };
}

describe("the announcement behaviour (6.4)", () => {
  it("shows the close button, which hides the bar and gives the page the focus", () => {
    const { document, bar, close } = page();
    expect(bar.hidden).toBe(false);
    expect(close.hidden).toBe(false);

    close.focus();
    close.click();

    expect(bar.hidden).toBe(true);
    expect(document.activeElement).toBe(document.body);
  });

  it("keeps it closed on the next page of the visit, until its text changes", () => {
    const first = page();
    first.close.click();
    const storage = first.window.sessionStorage;

    expect(page({}, storage).bar.hidden).toBe(true);
    expect(page({ text: "Open late on Friday" }, storage).bar.hidden).toBe(false);
  });

  it("hides the bar after its last day, in the visitor's time zone", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 11, 27, 9, 0));

    expect(page({ lastDay: "2026-12-26" }).bar.hidden).toBe(true);
    expect(page({ lastDay: "2026-12-27" }).bar.hidden).toBe(false);
    expect(page({ lastDay: "2027-01-02" }).bar.hidden).toBe(false);
  });

  it("still closes for this page in a browser that keeps nothing", () => {
    const refusing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    const { bar, close } = page({}, refusing);

    close.click();
    expect(bar.hidden).toBe(true);
  });
});
