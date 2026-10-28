import type { Finding } from "@webforge/site-check";
import { describe, expect, it, vi } from "vitest";
import type { BundleResult } from "../../shared/ipc/site.js";
import { sessionWith } from "../testing/fixtures.js";
import { type BundleActions, canBundle, createBundleConfirm, downloadAndBundle } from "./bundle.js";

const WIDGET = "https://cdn.example.com/widget.js";

/** A finding of a file from another website. */
const finding = (
  values: Finding["values"],
  place: Finding["place"] = { kind: "code", part: "head" },
) => ({ key: "k", place, values }) as Finding;

const kept = (url: string, file: string) => ({
  url,
  file,
  hash: "d".repeat(64),
  mime: "text/javascript",
});

/** Download and bundle with `answer` to its question and `result` from the download. */
function bundleWith(
  answer: boolean,
  result: BundleResult,
): BundleActions & {
  readonly download: ReturnType<typeof vi.fn>;
  readonly notify: ReturnType<typeof vi.fn>;
} {
  return {
    confirm: vi.fn(async () => answer),
    download: vi.fn(async () => result),
    notify: vi.fn(),
  };
}

describe("canBundle (3.9)", () => {
  it("offers to keep an https:// script, stylesheet, font, image or media file", () => {
    expect(canBundle(finding({ url: WIDGET, kind: "script" }))).toBe(true);
    expect(canBundle(finding({ url: "//img.example.com/a.png", kind: "image" }))).toBe(true);
  });

  it("doesn't for an http:// file, a frame, or a file a script names", () => {
    expect(canBundle(finding({ url: "http://cdn.example.com/a.js", kind: "script" }))).toBe(false);
    expect(canBundle(finding({ url: "https://maps.example.com/", kind: "frame" }))).toBe(false);
    expect(canBundle(finding({ url: WIDGET, kind: "script" }, { kind: "code", part: "js" }))).toBe(
      false,
    );
  });
});

describe("downloadAndBundle (3.9)", () => {
  it("downloads nothing until the person says yes", async () => {
    const session = sessionWith();
    const bundle = bundleWith(false, { status: "bundled", files: [kept(WIDGET, "w-1.js")] });

    await downloadAndBundle(session, bundle, WIDGET);

    expect(bundle.download).not.toHaveBeenCalled();
    expect(session.history.document.getState().code.bundled).toBeUndefined();
  });

  it("keeps the downloaded files in the site's code as one undo step, replacing an older copy", async () => {
    const session = sessionWith();
    const first = bundleWith(true, { status: "bundled", files: [kept(WIDGET, "w-1.js")] });
    await downloadAndBundle(session, first, WIDGET);
    const again = bundleWith(true, { status: "bundled", files: [kept(WIDGET, "w-2.js")] });

    await downloadAndBundle(session, again, WIDGET);

    expect(session.history.document.getState().code.bundled).toEqual([kept(WIDGET, "w-2.js")]);
    expect(session.history.state.getState().entries.map((entry) => entry.label)).toEqual([
      "Kept a copy of a file from cdn.example.com",
      "Kept a copy of a file from cdn.example.com",
    ]);
    session.history.undo();
    session.history.undo();
    expect(session.history.document.getState().code.bundled).toBeUndefined();
  });

  it("says why when the file can't be kept, and changes nothing", async () => {
    const session = sessionWith();
    const bundle = bundleWith(true, { status: "failed", reason: "too-large" });

    await downloadAndBundle(session, bundle, WIDGET);

    expect(bundle.notify).toHaveBeenCalledWith(
      "The file is over 10 MB, too large to keep with your site.",
    );
    expect(session.history.state.getState().entries).toEqual([]);
  });
});

describe("createBundleConfirm", () => {
  it("asks one question at a time, and answers it", async () => {
    const question = createBundleConfirm();
    const first = question.confirm(WIDGET);
    const second = question.confirm("https://cdn.example.com/other.js");

    expect(await first).toBe(false);
    expect(question.state.getState().question?.url).toBe("https://cdn.example.com/other.js");
    question.state.getState().question?.answer(true);
    expect(await second).toBe(true);
    expect(question.state.getState().question).toBeNull();
  });
});
