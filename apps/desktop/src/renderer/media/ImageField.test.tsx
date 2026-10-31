// @vitest-environment happy-dom
import type { ImageMeta, MediaId } from "@webforge/model";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaImportResult } from "../../shared/ipc-contract.js";
import type { EditorSession } from "../editor/editor-session.js";
import { createImagePickRequests, type ImagePickRequests } from "../editor/image-picks.js";
import { sessionWith } from "../testing/fixtures.js";
import { ImageField } from "./ImageField.js";
import { addMedia } from "./media-commands.js";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const image = (id: string, alt = ""): ImageMeta => ({
  id: id as MediaId,
  hash: id.padEnd(64, "0"),
  name: id,
  fileName: `${id}.jpg`,
  kind: "image",
  mimeType: "image/jpeg",
  width: 800,
  height: 600,
  alt,
});
const shop = image("a1", "Our shop front");
const cakes = image("b2");

let container: HTMLDivElement;
let root: Root;
let session: EditorSession;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  session = sessionWith();
  addMedia(session, [shop, cakes]);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render(
  value: unknown,
  choose = vi.fn(async (): Promise<MediaImportResult> => ({ status: "canceled" })),
  picks?: ImagePickRequests,
) {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  await act(async () =>
    root.render(
      <ImageField
        id="field-image"
        labelId="field-image-label"
        field={{ kind: "image", label: "Image" }}
        value={value}
        onChange={onChange}
        onCommit={onCommit}
        session={session}
        media={{ choose }}
        notify={() => undefined}
        imageUrl={(item) => `test://${item.name}`}
        {...(picks === undefined ? {} : { picks })}
      />,
    ),
  );
  return { onChange, onCommit, choose };
}

// The picker is a dialog, outside the field: look through the whole document.
const button = (name: string) =>
  [...document.querySelectorAll("button")].find((element) =>
    (element.getAttribute("aria-label") ?? element.textContent ?? "").includes(name),
  );
const options = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')];
const option = (name: string) => options().find((element) => element.textContent === name);
/** Double-clicks an image in the picker, which chooses it. */
const chooseImage = (name: string) =>
  act(async () => {
    option(name)?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });

describe("ImageField", () => {
  it("chooses an image from Media in one step", async () => {
    const { onChange, onCommit } = await render(undefined);
    expect(button("Choose an image")?.id).toBe("field-image");

    await act(async () => button("Choose an image")?.click());
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Choose an image");
    expect(options().map((each) => each.textContent)).toEqual(["a1.jpg", "b2.jpg"]);
    await chooseImage("b2.jpg");

    expect(onChange).toHaveBeenCalledWith({ mediaId: "b2" });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("finds an image by its alt text, and starts on the image placed", async () => {
    await render({ mediaId: "b2" });

    await act(async () => button("Change image")?.click());
    expect(option("b2.jpg")?.getAttribute("aria-selected")).toBe("true");
    const search = document.querySelector<HTMLInputElement>('input[type="search"]');
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setValue?.call(search, "shop front");
      search?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(options().map((each) => each.textContent)).toEqual(["a1.jpg"]);
  });

  it("shows the chosen image, drops the old image's alt override when it changes, and removes it", async () => {
    const { onChange } = await render({ mediaId: "a1", alt: "The bakery" });
    expect(container.querySelector("figure img")?.getAttribute("src")).toBe("test://a1");
    expect(container.textContent).toContain("a1.jpg");

    await act(async () => button("Change image")?.click());
    await chooseImage("b2.jpg");
    expect(onChange).toHaveBeenLastCalledWith({ mediaId: "b2" });

    await act(async () => button("Remove image")?.click());
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  /** Types `text` into the alt text field and leaves it. */
  async function typeAlt(text: string) {
    const input = container.querySelector<HTMLInputElement>('input[type="text"]');
    if (input === null) throw new Error("no alt text field");
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setValue?.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    return input;
  }

  it("overrides the alt text for this placement", async () => {
    const { onChange, onCommit } = await render({ mediaId: "a1" });

    const input = await typeAlt("Shop");

    expect(input.placeholder).toBe("From Media: Our shop front");
    expect(onChange).toHaveBeenCalledWith({ mediaId: "a1", alt: "Shop" });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("goes back to the image's own alt text when the override is emptied", async () => {
    const { onChange } = await render({ mediaId: "a1", alt: "Shop" });

    await typeAlt("");

    expect(onChange).toHaveBeenCalledWith({ mediaId: "a1" });
  });

  it("adds a new image to Media and places it", async () => {
    const fresh = image("c3");
    const { onChange, choose } = await render(
      undefined,
      vi.fn(async () => ({ status: "imported", items: [fresh], rejected: [] }) as const),
    );

    await act(async () => button("Choose an image")?.click());
    await act(async () => button("Add a new image")?.click());

    expect(choose).toHaveBeenCalled();
    expect(session.history.document.getState().media[fresh.id]).toEqual(fresh);
    expect(onChange).toHaveBeenCalledWith({ mediaId: "c3" });
  });

  it("says when the placed image is no longer in Media", async () => {
    await render({ mediaId: "gone" });

    expect(container.textContent).toContain("This image is no longer in Media.");
    expect(container.querySelector('input[type="text"]')?.getAttribute("placeholder")).toBe(
      "The image has no alt text in Media yet",
    );
  });

  it("opens its picker when the canvas asks to edit the selected element's image (F-ED-25)", async () => {
    const picks = createImagePickRequests();
    session.select("img");
    // Asked before the Edit panel showed the field: it opens once it is drawn.
    picks.request("img");
    await render(undefined, undefined, picks);
    const picker = () => document.querySelector('[role="dialog"]');
    expect(picker()?.textContent).toContain("Choose an image");

    // Closed, focus goes back to the field's button, which opened it.
    await act(async () => button("Cancel")?.click());
    expect(picker()).toBeNull();
    // The dialog gives the focus back once it has closed, a moment later.
    await vi.waitFor(() => expect(document.activeElement?.id).toBe("field-image"));
    // Another element's image is its own field's.
    await act(async () => picks.request("other"));
    expect(picker()).toBeNull();
    await act(async () => picks.request("img"));
    expect(picker()).not.toBeNull();
  });
});
