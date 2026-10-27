import { describe, expect, it } from "vitest";
import { siteLibrary } from "./catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "./library.js";
import {
  entranceAttributes,
  entranceBehaviours,
  entranceClasses,
  HOVER_FIELD,
  hoverClasses,
} from "./motion.js";
import { renderNodesToHtml } from "./render-static.js";

const html = (type: string, props: Record<string, unknown>) =>
  renderNodesToHtml([{ type, props: { id: "n", ...props } }], siteLibrary, EDITOR_RENDER_CONTEXT);

describe("entrance animations (2.12, F-DS-5)", () => {
  it("draws each entrance hidden only under motion-safe, once the page is marked", () => {
    const classes = entranceClasses({ entrance: "slideUp", entranceDelay: "medium" });

    expect(classes.startsWith(" ")).toBe(true);
    expect(classes.split(" ")).toEqual(
      expect.arrayContaining([
        "motion-safe:wf-waiting:opacity-0",
        "motion-safe:wf-waiting:translate-y-8",
        // No fading out when the page is marked: it moves only on the way in.
        "motion-safe:wf-waiting:transition-none",
        // Only while it moves in.
        "motion-safe:wf-entering:delay-300",
      ]),
    );
    // Every class that hides or moves it waits for motion-safe.
    for (const name of classes.trim().split(" "))
      expect(name.startsWith("motion-safe:")).toBe(true);
    expect(entranceAttributes({ entrance: "slideUp" })).toEqual({ "data-wf-entrance": "slideUp" });
    expect(entranceBehaviours({ entrance: "zoom" })).toEqual(["animate"]);
  });

  it("adds nothing for None, no value or an unknown one", () => {
    for (const entrance of ["none", undefined, "spin"]) {
      expect(entranceClasses({ entrance, entranceDelay: "long" })).toBe("");
      expect(entranceAttributes({ entrance })).toEqual({});
      expect(entranceBehaviours({ entrance })).toEqual([]);
    }
  });

  it("is on every section and on each element that stands alone, the same way", () => {
    for (const type of ["Section", "Hero", "Heading", "Text", "Image", "Button", "Icon", "List"]) {
      const fields = siteLibrary.components[type]?.fields ?? {};
      expect(Object.keys(fields), type).toEqual(
        expect.arrayContaining(["entrance", "entranceDelay"]),
      );
    }
    for (const type of ["Column", "ListItem", "Columns"]) {
      const has = "entrance" in (siteLibrary.components[type]?.fields ?? {});
      expect(has, type).toBe(type === "Columns");
    }

    const section = html("Section", { entrance: "fade", content: [] });
    const heading = html("Heading", { text: "Hi", entrance: "fade" });
    for (const drawn of [section, heading]) {
      expect(drawn).toContain('data-wf-entrance="fade"');
      expect(drawn).toContain("motion-safe:wf-waiting:opacity-0");
    }
  });

  it("needs the animate behaviour only with an entrance, besides a section's own", () => {
    const behavioursOf = (type: string, values: Record<string, unknown>) => {
      const behaviours = siteLibrary.components[type]?.behaviours;
      return typeof behaviours === "function" ? behaviours(values) : (behaviours ?? []);
    };

    expect(behavioursOf("Heading", {})).toEqual([]);
    expect(behavioursOf("Heading", { entrance: "fade" })).toEqual(["animate"]);
    expect(behavioursOf("Gallery", {})).toEqual(["lightbox"]);
    expect(behavioursOf("Gallery", { entrance: "zoom" })).toEqual(["lightbox", "animate"]);
  });
});

describe("hover effects (2.12, F-DS-5)", () => {
  it("moves a button only under motion-safe; a shadow needs no motion", () => {
    expect(HOVER_FIELD.options.map((option) => option.value)).toEqual([
      "none",
      "lift",
      "grow",
      "shadow",
      "darken",
      "underline",
    ]);
    expect(hoverClasses("lift")).toContain("motion-safe:hover:-translate-y-1");
    expect(hoverClasses("grow")).toContain("motion-safe:hover:scale-105");
    expect(hoverClasses("shadow")).toContain("hover:shadow-(--wf-hover-shadow)");
    expect(hoverClasses("none")).toBe("");
    expect(hoverClasses(undefined)).toBe("");

    expect(html("Button", { label: "Book", hover: "lift" })).toContain(
      "motion-safe:hover:-translate-y-1",
    );
  });

  it("darkens or underlines, without moving, in the Appearance group's hover row (2.22, ST-2)", () => {
    expect(hoverClasses("darken")).toBe(" transition-[filter] hover:brightness-90");
    expect(hoverClasses("underline")).toBe(" hover:underline");
    expect(HOVER_FIELD.optionGroup.id).toBe("appearance");
    expect(HOVER_FIELD.label).toBe("When hovered");
    expect(html("Icon", { icon: "star", hover: "darken" })).toContain("hover:brightness-90");
    const photo = {
      sources: [],
      src: "assets/img/photo-640.jpg",
      fallback: { type: "image/jpeg" as const, srcset: "assets/img/photo-640.jpg 640w" },
      width: 640,
      height: 480,
      alt: "A photo",
    };
    const image = renderNodesToHtml(
      [{ type: "Image", props: { id: "n", image: { mediaId: "photo" }, hover: "grow" } }],
      siteLibrary,
      { ...EDITOR_RENDER_CONTEXT, image: () => photo },
    );
    expect(image).toMatch(/<figure class="[^"]*motion-safe:hover:scale-105/);
  });
});
