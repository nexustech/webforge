import {
  EDITOR_RENDER_CONTEXT,
  type RenderContext,
  type ResolvedImage,
} from "@webforge/site-components";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { createContextTracker, createRenderContextStore } from "./render-context-store.js";

/** A tracker on a store holding `context`, with what it read, and how often a change reached it. */
function following(context: RenderContext, read: (context: RenderContext) => void) {
  const store = createRenderContextStore(context);
  const tracker = createContextTracker(store);
  let reached = 0;
  tracker.subscribe(() => {
    reached += 1;
  });
  read(tracker.track());
  return { store, tracker, reached: () => reached };
}

const image = (src: string): ResolvedImage => ({
  sources: [],
  src,
  fallback: { type: "image/jpeg", srcset: "" },
  width: 10,
  height: 10,
  alt: "",
});

describe("the render context's parts, followed by what each component read (#727)", () => {
  it("reaches a component through the look of its own kind only", () => {
    const base: RenderContext = {
      ...EDITOR_RENDER_CONTEXT,
      looks: { Heading: { lookItalic: true }, Button: { lookCorners: "full" } },
    };
    const heading = following(base, (context) => context.looks?.Heading);

    heading.store.set({ ...base, looks: { ...base.looks, Button: { lookCorners: "none" } } });
    expect(heading.reached()).toBe(0);
    heading.store.set({ ...base, looks: { Button: { lookCorners: "none" } } });
    expect(heading.reached()).toBe(1);
    expect(heading.tracker.snapshot()).toBe(1);
  });

  it("reaches a component through a function only when its answer changes", () => {
    const base: RenderContext = { ...EDITOR_RENDER_CONTEXT, image: () => image("a") };
    const photo = following(base, (context) => context.image("m1"));

    // Another function, the same image: nothing to draw.
    photo.store.set({ ...base, image: () => image("a") });
    expect(photo.reached()).toBe(0);
    photo.store.set({ ...base, image: (id) => (id === "m1" ? image("b") : null) });
    expect(photo.reached()).toBe(1);
  });

  it("counts what a function draws as changed with the function", () => {
    const hint = () => createElement("span", null, "hint");
    const base: RenderContext = { ...EDITOR_RENDER_CONTEXT, emptyImage: hint };
    const empty = following(base, (context) => context.emptyImage?.());

    empty.store.set({ ...base, emptyImage: hint });
    expect(empty.reached()).toBe(0);
    empty.store.set({ ...base, emptyImage: () => createElement("span", null, "hint") });
    expect(empty.reached()).toBe(1);
  });

  it("reaches nothing that read none of what changed, and everything that read it whole", () => {
    const base: RenderContext = { ...EDITOR_RENDER_CONTEXT, navigation: [] };
    const nothing = following(base, () => undefined);
    const nav = following(base, (context) => context.navigation);
    const whole = following(base, (context) => ({ ...context }));
    const keys = following({ ...base, looks: {} }, (context) => Object.keys(context.looks ?? {}));

    for (const followed of [nothing, nav, whole, keys]) {
      followed.store.set({ ...base, navigation: [], looks: { Heading: { lookItalic: true } } });
    }

    expect([nothing, nav, whole, keys].map((followed) => followed.reached())).toEqual([0, 1, 1, 1]);
  });

  it("sees a change that came before it subscribed, as a component's first drawing can", () => {
    const base: RenderContext = { ...EDITOR_RENDER_CONTEXT, looks: {} };
    const store = createRenderContextStore(base);
    const tracker = createContextTracker(store);
    void tracker.track().looks?.Heading;
    const drawn = tracker.snapshot();

    // Between the drawing and the subscription (React subscribes in an effect).
    store.set({ ...base, looks: { Heading: { lookItalic: true } } });
    tracker.subscribe(() => undefined);

    expect(tracker.snapshot()).not.toBe(drawn);
    // Asked again, with nothing new: the same answer.
    expect(tracker.snapshot()).toBe(tracker.snapshot());
  });

  it("forgets what it read the drawing before", () => {
    const base: RenderContext = { ...EDITOR_RENDER_CONTEXT, firstSection: "a" };
    const store = createRenderContextStore(base);
    const tracker = createContextTracker(store);
    let reached = 0;
    tracker.subscribe(() => {
      reached += 1;
    });
    void tracker.track().firstSection;
    tracker.track();

    store.set({ ...base, firstSection: "b" });
    expect(reached).toBe(0);
  });

  it("reads a frozen context, as the document store gives one", () => {
    const frozen = Object.freeze({ ...EDITOR_RENDER_CONTEXT, image: () => image("a") });
    const photo = following(frozen, (context) => context.image("m1"));

    photo.store.set({ ...frozen, image: () => image("b") });
    expect(photo.reached()).toBe(1);
  });

  it("tells nobody of the context it already has", () => {
    const store = createRenderContextStore(EDITOR_RENDER_CONTEXT);
    let told = 0;
    store.subscribe(() => {
      told += 1;
    });

    store.set(EDITOR_RENDER_CONTEXT);
    expect(told).toBe(0);
  });
});
