import { loadNodeResources } from "@webforge/pipeline/node";
import { heroPhoto } from "@webforge/test-utils";
import { scaledTestTimeout } from "@webforge/test-utils/vitest";
import { describe, expect, it } from "vitest";
import { thumbnailFor } from "./make-thumbnail.js";

// Timeouts (#1052): the first use of the worker's Node resources loads Tailwind, the image codecs
// and the fonts, and a build runs them: seconds alone, several times that on a busy machine. So
// these tests set their own timeouts.

describe("thumbnailFor", () => {
  it(
    "answers with a WebP preview of the image",
    async () => {
      const outcome = await thumbnailFor(
        { type: "thumbnail", mimeType: "image/jpeg", data: heroPhoto() },
        loadNodeResources,
      );

      expect(outcome).toMatchObject({ type: "thumbnail" });
      expect(
        outcome.type === "thumbnail" && String.fromCharCode(...outcome.data.subarray(8, 12)),
      ).toBe("WEBP");
    },
    scaledTestTimeout(60_000),
  );

  it(
    "fails an image it can't decode, without details",
    async () => {
      await expect(
        thumbnailFor(
          { type: "thumbnail", mimeType: "image/png", data: new Uint8Array([1, 2, 3]) },
          loadNodeResources,
        ),
      ).resolves.toEqual({ type: "thumbnail-failed" });
    },
    scaledTestTimeout(60_000),
  );
});
