import { Window } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BEHAVIOUR_SCRIPTS } from "../behaviours.js";

// The "form" behaviour (3.7, B6): a form sent in the page's first seconds isn't sent.

const windows: Window[] = [];
afterEach(async () => {
  vi.useRealTimers();
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

/** A page with a form that posts to a service, and one with nowhere to send, the script run. */
function page() {
  vi.useFakeTimers({ toFake: ["Date"] });
  const happy = new Window({ url: "https://rosas-bakery.example/contact.html" });
  windows.push(happy);
  const window = happy as unknown as typeof globalThis;
  const { document } = window;
  document.body.innerHTML = `
    <form class="site-form" method="post" action="https://formspree.io/f/xyzAbc12"></form>
    <form class="site-form" method="post" data-wf-form-unset="noService"></form>`;
  new Function("document", BEHAVIOUR_SCRIPTS.form ?? "")(document);
  const [form] = document.querySelectorAll("form");
  /** Whether sending the form now would go ahead. */
  const sends = () => {
    const event = new window.Event("submit", { cancelable: true });
    form?.dispatchEvent(event);
    return !event.defaultPrevented;
  };
  return { sends };
}

describe("the form behaviour (3.7, B6)", () => {
  it("holds back a form sent in the page's first 3 seconds, as a robot sends it", () => {
    const { sends } = page();

    expect(sends()).toBe(false);
    vi.advanceTimersByTime(2_900);
    expect(sends()).toBe(false);
  });

  it("sends it once a person could have filled it in", () => {
    const { sends } = page();

    vi.advanceTimersByTime(3_000);

    expect(sends()).toBe(true);
  });
});
