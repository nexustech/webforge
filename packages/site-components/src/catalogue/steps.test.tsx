import { t } from "@webforge/i18n";
import type { NodeDoc } from "@webforge/model";
import { describe, expect, it } from "vitest";
import { EDITOR_RENDER_CONTEXT } from "../library.js";
import { renderNodesToHtml } from "../render-static.js";
import { siteLibrary } from "./index.js";

/** The Steps section's HTML with `props` over its defaults. */
function renderSteps(props: Readonly<Record<string, unknown>> = {}): string {
  const defaults = siteLibrary.components.Steps?.defaults;
  return renderNodesToHtml(
    [{ type: "Steps", props: { id: "steps", ...defaults, ...props } }],
    siteLibrary,
    EDITOR_RENDER_CONTEXT,
  );
}

/** A step with `date`. */
const dated = (index: number, date: string): NodeDoc => ({
  type: "Step",
  props: { id: `step-${index}`, title: `Step ${index}`, text: "<p>What happens</p>", date },
});

describe("the Steps (#1134)", () => {
  it("starts with three steps of how a job goes, under its title", () => {
    const html = renderSteps();

    expect(html).toContain('class="site-steps');
    expect(html).toContain(t("starter.stepsTitle"));
    for (const key of [
      "starter.stepContactTitle",
      "starter.stepQuoteTitle",
      "starter.stepWorkTitle",
    ] as const) {
      expect(html).toContain(t(key));
    }
  });

  it("lists its steps in an ordered list, each an item, numbered by the list itself", () => {
    const html = renderSteps();

    // The list itself: a screen reader says how many steps there are, and which one it's on.
    expect(html).toMatch(/<ol class="grid [^"]*md:grid-flow-col[^"]*"><li class="site-step /);
    expect(html.match(/<li class="site-step /g)).toHaveLength(3);
    // Its number is the list's marker, in the step: no number written in by hand.
    expect(html).toContain("list-inside list-decimal");
    expect(html).not.toMatch(/<li[^>]*list-none/);
  });

  it("shows the dates in the Timeline only, along a line", () => {
    const items = [dated(0, "Week 1"), dated(1, "Week 2")];

    const numbered = renderSteps({ items });
    expect(numbered).not.toContain("Week 1");

    const timeline = renderSteps({ variant: "timeline", items });
    expect(timeline).toMatch(/<ol class="grid [^"]*"><li class="site-step [^"]*border-s-2/);
    const weeks = ["Week 1", "Week 2"].map((week) => timeline.indexOf(week));
    expect(weeks[0]).toBeGreaterThan(0);
    // In the steps' order.
    expect(weeks[1]).toBeGreaterThan(weeks[0] ?? 0);
  });

  it("is two components: the section, and a step only it holds", () => {
    expect(siteLibrary.components.Steps?.place).toBe("section");
    expect(siteLibrary.components.Step?.place).toBe("child");
    const slot = siteLibrary.components.Steps?.fields.items;
    expect(slot?.kind === "slot" ? slot.allow : undefined).toEqual(["Step"]);
  });
});
