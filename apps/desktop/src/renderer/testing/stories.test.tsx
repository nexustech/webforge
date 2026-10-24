// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PanelRegistry } from "../shell/panels.js";
import { panelStory } from "./stories.js";

afterEach(cleanup);

function Hello() {
  return <p>Hello, panel</p>;
}

describe("panelStory (2.20, B6)", () => {
  it("says it is drawing until its panels are on the page, then that it is ready (#365)", async () => {
    const register = (panels: PanelRegistry) =>
      panels.register({ id: "hello", slot: "left.top", title: "Hello", component: Hello });

    const { container } = render(panelStory(register).render());

    await screen.findByText("Hello, panel");
    expect(container.querySelector("[data-story-state]")?.getAttribute("data-story-state")).toBe(
      "ready",
    );
  });

  it("says it is drawing while no panel is registered", () => {
    const { container } = render(panelStory(() => () => undefined).render());

    expect(container.querySelector("[data-story-state]")?.getAttribute("data-story-state")).toBe(
      "drawing",
    );
  });
});
