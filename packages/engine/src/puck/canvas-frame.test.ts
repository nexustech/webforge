// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCanvasFrame } from "./canvas-frame.js";
import { NO_VIEW_OPTIONS } from "./engine-support.js";

const stopEnabled = vi.fn();
const stopViewOptions = vi.fn();
const stopGroups = vi.fn();
vi.mock("./enabled-elements.js", () => ({ keepElementsEnabled: vi.fn(() => stopEnabled) }));
vi.mock("./view-options.js", () => ({ applyViewOptions: vi.fn(() => stopViewOptions) }));
vi.mock("./element-roles.js", () => ({ keepElementsGroups: vi.fn(() => stopGroups) }));
const { keepElementsEnabled } = await import("./enabled-elements.js");
const { keepElementsGroups } = await import("./element-roles.js");
const { applyViewOptions } = await import("./view-options.js");

afterEach(() => {
  vi.clearAllMocks();
  document.head.replaceChildren();
  document.body.className = "";
  document.title = "";
  document.documentElement.removeAttribute("lang");
});

const siteCss = () => document.head.querySelector("[data-webforge-site-css]")?.textContent;

describe("CanvasFrame (R8)", () => {
  it("names its document after the site, in the site's language, set before or after (#465)", () => {
    const frame = createCanvasFrame(() => undefined);

    frame.setDocumentInfo({ title: "Rosa's Bakery", language: "en-GB" });
    expect(document.title).toBe("");
    frame.attach(document);
    expect(document.title).toBe("Rosa's Bakery");
    expect(document.documentElement.lang).toBe("en-GB");

    frame.setDocumentInfo({ title: "Rosa's" });
    expect(document.title).toBe("Rosa's");
    expect(document.documentElement.hasAttribute("lang")).toBe(false);
  });

  it("keeps the elements' wrappers groups while there is a document (#465)", () => {
    const frame = createCanvasFrame(() => undefined);

    frame.attach(document);
    expect(keepElementsGroups).toHaveBeenCalledWith(document);
    frame.detach();
    expect(stopGroups).toHaveBeenCalledOnce();
  });

  it("shows the site's CSS set before the canvas has a document, and later changes at once", () => {
    const frame = createCanvasFrame(() => undefined);

    frame.setSiteStyles({ css: "p{}", bodyClass: "font-sans" });
    expect(siteCss()).toBeUndefined();
    frame.attach(document);
    expect(siteCss()).toBe("p{}");
    expect(document.body.classList.contains("font-sans")).toBe(true);
    frame.setSiteStyles({ css: "h1{}", bodyClass: "" });

    expect(siteCss()).toBe("h1{}");
    expect(frame.document()).toBe(document);
  });

  it("keeps elements enabled in Content mode only, while there is a document", () => {
    const frame = createCanvasFrame(() => undefined);

    frame.setMode("content");
    expect(keepElementsEnabled).not.toHaveBeenCalled();
    frame.attach(document);
    expect(keepElementsEnabled).toHaveBeenCalledWith(document);
    frame.setMode("design");
    expect(stopEnabled).toHaveBeenCalledTimes(1);
    expect(frame.mode()).toBe("design");
  });

  it("shows the View menu's options in the document, with the elements' names", () => {
    const nameOf = (id: string) => `Name of ${id}`;
    const frame = createCanvasFrame(nameOf);
    const options = { ...NO_VIEW_OPTIONS, elementNames: true };

    frame.setViewOptions(options);
    frame.attach(document);
    expect(applyViewOptions).toHaveBeenLastCalledWith(document, options, nameOf);
    frame.detach();

    expect(stopViewOptions).toHaveBeenCalledTimes(1);
  });

  it("forgets the document once the canvas goes", () => {
    const frame = createCanvasFrame(() => undefined);
    frame.attach(document);

    frame.forget();

    expect(frame.document()).toBeNull();
  });
});
