import { Window } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BEHAVIOUR_SCRIPTS } from "../behaviours.js";

// The "form" behaviour (3.7, B6): a form sent in the page's first seconds is held, then sent.

const windows: Window[] = [];
afterEach(async () => {
  vi.useRealTimers();
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

/**
 * A page with a form that posts to a service, its status line empty as the export writes it, and
 * the script run. Each submit that goes ahead is counted, not sent.
 */
function page() {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout"] });
  const happy = new Window({ url: "https://rosas-bakery.example/contact.html" });
  windows.push(happy);
  const window = happy as unknown as typeof globalThis;
  const { document } = window;
  document.body.innerHTML = `
    <form class="site-form" method="post" action="https://formspree.io/f/xyzAbc12" data-sending="Sending…">
      <button type="submit">Send</button>
      <p role="status" data-wf-form-status=""></p>
    </form>`;
  new Function("document", "HTMLElement", "HTMLFormElement", BEHAVIOUR_SCRIPTS.form ?? "")(
    document,
    window.HTMLElement,
    window.HTMLFormElement,
  );
  const form = document.querySelector("form");
  if (form === null) throw new Error("No form");
  const sent: number[] = [];
  // Counted after the script's own listener: a submit it lets through.
  form.addEventListener("submit", (event) => {
    if (!event.defaultPrevented) sent.push(Date.now());
    event.preventDefault();
  });
  const status = () => form.querySelector("[data-wf-form-status]")?.textContent;
  return { form, sent, status, opened: Date.now() };
}

describe("the form behaviour (3.7, B6)", () => {
  it("holds a form sent at once, says it's sending, and sends it once 3 seconds are up", () => {
    const { form, sent, status, opened } = page();

    form.requestSubmit();
    expect(sent).toEqual([]);
    expect(status()).toBe("Sending…");
    // Pressing Send again meanwhile sends nothing more.
    vi.advanceTimersByTime(1_000);
    form.requestSubmit();
    vi.advanceTimersByTime(1_999);
    expect(sent).toEqual([]);

    vi.advanceTimersByTime(1);

    expect(sent).toEqual([opened + 3_000]);
    expect(status()).toBe("");
    vi.advanceTimersByTime(10_000);
    expect(sent).toHaveLength(1);
  });

  it("sends at once a form a person took longer over", () => {
    const { form, sent, status } = page();
    vi.advanceTimersByTime(3_000);

    form.requestSubmit();

    expect(sent).toHaveLength(1);
    expect(status()).toBe("");
  });
});
