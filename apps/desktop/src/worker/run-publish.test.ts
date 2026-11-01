import { createHash } from "node:crypto";
import { createSite, type PublishDestination, type SiteDoc } from "@webforge/model";
import { createPipeline } from "@webforge/pipeline";
import { loadNodeResources } from "@webforge/pipeline/node";
import { type DestinationPublisher, PublishError, type publisherFor } from "@webforge/publish";
import { siteLibrary } from "@webforge/site-components";
import { fontFacesFor } from "@webforge/themes";
import { describe, expect, it, vi } from "vitest";
import type { PublishJob } from "../shared/export-worker-protocol.js";
import { type PublishChannel, runPublish } from "./run-publish.js";

const destination: PublishDestination = {
  id: "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10",
  name: "Live",
  kind: "file-transfer",
  settings: { protocol: "ftps", host: "ftp.example.com", user: "rosa", folder: "/" },
};
const TRUSTED = "<script>trusted()</script>";
const UNTRUSTED = "<script>untrusted()</script>";
const hashOf = (text: string) => createHash("sha256").update(text).digest("hex");

/** A new site whose Custom Code has a trusted head and an untrusted end of page. */
function site(): SiteDoc {
  const doc = createSite({
    name: "Rosa's",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Oops",
  });
  doc.code = { ...doc.code, head: TRUSTED, bodyEnd: UNTRUSTED };
  return doc;
}

/** A publish of `doc`, with its font files as the main process sends them. */
async function job(doc: SiteDoc): Promise<PublishJob> {
  const { readFont } = await loadNodeResources();
  const fonts = await Promise.all(
    fontFacesFor(doc.theme).map(async (face) => ({
      file: face.file,
      data: (await readFont(face)) ?? new Uint8Array(),
    })),
  );
  return {
    type: "publish",
    site: doc,
    destination,
    signIn: { password: "test-only-password" },
    trust: {},
    target: { site: { projectId: "rosas-bakery", destinationId: destination.id } },
    trustedCode: [hashOf(TRUSTED)],
    fonts,
    families: [],
  };
}

/** A publisher that takes what it's given and says it went live, or throws `error`. */
function fakePublisher(error?: PublishError) {
  const sent: { files?: ReadonlyMap<string, Uint8Array> } = {};
  const publisher: DestinationPublisher = {
    test: async () => ({ ok: true }),
    async *publish(build) {
      sent.files = build.files;
      yield { type: "preparing" };
      if (error !== undefined) throw error;
      yield { type: "uploading", path: "index.html", done: 1, total: 2 };
      yield {
        type: "published",
        url: "https://rosas.example/",
        uploaded: 2,
        unchanged: 0,
        removed: 1,
      };
      yield { type: "verifying", url: "https://rosas.example/" };
      yield { type: "verified", url: "https://rosas.example/", result: { status: "live" } };
    },
  };
  const make = vi.fn<typeof publisherFor>(() => publisher);
  return { sent, make };
}

function channel(make: typeof publisherFor, signal = new AbortController().signal): PublishChannel {
  return {
    readMedia: async () => undefined,
    signal,
    pipeline: createPipeline(siteLibrary),
    library: siteLibrary,
    publisherFor: make,
  };
}

describe("runPublish (4.5, ADR 0018 §1)", () => {
  it("builds the site, sends it with the job's sign-in, and says what went live", async () => {
    const { sent, make } = fakePublisher();
    const stages: string[] = [];
    const publishing = await job(site());

    const outcome = await runPublish(publishing, loadNodeResources, {
      ...channel(make),
      onProgress: (progress) => stages.push(progress.stage),
    });

    expect(outcome).toMatchObject({
      type: "published",
      url: "https://rosas.example/",
      uploaded: 2,
      removed: 1,
      check: "live",
    });
    expect(make).toHaveBeenCalledWith(destination, publishing.signIn, publishing.trust);
    expect(stages).toEqual(
      expect.arrayContaining(["pages", "preparing", "uploading", "verifying"]),
    );
    // The code its owner trusts is built; the rest is left blank (#649).
    const home = new TextDecoder().decode(sent.files?.get("index.html"));
    expect(home).toContain("trusted()");
    expect(home).not.toContain("untrusted()");
  }, 60_000);

  it("answers the publisher's failure by its code, and a cancel as cancelled", async () => {
    const otherSite = fakePublisher(new PublishError("other-site", "another project's folder"));
    expect(await runPublish(await job(site()), loadNodeResources, channel(otherSite.make))).toEqual(
      {
        type: "failed",
        code: "other-site",
        detail: "other-site",
      },
    );

    const cancelled = fakePublisher(new PublishError("cancelled", "cancelled"));
    expect(await runPublish(await job(site()), loadNodeResources, channel(cancelled.make))).toEqual(
      {
        type: "cancelled",
      },
    );
  }, 60_000);

  it("stops a cancelled build before anything is sent", async () => {
    const { make } = fakePublisher();
    const stop = new AbortController();
    stop.abort();

    expect(
      await runPublish(await job(site()), loadNodeResources, channel(make, stop.signal)),
    ).toEqual({ type: "cancelled" });
    expect(make).not.toHaveBeenCalled();
  }, 60_000);
});
