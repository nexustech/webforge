import { EventEmitter } from "node:events";
import type { Net } from "electron";
import { describe, expect, it, vi } from "vitest";
import { electronBundleFetch } from "./bundle-net.js";

/** A stand-in for Electron's `net.request`: the requests made, to answer by hand. */
function fakeNet() {
  const requests: (EventEmitter & {
    readonly options: unknown;
    readonly abort: ReturnType<typeof vi.fn>;
    readonly end: ReturnType<typeof vi.fn>;
  })[] = [];
  const net = {
    request: (options: unknown) => {
      const request = Object.assign(new EventEmitter(), {
        options,
        abort: vi.fn(),
        end: vi.fn(),
      });
      requests.push(request);
      return request;
    },
  } as unknown as Pick<Net, "request">;
  return { net, requests };
}

const init = () => ({ signal: new AbortController().signal, redirect: "manual" as const });

describe("electronBundleFetch (3.9)", () => {
  it("answers a redirect with itself, its Location, and stops the request", async () => {
    const { net, requests } = fakeNet();
    const answer = electronBundleFetch(net)("https://unpkg.com/lib@1", init());
    const [request] = requests;
    expect(request?.options).toMatchObject({ redirect: "manual", useSessionCookies: false });

    request?.emit("redirect", 302, "GET", "https://unpkg.com/lib@1.2.3/index.js", {});
    const response = await answer;

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://unpkg.com/lib@1.2.3/index.js");
    expect(request?.abort).toHaveBeenCalled();
  });

  it("gives a response's status, headers and body as it arrives", async () => {
    const { net, requests } = fakeNet();
    const answer = electronBundleFetch(net)("https://cdn.example.com/a.js", init());
    const incoming = Object.assign(new EventEmitter(), {
      statusCode: 200,
      headers: { "content-type": ["text/javascript"], "content-length": "5" },
    });

    requests[0]?.emit("response", incoming);
    const response = await answer;
    incoming.emit("data", Buffer.from("he"));
    incoming.emit("data", Buffer.from("llo"));
    incoming.emit("end");

    expect(response.headers.get("content-type")).toBe("text/javascript");
    expect(await response.text()).toBe("hello");
  });

  it("fails a body that stalls once the time runs out, so the reader isn't left waiting", async () => {
    const { net, requests } = fakeNet();
    const deadline = new AbortController();
    const answer = electronBundleFetch(net)("https://cdn.example.com/stalls.js", {
      signal: deadline.signal,
      redirect: "manual",
    });
    const incoming = Object.assign(new EventEmitter(), { statusCode: 200, headers: {} });
    requests[0]?.emit("response", incoming);
    const reader = (await answer).body?.getReader();
    incoming.emit("data", Buffer.from("first"));
    expect((await reader?.read())?.done).toBe(false);

    // Nothing more arrives; the deadline passes.
    setTimeout(() => deadline.abort(), 20);
    await expect(reader?.read()).rejects.toThrow("The download was stopped");
    expect(requests[0]?.abort).toHaveBeenCalled();
  });

  it("fails a body cut off by the server", async () => {
    const { net, requests } = fakeNet();
    const answer = electronBundleFetch(net)("https://cdn.example.com/cut.js", init());
    const incoming = Object.assign(new EventEmitter(), { statusCode: 200, headers: {} });
    requests[0]?.emit("response", incoming);
    const reader = (await answer).body?.getReader();

    incoming.emit("aborted");

    await expect(reader?.read()).rejects.toThrow("The download was cut off");
  });

  it("answers a status without a body, never throwing in main", async () => {
    const { net, requests } = fakeNet();
    const answer = electronBundleFetch(net)("https://cdn.example.com/empty.js", init());

    requests[0]?.emit(
      "response",
      Object.assign(new EventEmitter(), { statusCode: 204, headers: {} }),
    );

    const response = await answer;
    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
  });

  it("stops the request when the body is cancelled or the time runs out", async () => {
    const { net, requests } = fakeNet();
    const answer = electronBundleFetch(net)("https://cdn.example.com/big.js", init());
    requests[0]?.emit(
      "response",
      Object.assign(new EventEmitter(), { statusCode: 200, headers: {} }),
    );
    await (await answer).body?.cancel();
    expect(requests[0]?.abort).toHaveBeenCalled();

    const late = new AbortController();
    const waiting = electronBundleFetch(net)("https://cdn.example.com/slow.js", {
      signal: late.signal,
      redirect: "manual",
    });
    late.abort();
    await expect(waiting).rejects.toThrow();
    expect(requests[1]?.abort).toHaveBeenCalled();
  });
});
