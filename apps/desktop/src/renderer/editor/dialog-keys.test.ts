// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { isDialogText } from "./dialog-keys.js";

describe("isDialogText (#421 review)", () => {
  afterEach(() => document.body.replaceChildren());

  it("is a dialog's text field, select or editable text, and not its other controls", () => {
    document.body.innerHTML = `
      <div role="dialog" data-state="open">
        <input id="name" type="text"><textarea id="note"></textarea><select id="pick"></select>
        <div id="rich" contenteditable="true"></div>
        <input id="check" type="checkbox"><input id="size" type="range"><button id="swatch"></button>
      </div>
      <input id="outside" type="text">
      <div role="alertdialog" data-state="closed"><input id="closing" type="text"></div>`;
    const at = (id: string) => document.getElementById(id);

    expect(["name", "note", "pick", "rich"].map((id) => isDialogText(at(id)))).toEqual([
      true,
      true,
      true,
      true,
    ]);
    // A slider or a swatch in a dialog (Theme Studio) leaves Ctrl/Cmd+Z to the site.
    expect(["check", "size", "swatch"].map((id) => isDialogText(at(id)))).toEqual([
      false,
      false,
      false,
    ]);
    // Outside a dialog, or in one closing after its answer: the site's.
    expect([isDialogText(at("outside")), isDialogText(at("closing"))]).toEqual([false, false]);
  });
});
