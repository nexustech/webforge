import { describe, expect, it } from "vitest";
import { FAKE_CLIENT_ID, FAKE_TOKEN, fakeNetlify } from "./fake-netlify.test-helper.js";
import { signInToNetlify } from "./netlify-sign-in.js";

function setUp() {
  const netlify = fakeNetlify();
  const opened: string[] = [];
  const options = {
    clientId: FAKE_CLIENT_ID,
    fetch: netlify.fetch,
    pollIntervalMs: 1,
    retryBaseMs: 1,
    openUrl: async (url: string) => {
      opened.push(url);
    },
  };
  return { netlify, opened, options };
}

describe("signInToNetlify", () => {
  it("opens Netlify's approval page and returns the token once approved", async () => {
    const { netlify, opened, options } = setUp();
    netlify.approveTickets(3);

    const token = await signInToNetlify(options);

    expect(token).toBe(FAKE_TOKEN);
    expect(opened).toEqual([
      "https://app.netlify.com/authorize?response_type=ticket&ticket=ticket-1",
    ]);
    expect(netlify.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
      "POST /oauth/tickets",
      "GET /oauth/tickets/ticket-1",
      "GET /oauth/tickets/ticket-1",
      "GET /oauth/tickets/ticket-1",
      "POST /oauth/tickets/ticket-1/exchange",
    ]);
  });

  it("refuses an unknown client ID", async () => {
    const { options } = setUp();

    await expect(signInToNetlify({ ...options, clientId: "unknown" })).rejects.toMatchObject({
      code: "unauthorized",
    });
  });

  it("gives up when the user does not approve in time", async () => {
    const { netlify, options } = setUp();
    netlify.approveTickets(null);

    await expect(signInToNetlify({ ...options, timeoutMs: 10 })).rejects.toMatchObject({
      code: "failed",
      message: "Netlify sign-in was not approved in time",
    });
  });

  it("stops waiting when cancelled", async () => {
    const { netlify, options } = setUp();
    netlify.approveTickets(null);
    const controller = new AbortController();

    const signIn = signInToNetlify({
      ...options,
      pollIntervalMs: 60_000,
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 20);

    await expect(signIn).rejects.toMatchObject({ code: "cancelled" });
  });
});
