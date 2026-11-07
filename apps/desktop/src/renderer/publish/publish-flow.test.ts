import { createSite, type MediaId, type PublishDestination, type SiteDoc } from "@webforge/model";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishApi, PublishProgress, PublishResult } from "../../shared/ipc/publish.js";
import type { CodeDecision } from "../editor/code-trust.js";
import { setFailureLog } from "../log.js";
import {
  type PublishFlow,
  publishFailure,
  publishProgressText,
  publishTo,
} from "./publish-flow.js";

const toast = vi.hoisted(() => ({
  loading: vi.fn((..._args: unknown[]) => "progress"),
  success: vi.fn(),
  error: vi.fn(),
  dismiss: vi.fn(),
}));
vi.mock("@webforge/editor-ui", () => ({ toast }));

beforeEach(() => vi.clearAllMocks());

/** The owner trusts all of the site's code, or has none to be asked about (#649). */
const GO: CodeDecision = { go: true, keeps: () => true, allowListConfirmed: true };
const SESSION = "0c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";

const destination: PublishDestination = {
  id: "6f1c1b6e-8a3e-4c1e-9d55-2f5c1e0a7b10",
  name: "Live",
  kind: "file-transfer",
  settings: {
    protocol: "sftp",
    host: "sftp.example.com",
    user: "rosa",
    folder: "/",
    signIn: "password",
  },
};

/** A site Site Check lets publish: it has its web address (X3). */
const publishable = (): SiteDoc => {
  const site = createSite({
    name: "Bakery",
    language: "en",
    homeTitle: "Home",
    notFoundTitle: "Not found",
  });
  site.settings.address.url = "https://bakery.example";
  return site;
};

const LIVE: Extract<PublishResult, { status: "published" }> = {
  status: "published",
  url: "https://bakery.example/",
  check: "live",
  uploaded: 12,
  unchanged: 3,
  removed: 1,
  versionSaved: true,
};

/** A flow over `site`, main answering each publish in turn from `results`; every step a spy. */
function flowOf({
  site = publishable(),
  results = [LIVE],
  code = GO,
  replace = true,
}: {
  readonly site?: SiteDoc;
  readonly results?: PublishResult[];
  readonly code?: CodeDecision;
  readonly replace?: boolean;
} = {}) {
  // What happened, in order.
  const order: string[] = [];
  let progressListener: ((operationId: string, progress: PublishProgress) => void) | undefined;
  const answers = [...results];
  const api = {
    publish: vi.fn<PublishApi["publish"]>(async (_session, _destination, operationId) => {
      order.push("publish");
      progressListener?.(operationId, { stage: "uploading", done: 0, total: 12 });
      // Another publish's progress isn't this one's.
      progressListener?.("1d2e3f40-5b6c-4d7e-8f80-9a0b1c2d3e4f", { stage: "verifying" });
      return answers.shift() ?? LIVE;
    }),
    cancel: vi.fn<PublishApi["cancel"]>(async () => null),
    onProgress: vi.fn<PublishApi["onProgress"]>((listener) => {
      progressListener = listener;
      return () => {
        progressListener = undefined;
      };
    }),
  };
  const flow = {
    site: () => site,
    flushCanvas: vi.fn(() => {
      order.push("flush");
    }),
    confirmCode: vi.fn(async () => code),
    showSiteCheck: vi.fn(),
    api,
    sessionId: () => SESSION,
    askReplace: vi.fn(async () => replace),
    showLive: vi.fn(),
    showDestinations: vi.fn(),
  } satisfies PublishFlow;
  return { flow, api, order };
}

describe("publishTo (4.5, F-PB-2)", () => {
  it("ends the canvas's edit before it publishes, then shows the site live", async () => {
    const { flow, api, order } = flowOf();
    await publishTo(flow, destination);

    expect(order).toEqual(["flush", "publish"]);
    const [session, destinationId, operationId, options] = api.publish.mock.calls[0] ?? [];
    expect([session, destinationId, options]).toEqual([
      SESSION,
      destination.id,
      { replaceOtherSite: false },
    ]);
    // Its own progress only, then the toast goes for Your site is live.
    expect(toast.loading).toHaveBeenLastCalledWith(
      "Publishing…",
      expect.objectContaining({ description: "Sending file 1 of 12" }),
    );
    expect(toast.dismiss).toHaveBeenCalledWith("progress");
    const { status: _published, ...live } = LIVE;
    expect(flow.showLive).toHaveBeenCalledWith({ ...live, operationId });
    expect(api.onProgress.mock.results[0]?.value).toBeTypeOf("function");
  });

  it("stops before anything is built while Site Check has something to fix (X5)", async () => {
    const site = publishable();
    site.settings.address = {};
    const { flow, api } = flowOf({ site });
    await publishTo(flow, destination);

    expect(api.publish).not.toHaveBeenCalled();
    expect(flow.flushCanvas).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/^Fix \d+ things? in Site Check before publishing$/),
    );
    expect(flow.showSiteCheck).toHaveBeenCalled();
  });

  it("publishes nothing when the owner stops at the question about the site's code (#649)", async () => {
    const { flow, api } = flowOf({ code: { go: false } });
    await publishTo(flow, destination);
    expect(api.publish).not.toHaveBeenCalled();
  });

  it("asks before replacing another site in the folder, then publishes over it (A8)", async () => {
    const { flow, api } = flowOf({
      results: [{ status: "failed", reason: "other-site" }, LIVE],
    });
    await publishTo(flow, destination);

    expect(flow.askReplace).toHaveBeenCalledWith("Live");
    expect(api.publish.mock.calls.map((call) => call[3])).toEqual([
      { replaceOtherSite: false },
      { replaceOtherSite: true },
    ]);
    // Each try is a publish of its own.
    expect(api.publish.mock.calls[0]?.[2]).not.toBe(api.publish.mock.calls[1]?.[2]);
    expect(flow.showLive).toHaveBeenCalled();
  });

  it("leaves the other site be when the person says no", async () => {
    const { flow, api } = flowOf({
      results: [{ status: "failed", reason: "other-site" }],
      replace: false,
    });
    await publishTo(flow, destination);
    expect(api.publish).toHaveBeenCalledOnce();
    expect(flow.showLive).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("says what main's gate found, and shows Site Check", async () => {
    const { flow } = flowOf({ results: [{ status: "must-fix", count: 2 }] });
    await publishTo(flow, destination);
    expect(toast.error).toHaveBeenCalledWith(
      "Fix 2 things in Site Check before publishing",
      expect.objectContaining({ id: "progress" }),
    );
    expect(flow.showSiteCheck).toHaveBeenCalled();
  });

  it("asks for the password again in the destinations", async () => {
    const { flow } = flowOf({ results: [{ status: "sign-in-needed" }] });
    await publishTo(flow, destination);
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Type the password again"),
      expect.objectContaining({ id: "progress", action: null }),
    );
    expect(flow.showDestinations).toHaveBeenCalled();
  });

  it("says nothing more when the person cancels", async () => {
    const { flow } = flowOf({ results: [{ status: "cancelled" }] });
    await publishTo(flow, destination);
    expect(toast.dismiss).toHaveBeenCalledWith("progress");
    expect(toast.error).not.toHaveBeenCalled();
    expect(flow.showLive).not.toHaveBeenCalled();
  });

  it("cancels its own publish from the toast's Cancel", async () => {
    const { flow, api } = flowOf();
    let release: (result: PublishResult) => void = () => undefined;
    api.publish.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const publishing = publishTo(flow, destination);
    await vi.waitFor(() => expect(api.publish).toHaveBeenCalled());
    const options = toast.loading.mock.calls[0]?.[1] as {
      action: { onClick: (event: { preventDefault(): void }) => void };
    };
    options.action.onClick({ preventDefault: () => undefined });
    expect(api.cancel).toHaveBeenCalledWith(api.publish.mock.calls[0]?.[2]);
    release({ status: "cancelled" });
    await publishing;
  });

  it("says what went wrong, and what to do", async () => {
    const { flow } = flowOf({ results: [{ status: "failed", reason: "unauthorized" }] });
    await publishTo(flow, destination);
    expect(toast.error).toHaveBeenCalledWith(
      "Your host refused the user name or password. Edit the destination to check them.",
      expect.objectContaining({ id: "progress", description: null }),
    );
  });

  it("says so when the call itself fails, and reports it", async () => {
    const failures: string[] = [];
    setFailureLog(async (context) => {
      failures.push(context);
    });
    const { flow, api } = flowOf();
    api.publish.mockRejectedValueOnce(new Error("gone"));
    await publishTo(flow, destination);
    expect(failures).toContain("publish");
    expect(toast.error).toHaveBeenCalledWith(
      "Publishing didn't work. Publish again.",
      expect.anything(),
    );
    setFailureLog(undefined);
  });
});

describe("publishFailure", () => {
  it("names the page to rename, and the image to replace as Media shows it", () => {
    const photo = "photo" as MediaId;
    const site: SiteDoc = {
      ...publishable(),
      media: {
        [photo]: {
          id: photo,
          kind: "image",
          hash: "a".repeat(64),
          name: "shop",
          fileName: "Shop front.png",
          mimeType: "image/png",
          width: 30_000,
          height: 30_000,
          alt: "",
        },
      },
    };
    expect(
      publishFailure({ status: "failed", reason: "reserved-name", page: "Contact" }, site),
    ).toContain("The page “Contact” can't be published");
    expect(
      publishFailure({ status: "failed", reason: "unreadable-image", image: "photo" }, site),
    ).toContain("The image “Shop front.png” can't be published");
  });
});

describe("publishProgressText", () => {
  it("counts from 1, and names the other stages", () => {
    expect(publishProgressText({ stage: "images", done: 0, total: 3 })).toBe(
      "Preparing image 1 of 3",
    );
    expect(publishProgressText({ stage: "uploading", done: 11, total: 12 })).toBe(
      "Sending file 12 of 12",
    );
    expect(publishProgressText({ stage: "preparing" })).toBe("Comparing with what's on your host");
    expect(publishProgressText({ stage: "verifying" })).toBe("Checking your site is live");
  });
});
