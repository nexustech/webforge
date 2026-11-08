import { FAKE_TOKEN, fakeNetlify } from "@webforge/test-utils/netlify";
import { describe, expect, it } from "vitest";
import { netlifyClient, netlifyPublisher, netlifySiteAccess } from "./netlify.js";
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
      // The deploy, for the check that follows.
      version: expect.any(String),
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
    ).rejects.toMatchObject({ code: "timeout" });
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
    expect((error as Error).message).toBe(`Netlify answered 500 to POST /sites/${siteId}/deploys`);
  });
});

describe("netlifyPublisher.restore (#70)", () => {
  /** The deploy id a publish of `files` went live as. */
  async function deployOf(
    publisher: Awaited<ReturnType<typeof setUp>>["publisher"],
    siteId: string,
    files: Record<string, string>,
  ) {
    const events = await collect(publisher.publish(build(files), { siteId }, signal()));
    const published = events.find((event) => event.type === "published");
    if (published?.type !== "published" || published.version === undefined) {
      throw new Error("not published");
    }
    return published.version;
  }

  it("puts an earlier deploy Netlify still keeps back live, sending nothing", async () => {
    const { netlify, publisher, siteId } = await setUp();
    const first = await deployOf(publisher, siteId, site);
    await deployOf(publisher, siteId, { ...site, "index.html": "<h1>New menu</h1>" });
    const sent = netlify.uploads().length;

    const restored = await publisher.restore?.(first, { siteId }, signal());

    expect(restored).toEqual({
      type: "published",
      url: "https://rosas-bakery.netlify.app",
      uploaded: 0,
      unchanged: 0,
      removed: 0,
      version: first,
      restored: true,
    });
    expect(netlify.live(siteId, "index.html")).toBe("<h1>Rosa's Bakery</h1>");
    expect(netlify.uploads()).toHaveLength(sent);
    // Netlify itself says it's the deploy the site serves.
    if (restored === undefined) throw new Error("not restored");
    expect(await publisher.verify?.(restored, { siteId }, signal())).toEqual({ status: "live" });
  });

  it("gives nothing for a deploy Netlify no longer keeps, or never made, restoring nothing", async () => {
    const { netlify, publisher, siteId } = await setUp();
    const first = await deployOf(publisher, siteId, site);
    await deployOf(publisher, siteId, { ...site, "index.html": "<h1>New menu</h1>" });
    netlify.dropDeploy(first);

    expect(await publisher.restore?.(first, { siteId }, signal())).toBeUndefined();
    expect(await publisher.restore?.("no-such-deploy", { siteId }, signal())).toBeUndefined();
    expect(netlify.live(siteId, "index.html")).toBe("<h1>New menu</h1>");
    expect(netlify.requests.some(({ path }) => path.endsWith("/restore"))).toBe(false);
  });
});

describe("netlifySiteAccess (4.4b's warning, #70)", () => {
  /** A Netlify site, and its own address answering `answer` (or failing, or never answering). */
  async function siteAnswering(answer: Response | "fails" | "hangs") {
    const netlify = fakeNetlify();
    const options = { token: FAKE_TOKEN, fetch: netlify.fetch, retryBaseMs: 1 };
    const { id: siteId } = await netlifyClient(options).createSite("rosas-bakery");
    const asked: { url: string; redirect: RequestInit["redirect"] }[] = [];
    const fetchSite: typeof fetch = async (input, init) => {
      asked.push({ url: String(input), redirect: init?.redirect });
      if (answer === "fails") throw new TypeError("fetch failed");
      if (answer === "hangs") {
        return new Promise((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
        );
      }
      return answer;
    };
    return { siteId, asked, options: { ...options, fetchSite, timeoutMs: 50 } };
  }
  const redirect = (location: string) =>
    new Response(null, { status: 302, headers: { Location: location } });

  it("is protected when visitors are sent to Netlify's login, asking the site's own address", async () => {
    const { siteId, asked, options } = await siteAnswering(
      redirect("https://app.netlify.com/edge-access/rosas?redirect=%2F"),
    );

    expect(await netlifySiteAccess(siteId, options)).toBe("protected");
    // Netlify's record of the site names the address; the redirect isn't followed.
    expect(asked).toEqual([{ url: "https://rosas-bakery.netlify.app", redirect: "manual" }]);
  });

  it("is public for the site itself, or a redirect anywhere else", async () => {
    for (const answer of [
      new Response("<h1>Rosa's Bakery</h1>", { status: 200 }),
      new Response(null, { status: 404 }),
      redirect("https://www.rosasbakery.co.uk/"),
      redirect("https://app.netlify.com/login"),
      redirect("https://evil.example/edge-access/x"),
      new Response(null, { status: 301 }),
    ]) {
      const { siteId, options } = await siteAnswering(answer);
      expect(await netlifySiteAccess(siteId, options)).toBe("public");
    }
  });

  it("fails, naming no address, when the site can't be asked or doesn't answer in time", async () => {
    const failing = await siteAnswering("fails");
    const error = await netlifySiteAccess(failing.siteId, failing.options).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "network" });
    expect(String((error as Error).message)).not.toContain("netlify.app");

    const hanging = await siteAnswering("hangs");
    await expect(netlifySiteAccess(hanging.siteId, hanging.options)).rejects.toMatchObject({
      code: "timeout",
    });
    // A site Netlify doesn't know: as its API says.
    await expect(
      netlifySiteAccess("00000000-0000-4000-8000-0000000000ff", failing.options),
    ).rejects.toMatchObject({ code: "not-found" });
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

  it("checks through Netlify that the deploy just made is the one the site serves (#600 review)", async () => {
    const { netlify, client, publisher, siteId } = await setUp();
    const last = async (files: Record<string, string>) => {
      const event = (await collect(publisher.publish(build(files), { siteId }, signal()))).at(-1);
      if (event?.type !== "published") throw new Error("not published");
      return event;
    };
    const first = await last(site);
    const second = await last({ ...site, "about.html": "<h1>About us, again</h1>" });

    expect(second.version).toBeDefined();
    expect(await publisher.verify?.(second, { siteId }, signal())).toEqual({ status: "live" });
    // Another deploy published since: the one just made isn't what the site serves.
    await client.restoreDeploy(siteId, first.version ?? "");
    expect(await publisher.verify?.(second, { siteId }, signal())).toEqual({
      status: "different",
    });
    // Netlify not answering, whatever the retries.
    netlify.failNext("GET", /^\/sites\//, "network", { times: 20 });
    expect(await publisher.verify?.(second, { siteId }, signal())).toEqual({
      status: "unreachable",
    });
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
