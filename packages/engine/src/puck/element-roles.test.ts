// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { keepElementsGroups } from "./element-roles.js";

afterEach(() => {
  document.body.innerHTML = "";
});

/** An element's wrapper as dnd-kit leaves it: a focusable button, a link inside. */
const wrapper = (role = "button") => {
  const element = document.createElement("div");
  element.setAttribute("data-puck-component", "hero-1");
  element.setAttribute("role", role);
  element.setAttribute("tabindex", "0");
  element.setAttribute("aria-pressed", "false");
  element.innerHTML = '<section><a href="#">Visit us</a></section>';
  document.body.append(element);
  return element;
};

const settled = () => new Promise((resolve) => setTimeout(resolve));

describe("keepElementsGroups (#465)", () => {
  it("makes the wrappers groups, now and whenever dnd-kit makes one a button", async () => {
    const element = wrapper();
    const stop = keepElementsGroups(document);
    expect(element.getAttribute("role")).toBe("group");
    // Only a button may say it is pressed; still focusable, for dragging from the keyboard.
    expect(element.hasAttribute("aria-pressed")).toBe(false);
    expect(element.getAttribute("tabindex")).toBe("0");

    // As a drag starts, dnd-kit says so again.
    element.setAttribute("aria-pressed", "true");
    await settled();
    expect(element.hasAttribute("aria-pressed")).toBe(false);

    const added = wrapper();
    await settled();
    expect(added.getAttribute("role")).toBe("group");

    stop();
    element.setAttribute("role", "button");
    await settled();
    expect(element.getAttribute("role")).toBe("button");
  });

  it("leaves other elements, and other roles, alone", async () => {
    const button = document.createElement("div");
    button.setAttribute("role", "button");
    document.body.append(button);
    const region = wrapper("region");
    keepElementsGroups(document);
    await settled();

    expect(button.getAttribute("role")).toBe("button");
    expect(region.getAttribute("role")).toBe("region");
    expect(region.getAttribute("aria-pressed")).toBe("false");
  });
});
