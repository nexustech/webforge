import { describe, expect, it, vi } from "vitest";
import { emitter, memoByDocs, viewportOf } from "./engine-support.js";

describe("the Puck engine's helpers (R8)", () => {
  it("makes a value again only when the page, layout or shared sections change", () => {
    const make = vi.fn((docs: { page: object; layout: object; shared: object }) => ({ docs }));
    const memo = memoByDocs(make);
    const docs = { page: {}, layout: {}, shared: {} };

    const first = memo(docs);
    expect(memo({ ...docs })).toBe(first);
    expect(memo({ ...docs, layout: {} })).not.toBe(first);
    expect(make).toHaveBeenCalledTimes(2);
  });

  it("names a device view by its width, else gives the width", () => {
    expect(viewportOf(768)).toBe("tablet");
    expect(viewportOf(900)).toBe(900);
  });

  it("calls each listener until it is removed", () => {
    const events = emitter<number>();
    const heard: number[] = [];
    const remove = events.add((value) => heard.push(value));

    events.emit(1);
    remove();
    events.emit(2);

    expect(heard).toEqual([1]);
  });
});
