import { describe, expect, it } from "vitest";
import { FAKE_TOKEN, fakeNetlify } from "./fake-netlify.test-helper.js";
import { netlifyClient, netlifyPublisher } from "./netlify.js";
import type { BuildOutput, PublishEvent } from "./publisher.js";

const bytes = (text: string) => new TextEncoder().encode(text);
const build = (files: Record<string, string>): BuildOutput => ({
  files: new Map(Object.entries(files).map(([path, text]) => [path, bytes(text)])),
});
const site = {
  "index.html": "<h1>Rosa's Bakery</h1>",
  "about.html": "<h1>About us</h1>",
  "assets/css/site.css": "body { color: brown }",
  "assets/img/logo.webp": "logo",
};

async function collect(events: AsyncIterable<PublishEvent>): Promise<PublishEvent[]> {
  const all: PublishEvent[] = [];
  for await (const event of events) all.push(event);
  return all;
}

async function setUp() {
  const netlify = fakeNetlify();
  const options = { token: FAKE_TOKEN, fetch: netlify.fetch, pollIntervalMs: 1, retryBaseMs: 1 };
  const client = netlifyClient(options);
  const { id: siteId } = await client.createSite("rosas-bakery");
  return { netlify, client, publisher: netlifyPublisher(options), siteId };
}

const signal = () => new AbortController().signal;

describe("netlifyPublisher.publish", () => {
  it("uploads every file on the first deploy, assets first and index.html last", async () => {
    const { netlify, publisher, siteId } = await setUp();

    const events = await collect(publisher.publish(build(site), { siteId }, signal()));

    expect(netlify.uploads()).toEqual([
      "assets/css/site.css",
      "assets/img/logo.webp",
      "about.html",
      "index.html",
    ]);
    expect(events[0]).toEqual({ type: "preparing" });
    expect(events.filter((e) => e.type === "uploading")).toHaveLength(4);
    expect(events.at(-1)).toEqual({
      type: "published",
      url: "https://rosas-bakery.netlify.app",
      uploaded: 4,
      unchanged: 0,
      removed: 0,
    });
    expect(netlify.live(siteId, "index.html")).toBe(site["index.html"]);
  });

  it("uploads only the changed file when re-deploying", async () => {
    const { netlify, publisher, siteId } = await setUp();
    await collect(publisher.publish(build(site), { siteId }, signal()));
    netlify.requests.length = 0;

    const edited = { ...site, "about.html": "<h1>About Rosa</h1>" };
    const events = await collect(publisher.publish(build(edited), { siteId }, signal()));

    expect(netlify.uploads()).toEqual(["about.html"]);
    expect(events.at(-1)).toMatchObject({ uploaded: 1, unchanged: 3 });
    expect(netlify.live(siteId, "about.html")).toBe("<h1>About Rosa</h1>");
  });

  it("uploads files with the same content once", async () => {
    const { netlify, publisher, siteId } = await setUp();

    await collect(
      publisher.publish(build({ "a.html": "same", "b.html": "same" }), { siteId }, signal()),
    );

    expect(netlify.uploads()).toEqual(["a.html"]);
  });

  it("encodes paths with spaces and special characters", async () => {
    const { netlify, publisher, siteId } = await setUp();

    await collect(
      publisher.publish(build({ "assets/img/my photo#1.webp": "x" }), { siteId }, signal()),
    );

    expect(netlify.uploads()).toEqual(["assets/img/my%20photo%231.webp"]);
    expect(netlify.live(siteId, "assets/img/my photo#1.webp")).toBe("x");
  });

  it("waits while Netlify processes the deploy", async () => {
    const { netlify, publisher, siteId } = await setUp();
    netlify.processing(3);

    const events = await collect(publisher.publish(build(site), { siteId }, signal()));

    expect(events.at(-1)?.type).toBe("published");
    expect(
      netlify.requests.filter((r) => r.path.startsWith("/deploys/") && r.method === "GET"),
    ).toHaveLength(4);
  });

  it("fails when Netlify cannot process the deploy", async () => {
    const { netlify, publisher, siteId } = await setUp();
    netlify.processing(0, "error");

    await expect(
      collect(publisher.publish(build(site), { siteId }, signal())),
    ).rejects.toMatchObject({
      code: "rejected",
    });
  });

  it("gives up when the deploy does not finish in time", async () => {
    const netlify = fakeNetlify();
    const options = {
      token: FAKE_TOKEN,
      fetch: netlify.fetch,
      pollIntervalMs: 1,
      pollTimeoutMs: 5,
    };
    const { id: siteId } = await netlifyClient(options).createSite();
    netlify.processing(1_000_000);

    await expect(
      collect(netlifyPublisher(options).publish(build(site), { siteId }, signal())),
    ).rejects.toMatchObject({ code: "failed" });
  });

  it("stops when cancelled, before index.html goes up", async () => {
    const { netlify, publisher, siteId } = await setUp();
    const controller = new AbortController();

    const events: PublishEvent[] = [];
    const run = (async () => {
      for await (const event of publisher.publish(build(site), { siteId }, controller.signal)) {
        events.push(event);
        if (event.type === "uploading" && event.path === "about.html") controller.abort();
      }
    })();

    await expect(run).rejects.toMatchObject({ code: "cancelled" });
    expect(netlify.uploads()).not.toContain("index.html");
    expect(netlify.live(siteId, "index.html")).toBeUndefined();
  });

  it("stops while waiting for Netlify when cancelled", async () => {
    const netlify = fakeNetlify();
    const options = { token: FAKE_TOKEN, fetch: netlify.fetch, pollIntervalMs: 60_000 };
    const { id: siteId } = await netlifyClient(options).createSite();
    const controller = new AbortController();

    const run = collect(
      netlifyPublisher(options).publish(build(site), { siteId }, controller.signal),
    );
    setTimeout(() => controller.abort(), 20);

    await expect(run).rejects.toMatchObject({ code: "cancelled" });
  });

  it.each([
    [401, "unauthorized"],
    [403, "unauthorized"],
    [404, "not-found"],
    [422, "rejected"],
    [429, "rate-limited"],
    [500, "failed"],
  ] as const)("reports Netlify's %i as %s", async (status, code) => {
    const { netlify, publisher, siteId } = await setUp();
    // 429 and 5xx are retried three times before they count.
    netlify.failNext("PUT", /\/files\//, status, { times: 4 });

    await expect(
      collect(publisher.publish(build(site), { siteId }, signal())),
    ).rejects.toMatchObject({
      name: "PublishError",
      code,
    });
  });

  it("waits out Netlify's rate limit and carries on", async () => {
    const { netlify, publisher, siteId } = await setUp();
    netlify.failNext("PUT", /\/files\//, 429, { times: 2, headers: { "Retry-After": "0" } });
    netlify.failNext("POST", /\/deploys$/, 429, {
      headers: { "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) - 1) },
    });

    const events = await collect(publisher.publish(build(site), { siteId }, signal()));

    expect(events.at(-1)).toMatchObject({ type: "published", uploaded: 4 });
  });

  it("retries an upload after a network error or a 5xx", async () => {
    const { netlify, publisher, siteId } = await setUp();
    netlify.failNext("PUT", /\/files\//, "network");
    netlify.failNext("PUT", /\/files\//, 503);

    const events = await collect(publisher.publish(build(site), { siteId }, signal()));

    expect(events.at(-1)).toMatchObject({ type: "published", uploaded: 4 });
  });

  it("does not retry starting a deploy that failed with a 5xx, which may have happened", async () => {
    const { netlify, publisher, siteId } = await setUp();
    netlify.failNext("POST", /\/deploys$/, 502);

    await expect(
      collect(publisher.publish(build(site), { siteId }, signal())),
    ).rejects.toMatchObject({
      code: "failed",
    });
    expect(
      netlify.requests.filter((r) => r.method === "POST" && r.path.endsWith("/deploys")),
    ).toHaveLength(1);
  });

  it("stops retrying when cancelled", async () => {
    const netlify = fakeNetlify();
    const options = { token: FAKE_TOKEN, fetch: netlify.fetch, retryBaseMs: 60_000 };
    const { id: siteId } = await netlifyClient(options).createSite();
    netlify.failNext("PUT", /\/files\//, "network");
    const controller = new AbortController();

    const run = collect(
      netlifyPublisher(options).publish(build(site), { siteId }, controller.signal),
    );
    setTimeout(() => controller.abort(), 20);

    await expect(run).rejects.toMatchObject({ code: "cancelled" });
  });

  it("never puts the token in error messages", async () => {
    const { netlify, publisher, siteId } = await setUp();
    netlify.failNext("POST", /\/deploys$/, 500);

    const error = await collect(publisher.publish(build(site), { siteId }, signal())).catch(
      (e: unknown) => e,
    );

    expect(String((error as Error).message)).not.toContain(FAKE_TOKEN);
    expect((error as Error).message).toBe("Netlify answered 500 to POST /sites/site-1/deploys");
  });
});

describe("netlifyPublisher.test", () => {
  it("passes for a site the token can reach", async () => {
    const { publisher, siteId } = await setUp();

    await expect(publisher.test({ siteId })).resolves.toEqual({ ok: true });
  });

  it("reports a missing site or a refused token", async () => {
    const netlify = fakeNetlify();

    await expect(
      netlifyPublisher({ token: FAKE_TOKEN, fetch: netlify.fetch }).test({ siteId: "gone" }),
    ).resolves.toEqual({ ok: false, code: "not-found" });
    await expect(
      netlifyPublisher({ token: "wrong", fetch: netlify.fetch }).test({ siteId: "gone" }),
    ).resolves.toEqual({ ok: false, code: "unauthorized" });
  });

  it("reports an unreachable Netlify as a network problem", async () => {
    const offline: typeof fetch = () => Promise.reject(new TypeError("fetch failed"));

    await expect(
      netlifyPublisher({ token: FAKE_TOKEN, fetch: offline, retryBaseMs: 1 }).test({ siteId: "s" }),
    ).resolves.toEqual({
      ok: false,
      code: "network",
    });
  });
});

describe("netlifyClient", () => {
  it("lists sites and the signed-in user", async () => {
    const { client } = await setUp();

    await expect(client.currentUser()).resolves.toEqual({ id: "user-1" });
    await expect(client.listSites()).resolves.toEqual([
      expect.objectContaining({
        name: "rosas-bakery",
        ssl_url: "https://rosas-bakery.netlify.app",
      }),
    ]);
  });

  it("restores an earlier deploy", async () => {
    const { netlify, client, publisher, siteId } = await setUp();
    await collect(publisher.publish(build(site), { siteId }, signal()));
    await collect(
      publisher.publish(build({ ...site, "index.html": "<h1>New</h1>" }), { siteId }, signal()),
    );
    const [latest, first] = await client.listDeploys(siteId);
    expect(latest?.id).not.toBe(first?.id);

    const restored = await client.restoreDeploy(siteId, first?.id ?? "");

    expect(restored.state).toBe("current");
    expect(netlify.live(siteId, "index.html")).toBe(site["index.html"]);
  });

  it("lists the forms Netlify detected", async () => {
    const { client, publisher, siteId } = await setUp();
    const contact = '<form name="contact" method="POST" data-netlify="true"></form>';
    await collect(
      publisher.publish(build({ ...site, "contact.html": contact }), { siteId }, signal()),
    );

    await expect(client.listForms(siteId)).resolves.toEqual([
      { id: "form-contact", name: "contact", paths: ["/contact.html"] },
    ]);
  });

  it("rejects a response it does not understand", async () => {
    const odd: typeof fetch = async () => new Response(JSON.stringify({ unexpected: true }));

    await expect(
      netlifyClient({ token: FAKE_TOKEN, fetch: odd }).getSite("s"),
    ).rejects.toMatchObject({
      code: "failed",
      message: "Netlify sent an unexpected response to GET /sites/s",
    });
  });

  it("rejects a response that is not JSON", async () => {
    const html: typeof fetch = async () => new Response("<html>maintenance</html>");

    await expect(
      netlifyClient({ token: FAKE_TOKEN, fetch: html }).currentUser(),
    ).rejects.toMatchObject({
      code: "failed",
    });
  });
});
