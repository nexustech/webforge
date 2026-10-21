import { loadNodeResources } from "@webforge/pipeline/node";
import { heroPhoto } from "@webforge/test-utils";
import { describe, expect, it } from "vitest";
import { thumbnailFor } from "./make-thumbnail.js";

describe("thumbnailFor", () => {
  it("answers with a WebP preview of the image", async () => {
    const outcome = await thumbnailFor(
      { type: "thumbnail", id: 4, mimeType: "image/jpeg", data: heroPhoto() },
      loadNodeResources,
    );

    expect(outcome).toMatchObject({ type: "thumbnail", id: 4 });
    expect(
      outcome.type === "thumbnail" && String.fromCharCode(...outcome.data.subarray(8, 12)),
    ).toBe("WEBP");
  }, 60_000);

  it("fails an image it can't decode, without details", async () => {
    await expect(
      thumbnailFor(
        { type: "thumbnail", id: 5, mimeType: "image/png", data: new Uint8Array([1, 2, 3]) },
        loadNodeResources,
      ),
    ).resolves.toEqual({ type: "thumbnail-failed", id: 5 });
  }, 60_000);
});
