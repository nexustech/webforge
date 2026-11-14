import { describe, expect, it } from "vitest";
import { z } from "zod";
import { overLimit, sampleOf } from "./contract-kit.test-helper.js";

// The IPC contracts' test kit (#991): what it makes each schema accept, and that it finds the
// limits a request is checked against.

describe("the IPC contracts' test kit", () => {
  it("makes a value each kind of schema accepts", () => {
    const schema = z.strictObject({
      id: z.uuid(),
      name: z.string().trim().min(1).max(40),
      count: z.int().min(3).max(9),
      kind: z.enum(["page", "post"]),
      tags: z.array(z.string()).max(5),
      maybe: z.string().optional(),
      either: z.union([z.literal("a"), z.null()]),
      hash: z.string().regex(/^[0-9a-f]{64}$/),
      file: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
    });

    const sample = sampleOf(schema);

    expect(sample.ok).toBe(true);
    expect(sample.ok && sample.value).toMatchObject({ count: 3, kind: "page", either: "a" });
  });

  it("says where it can't make one", () => {
    const sample = sampleOf(z.strictObject({ code: z.string().regex(/^XYZ-\d{9}$/) }));

    expect(sample).toEqual({ ok: false, where: ".code (string)" });
  });

  it("puts the first string or list it finds over its limit", () => {
    const request = z.tuple([z.uuid(), z.strictObject({ name: z.string().max(3) })]);
    const sample = sampleOf(request);
    if (!sample.ok) throw new Error("no sample");

    const over = overLimit(request, sample.value) as [string, { name: string }];

    expect(over[1].name).toBe("aaaa");
    expect(request.safeParse(over).success).toBe(false);
    expect(overLimit(z.tuple([z.uuid()]), ["00000000-0000-4000-8000-000000000001"])).toBe(
      undefined,
    );
  });
});
