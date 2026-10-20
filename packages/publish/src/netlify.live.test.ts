import { describe, expect, it } from "vitest";
import { netlifyClient, netlifyPublisher } from "./netlify.js";
import type { BuildOutput, PublishEvent } from "./publisher.js";

// Live check against a real Netlify site (spec/04 item 0.2, ADR 0006). Skipped unless both
// variables are set, so CI never runs it. Use a throwaway test site: this deploys to it twice and
// restores the first deploy.
//
//   NETLIFY_AUTH_TOKEN=… NETLIFY_SITE_ID=… pnpm vitest run packages/publish/src/netlify.live.test.ts
//
// The token is read from the environment only; it is never logged or written anywhere.

const token = process.env.NETLIFY_AUTH_TOKEN ?? "";
const siteId = process.env.NETLIFY_SITE_ID ?? "";

const bytes = (text: string) => new TextEncoder().encode(text);
const build = (files: Record<string, string>): BuildOutput => ({
  files: new Map(Object.entries(files).map(([path, text]) => [path, bytes(text)])),
});

async function publish(files: Record<string, string>) {
  let last: PublishEvent | undefined;
  for await (const event of netlifyPublisher({ token }).publish(
    build(files),
    { siteId },
    AbortSignal.timeout(120_000),
  )) {
    last = event;
  }
  if (last?.type !== "published") throw new Error("No published event");
  return last;
}

/** Fetches `url` until it returns `expected`; the CDN can take a moment to switch deploys. */
async function waitForContent(url: string, expected: string): Promise<string> {
  let text = "";
  for (let attempt = 0; attempt < 15; attempt++) {
    text = await (await fetch(url, { cache: "no-store" })).text();
    if (text === expected) break;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return text;
}

describe.skipIf(token === "" || siteId === "")("Netlify live check", () => {
  it("deploys, re-deploys only the changed file, restores, and lists forms", {
    timeout: 300_000,
  }, async () => {
    // A fresh run id, so the first deploy has files Netlify doesn't have yet.
    const run = Date.now().toString(36);
    const v1 = {
      "index.html": `<!doctype html><title>Webforge live check</title><p>Run ${run}</p><a href="about.html">About</a>`,
      "about.html": `<!doctype html><title>About</title><p>About, version 1 of ${run}</p>`,
      "contact.html": `<!doctype html><title>Contact</title><form name="contact-${run}" method="POST" data-netlify="true"><input name="email" type="email"><button>Send</button></form>`,
      "assets/css/site.css": `/* ${run} */ body { font-family: sans-serif }`,
    };
    const v2 = {
      ...v1,
      "about.html": `<!doctype html><title>About</title><p>About, version 2 of ${run}</p>`,
    };

    const first = await publish(v1);
    const second = await publish(v2);
    console.log(
      `First deploy: ${first.uploaded} uploaded. Re-deploy: ${second.uploaded} uploaded.`,
    );
    expect(first.uploaded).toBe(4);
    expect(second.uploaded).toBe(1);
    expect(await waitForContent(`${second.url}/about.html`, v2["about.html"])).toBe(
      v2["about.html"],
    );

    const client = netlifyClient({ token });
    const deploys = await client.listDeploys(siteId);
    const firstDeploy = deploys.find((d) => d.state === "ready" && d.id !== deploys[0]?.id);
    expect(firstDeploy).toBeDefined();
    await client.restoreDeploy(siteId, firstDeploy?.id ?? "");
    expect(await waitForContent(`${second.url}/about.html`, v1["about.html"])).toBe(
      v1["about.html"],
    );
    console.log("Restore: the first deploy is live again.");

    const forms = await client.listForms(siteId);
    const detected = forms.some((form) => form.name === `contact-${run}`);
    // Reported, not asserted: detection depends on the site's "Form detection" setting (ADR 0006).
    console.log(`Netlify Forms detected the API-deployed form: ${detected ? "yes" : "no"}.`);
  });
});
