import { describe, expect, it } from "vitest";
import { siteLibrary } from "./catalogue/index.js";
import { EDITOR_RENDER_CONTEXT } from "./library.js";
import {
  CARD_HOVER_FIELDS,
  entranceAttributes,
  entranceBehaviours,
  entranceClasses,
  HOVER_FIELDS,
  hoverClasses,
  PICTURE_HOVER_FIELDS,
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
    expect(HOVER_FIELDS.hover.options.map((option) => option.value)).toEqual([
      "none",
      "lift",
      "grow",
      "tilt",
      "liftShadow",
      "shadow",
      "darken",
      "underline",
    ]);
    expect(hoverClasses({ hover: "lift" })).toContain("motion-safe:hover:-translate-y-1");
    expect(hoverClasses({ hover: "grow" })).toContain("motion-safe:hover:scale-105");
    expect(hoverClasses({ hover: "shadow" })).toContain("hover:shadow-(--wf-hover-shadow)");
    expect(hoverClasses({ hover: "none" })).toBe("");
    expect(hoverClasses({})).toBe("");
    expect(hoverClasses({ hover: "spin" })).toBe("");

    expect(html("Button", { label: "Book", hover: "lift" })).toContain(
      "motion-safe:hover:-translate-y-1",
    );
  });

  it("darkens or underlines, without moving, in the Appearance group's hover row (2.22, ST-2)", () => {
    expect(hoverClasses({ hover: "darken" })).toBe(
      " motion-safe:transition-all motion-reduce:transition-none hover:brightness-90",
    );
    expect(hoverClasses({ hover: "underline" })).toBe(" hover:underline");
    expect(HOVER_FIELDS.hover.optionGroup.id).toBe("appearance");
    expect(HOVER_FIELDS.hover.label).toBe("When hovered");
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

describe("hover transitions and transforms (2.28, ST-7)", () => {
  it("tilts, or lifts with a shadow, in one transition only where motion is welcome", () => {
    expect(hoverClasses({ hover: "tilt" })).toBe(
      " motion-safe:transition-all motion-reduce:transition-none motion-safe:hover:rotate-2",
    );
    expect(hoverClasses({ hover: "liftShadow" })).toBe(
      " motion-safe:transition-all motion-reduce:transition-none motion-safe:hover:-translate-y-1 hover:shadow-(--wf-hover-shadow)!",
    );
    // Whatever the effect, the transition and every move wait for motion-safe; with less motion,
    // no transition at all, a component's own neither.
    for (const hover of HOVER_FIELDS.hover.options.map((option) => option.value)) {
      const classes = hoverClasses({ hover, hoverSpeed: "slow", hoverEasing: "springy" });
      for (const name of classes.trim().split(" ").filter(Boolean)) {
        if (name === "motion-reduce:transition-none") continue;
        if (/transition|duration|ease|translate|scale|rotate/.test(name)) {
          expect(name.startsWith("motion-safe:"), `${hover}: ${name}`).toBe(true);
        }
      }
      expect(classes.match(/motion-safe:transition-/g)?.length ?? 0, hover).toBeLessThanOrEqual(1);
    }
  });

  it("times the hover with its speed and movement, as theme tokens; the first of each adds none", () => {
    expect(hoverClasses({ hover: "lift", hoverSpeed: "slow", hoverEasing: "springy" })).toBe(
      " motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-spring motion-reduce:transition-none motion-safe:hover:-translate-y-1",
    );
    expect(hoverClasses({ hover: "grow", hoverSpeed: "medium", hoverEasing: "gentle" })).toContain(
      "motion-safe:duration-300 motion-safe:ease-out",
    );
    expect(hoverClasses({ hover: "lift", hoverSpeed: "fast", hoverEasing: "smooth" })).toBe(
      hoverClasses({ hover: "lift" }),
    );
    // Underline is at once: no transition to time.
    expect(hoverClasses({ hover: "underline", hoverSpeed: "slow" })).toBe(" hover:underline");
  });

  it("is set per device, each device's classes across its own widths (F-ED-4)", () => {
    const classes = hoverClasses({
      hover: { $responsive: { desktop: "lift", mobile: "none" } },
      hoverSpeed: { $responsive: { desktop: "slow", tablet: "fast" } },
    });
    expect(classes.trim().split(" ")).toEqual([
      "md:max-lg:motion-safe:transition-all",
      "md:max-lg:motion-reduce:transition-none",
      "md:max-lg:motion-safe:hover:-translate-y-1",
      "lg:motion-safe:transition-all",
      "lg:motion-safe:duration-500",
      "lg:motion-reduce:transition-none",
      "lg:motion-safe:hover:-translate-y-1",
    ]);
    expect(HOVER_FIELDS.hover.responsive).toBe(true);
    expect(HOVER_FIELDS.hoverSpeed.responsive).toBe(true);
    expect(HOVER_FIELDS.hoverEasing.responsive).toBe(true);
  });

  it("offers the speed and movement only for an effect that takes time, on some device", () => {
    const why = HOVER_FIELDS.hoverSpeed.unavailable;
    expect(why({ hover: "none" })).toBe(
      "Choose an effect when hovered, other than Underline, first.",
    );
    expect(why({ hover: "underline" })).toBeDefined();
    expect(why({})).toBeDefined();
    expect(why({ hover: "lift" })).toBeUndefined();
    expect(why({ hover: { $responsive: { desktop: "none", mobile: "grow" } } })).toBeUndefined();
    expect(HOVER_FIELDS.hoverEasing.unavailable({ hover: "none" })).toBeDefined();
  });

  it("is the same row on the Button, the Image, the Icon and the card sections", () => {
    for (const type of ["Button", "Image", "Icon", "Features", "Testimonials", "Team", "Pricing"]) {
      const fields = siteLibrary.components[type]?.fields ?? {};
      expect(Object.keys(fields), type).toEqual(
        expect.arrayContaining(["hover", "hoverSpeed", "hoverEasing"]),
      );
    }
    expect(PICTURE_HOVER_FIELDS.hover.options.map((option) => option.value)).not.toContain(
      "underline",
    );
    expect(CARD_HOVER_FIELDS.hover.label).toBe("Cards when hovered");
    const cards = html("Features", {
      hover: "tilt",
      hoverSpeed: "medium",
      items: [
        { type: "Feature", props: { id: "a", icon: "star", title: "Fast", text: "<p>Quick</p>" } },
      ],
    });
    expect(cards).toContain(
      "motion-safe:duration-300 motion-reduce:transition-none motion-safe:hover:rotate-2",
    );
  });

  it("darkens a Button of its own colour where its row has no effect, timed by that row", () => {
    const button = html("Button", {
      label: "Book",
      lookBackground: "primary",
      hover: { $responsive: { desktop: "lift", mobile: "none" } },
      hoverSpeed: "slow",
    });
    // Mobile: no effect, so it darkens, with its speed; Desktop and Tablet lift.
    expect(button).toContain("max-md:motion-safe:transition-all max-md:motion-safe:duration-500");
    expect(button).toContain("max-md:hover:brightness-90");
    expect(button).not.toMatch(/[ "]md:hover:brightness-90/);
    expect(button).toContain("md:motion-safe:hover:-translate-y-1");
  });

  it("moves an entrance in with its own transition, then leaves only the hover's", () => {
    const classes = entranceClasses({ entrance: "fade" });
    expect(classes).toContain("motion-safe:wf-entering:transition-[opacity,translate,scale]");
    expect(classes).toContain("motion-safe:wf-entering:duration-700");
    expect(classes).not.toMatch(/(^| )motion-safe:(transition|duration|ease)/);
  });
});
