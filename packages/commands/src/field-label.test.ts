import { describe, expect, it } from "vitest";
import { fieldInLabel } from "./field-label.js";

const image = { kind: "media", label: "Image" };
const shop = { mediaId: "shop" };

describe("fieldInLabel", () => {
  it("names a field lower-case, as the Edit panel's steps do", () => {
    expect(fieldInLabel("Hero", { kind: "text", label: "Title" })).toBe("title");
  });

  it("names an image's alt text when only that changed (#1370)", () => {
    expect(fieldInLabel("Image", image, shop, { mediaId: "shop", alt: "Our shop" })).toBe(
      "alt text",
    );
    expect(fieldInLabel("Hero", image, { ...shop, alt: "Old" }, shop)).toBe("alt text");
  });

  it("names a new picture by its field, or 'picture' where the field is named like its element", () => {
    expect(fieldInLabel("Image", image, shop, { mediaId: "door" })).toBe("picture");
    expect(fieldInLabel("Image", image, undefined, shop)).toBe("picture");
    expect(fieldInLabel("Hero", image, shop, { mediaId: "door" })).toBe("image");
    // Before the value is known, as a gesture begins.
    expect(fieldInLabel("Image", image)).toBe("picture");
  });
});
