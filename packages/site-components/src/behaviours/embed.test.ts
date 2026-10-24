import type { NodeDoc } from "@webforge/model";
import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { BEHAVIOUR_SCRIPTS } from "../behaviours.js";
import { siteLibrary } from "../catalogue/index.js";
import { EMBED_SOURCES } from "../embed.js";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";

// The "embed" behaviour (F-CM-4, 2.8) on a Video and a Map as the export renders them.

const windows: Window[] = [];
afterEach(async () => {
  for (const happy of windows.splice(0)) await happy.happyDOM.close();
});

const video: NodeDoc = {
  type: "Video",
  props: { id: "v", title: "Our bakery", address: "https://youtu.be/aqz-KE-bpKQ" },
};
const map: NodeDoc = {
  type: "Map",
  props: { id: "m", title: "", address: "1 High Street, Hightown" },
};

/**
 * A page of its own with `nodes`, and `embed.js` run on it unless `script` is false. `consented`
 * marks the page as the consent banner does for a visitor who accepted all before (3.8).
 */
function page(nodes: NodeDoc[], script = true, consented = false) {
  // No real request from the test: the frame stays empty.
  const happy = new Window({
    width: 1024,
    height: 768,
    settings: { disableIframePageLoading: true },
  });
  windows.push(happy);
  const window = happy as unknown as typeof globalThis;
  const { document } = window;
  document.body.innerHTML = renderNodesToHtml(nodes, siteLibrary, EDITOR_RENDER_CONTEXT);
  document.documentElement.toggleAttribute("data-wf-consent-all", consented);
  if (script) {
    new Function("document", "HTMLElement", BEHAVIOUR_SCRIPTS.embed ?? "")(
      document,
      window.HTMLElement,
    );
  }
  const embeds = [...document.querySelectorAll<HTMLElement>("[data-wf-embed]")];
  const button = (embed: HTMLElement | undefined) =>
    embed?.querySelector<HTMLButtonElement>("[data-wf-embed-load]") ?? null;
  return { window, document, embeds, button };
}

describe("the embed behaviour (F-CM-4, B7)", () => {
  it("loads nothing from another site until the visitor asks", () => {
    const { document, embeds } = page([video, map]);

    expect(embeds).toHaveLength(2);
    expect(document.querySelector("iframe")).toBeNull();
    // Nothing on the page points the browser at the provider: the player's address is data.
    expect(document.body.innerHTML).not.toMatch(/\ssrc="https?:/);
  });

  it("shows each placeholder's button only when it can work", () => {
    const withScript = page([video]);
    const without = page([video], false);

    expect(
      withScript.document.querySelector("[data-wf-embed-controls]")?.hasAttribute("hidden"),
    ).toBe(false);
    expect(without.document.querySelector("[data-wf-embed-controls]")?.hasAttribute("hidden")).toBe(
      true,
    );
    // Without the script, the link still opens the video on its own site.
    expect(without.document.querySelector("a[href]")?.getAttribute("href")).toBe(
      "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    );
  });

  it("plays the video in its place, named and focused, when the visitor clicks", () => {
    const { document, embeds, button } = page([video, map]);
    const [first, second] = embeds;

    button(first)?.click();

    const frame = first?.querySelector("iframe");
    expect(frame?.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?autoplay=1",
    );
    expect(frame?.title).toBe("Our bakery");
    expect(frame?.referrerPolicy).toBe("strict-origin-when-cross-origin");
    // Asked for: it loads now.
    expect(frame?.getAttribute("loading")).toBeNull();
    expect(first?.hasAttribute("data-loaded")).toBe(true);
    expect(first?.querySelector("[data-wf-embed-placeholder]")).toBeNull();
    expect(document.activeElement).toBe(frame);
    // The other embed waits for its own click.
    expect(second?.querySelector("iframe")).toBeNull();
  });

  it("loads a map without autoplay, named after the map when its section has no title", () => {
    const { embeds, button } = page([map]);
    const [embed] = embeds;

    button(embed)?.click();

    const frame = embed?.querySelector("iframe");
    expect(frame?.getAttribute("src")).toBe(
      "https://www.google.com/maps?q=1%20High%20Street%2C%20Hightown&output=embed",
    );
    expect(frame?.title).toBe("Map");
  });

  it("loads every embed, without playing, once the visitor accepts all in the consent banner", () => {
    const { window, document, embeds } = page([video, map]);
    const focused = document.activeElement;

    document.dispatchEvent(new window.Event("webforge:consent-all"));

    expect(embeds.map((embed) => embed.querySelector("iframe")?.getAttribute("src"))).toEqual([
      "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ",
      "https://www.google.com/maps?q=1%20High%20Street%2C%20Hightown&output=embed",
    ]);
    // Nothing starts playing, and the focus stays where the visitor left it.
    expect(document.activeElement).toBe(focused);
    // Each loads when the visitor scrolls to it, not all at once.
    for (const embed of embeds) expect(embed.querySelector("iframe")?.loading).toBe("lazy");
    // Accepting again loads nothing twice.
    document.dispatchEvent(new window.Event("webforge:consent-all"));
    expect(document.querySelectorAll("iframe")).toHaveLength(2);
  });

  it("loads every embed straight away for a visitor who accepted all before", () => {
    const { document } = page([video, map], true, true);

    expect(document.querySelectorAll("iframe")).toHaveLength(2);
  });

  it.each([
    "https://example.com/embed",
    "https://www.google.com/search?q=bakery",
    "https://www.youtube-nocookie.com/watch?v=aqz-KE-bpKQ",
    "https://www.youtube-nocookie.com.example.com/embed/aqz-KE-bpKQ",
    "http://www.youtube-nocookie.com/embed/aqz-KE-bpKQ",
    "javascript:alert(1)",
    "not a url",
  ])("loads nothing from %s, whatever the page says", (src) => {
    const { embeds, button } = page([video]);
    const [embed] = embeds;
    embed?.setAttribute("data-src", src);

    button(embed)?.click();

    expect(embed?.querySelector("iframe")).toBeNull();
    expect(embed?.querySelector("[data-wf-embed-placeholder]")).not.toBeNull();
  });

  it("loads only from the sources the components build addresses for", () => {
    const script = BEHAVIOUR_SCRIPTS.embed ?? "";
    const sources = /const SOURCES = \[([^\]]*)\]/.exec(script)?.[1] ?? "";

    expect([...sources.matchAll(/"([^"]+)"/g)].map((match) => match[1]).sort()).toEqual(
      Object.values(EMBED_SOURCES).sort(),
    );
  });
});
