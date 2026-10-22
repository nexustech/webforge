// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { keepElementsEnabled } from "./enabled-elements.js";

afterEach(() => {
  document.body.innerHTML = "";
});

const wrapper = (disabled: string) => {
  const element = document.createElement("div");
  element.setAttribute("data-puck-component", "heading-1");
  element.setAttribute("aria-disabled", disabled);
  element.innerHTML = '<h1><span contenteditable="true">Welcome</span></h1>';
  document.body.append(element);
  return element;
};

describe("keepElementsEnabled (1.26)", () => {
  it("removes aria-disabled from the elements, now and whenever it is set again", async () => {
    const element = wrapper("true");
    const stop = keepElementsEnabled(document);
    expect(element.hasAttribute("aria-disabled")).toBe(false);

    element.setAttribute("aria-disabled", "true");
    const added = wrapper("true");
    await new Promise((resolve) => setTimeout(resolve));
    expect(element.hasAttribute("aria-disabled")).toBe(false);
    expect(added.getAttribute("aria-disabled")).toBe("true");

    added.setAttribute("aria-disabled", "true");
    await new Promise((resolve) => setTimeout(resolve));
    expect(added.hasAttribute("aria-disabled")).toBe(false);

    stop();
    element.setAttribute("aria-disabled", "true");
    await new Promise((resolve) => setTimeout(resolve));
    expect(element.getAttribute("aria-disabled")).toBe("true");
  });

  it("leaves other elements, and elements that aren't disabled, alone", async () => {
    const button = document.createElement("button");
    button.setAttribute("aria-disabled", "true");
    document.body.append(button);
    const element = wrapper("false");
    const stop = keepElementsEnabled(document);

    button.setAttribute("aria-disabled", "true");
    await new Promise((resolve) => setTimeout(resolve));

    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(element.getAttribute("aria-disabled")).toBe("false");
    stop();
  });
});
