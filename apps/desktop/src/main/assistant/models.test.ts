import { describe, expect, it, vi } from "vitest";
import type { AssistantModel } from "../../shared/ipc/assistant.js";
import { openRouterModels, preselected, serverModels } from "./models.js";

/** A model as OpenRouter lists it, at `prompt` and `completion` dollars per token. */
const listed = (id: string, name: string, prompt: string, completion: string) => ({
  id,
  name,
  pricing: { prompt, completion },
});

/**
 * OpenRouter's lists:
 * - Claude has a ZDR endpoint that calls tools;
 * - Big has one too, and costs more than the pricey line;
 * - No Tools has a ZDR endpoint without tools;
 * - Retains has one with Safety Retention;
 * - Plain has no ZDR endpoint at all.
 */
function openRouter() {
  const fetchFn = vi.fn(async (url: string | URL | Request) => {
    if (String(url).endsWith("/models?supported_parameters=tools")) {
      return Response.json({
        data: [
          listed("anthropic/claude-model", "Anthropic: Claude Model", "0.000003", "0.000015"),
          listed("acme/big", "Acme: Big", "0.00001", "0.00003"),
          listed("acme/no-tools", "Acme: No Tools", "0.0000001", "0.0000001"),
          listed("acme/retains", "Acme: Retains", "0.0000001", "0.0000002"),
          listed("plain/model", "Plain Model", "1e-7", "2e-7"),
          // Variable pricing, as OpenRouter's router lists it: left out, not the whole list lost.
          listed("openrouter/auto", "Auto Router", "-1", "-1"),
          { id: "broken" },
        ],
      });
    }
    if (String(url).endsWith("/endpoints/zdr")) {
      return Response.json({
        data: [
          { model_id: "anthropic/claude-model", supported_parameters: ["tools", "stream"] },
          { model_id: "acme/big", supported_parameters: ["tools"] },
          { model_id: "acme/no-tools", supported_parameters: ["stream"] },
          { model_id: "acme/retains", supported_parameters: ["tools"], safety_retention: true },
          { model_id: "openrouter/auto", supported_parameters: ["tools"] },
          { model: "not an endpoint" },
        ],
      });
    }
    return new Response("", { status: 404 });
  });
  return fetchFn as unknown as typeof fetch;
}

/** A `fetch` that answers every request with `response()`. */
const answering = (response: () => Response) =>
  vi.fn(async () => response()) as unknown as typeof fetch;

describe("the assistant's model list (6.9a, ADR 0026 §2)", () => {
  it("offers OpenRouter's tool models with a ZDR endpoint that calls tools, cheapest first", async () => {
    expect(await openRouterModels(openRouter(), false)).toEqual({
      status: "ok",
      models: [
        {
          id: "anthropic/claude-model",
          name: "Claude Model",
          maker: "Anthropic",
          tested: false,
          zdr: true,
          // product/14's typical reply: 80k tokens in at $3/M, 3k out at $15/M.
          perReplyUsd: 0.285,
          pricey: false,
        },
        {
          id: "acme/big",
          name: "Big",
          maker: "Acme",
          tested: false,
          zdr: true,
          // 80k at $10/M and 3k at $30/M: over $0.50, so it asks before it's chosen.
          perReplyUsd: 0.89,
          pricey: true,
        },
      ],
    });
  });

  it("with Advanced's setting, offers the others too, marked as not ZDR", async () => {
    const models = await openRouterModels(openRouter(), true);
    if (models.status !== "ok") throw new Error(models.status);
    expect(models.models.map((model) => [model.id, model.zdr])).toEqual([
      ["acme/no-tools", false],
      ["acme/retains", false],
      ["plain/model", false],
      ["anthropic/claude-model", true],
      ["acme/big", true],
    ]);
    // A name without a maker's prefix takes the maker from the id.
    expect(models.models[2]).toMatchObject({ name: "Plain Model", maker: "plain" });
  });

  it("says why a list couldn't be had", async () => {
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await openRouterModels(offline, false)).toEqual({ status: "offline" });
    const unauthorized = answering(() => new Response("", { status: 401 }));
    expect(await openRouterModels(unauthorized, false)).toEqual({ status: "unauthorized" });
    const down = answering(() => new Response("", { status: 503 }));
    expect(await openRouterModels(down, false)).toEqual({ status: "provider-error" });
    const garbled = answering(() => Response.json({ models: [] }));
    expect(await openRouterModels(garbled, false)).toEqual({ status: "provider-error" });
  });

  it("lists a local or named server's models, unpriced, with its key when it has one", async () => {
    const fetchFn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
      Response.json({ data: [{ id: "llama3.2" }, { id: "qwen2.5-coder" }] }),
    );
    const unpriced = (id: string): AssistantModel => ({
      id,
      name: id,
      maker: null,
      tested: false,
      zdr: false,
      perReplyUsd: null,
      pricey: false,
    });
    expect(
      await serverModels(
        fetchFn as unknown as typeof fetch,
        "https://ai.example.com/v1",
        "sk-server",
      ),
    ).toEqual({ status: "ok", models: [unpriced("llama3.2"), unpriced("qwen2.5-coder")] });
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://ai.example.com/v1/models");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer sk-server");

    await serverModels(fetchFn as unknown as typeof fetch, "http://localhost:11434/v1");
    expect(new Headers(fetchFn.mock.calls[1]?.[1]?.headers).has("authorization")).toBe(false);
  });

  it("never sends a key over plain http to another computer (#976)", async () => {
    const fetchFn = vi.fn(async () => Response.json({ data: [{ id: "llama3.2" }] }));
    const asFetch = fetchFn as unknown as typeof fetch;
    expect(await serverModels(asFetch, "http://ai.example.com/v1", "sk-server")).toEqual({
      status: "insecure-server",
    });
    expect(fetchFn).not.toHaveBeenCalled();
    // Without a key, or with one on this computer, it lists as usual.
    expect(await serverModels(asFetch, "http://ai.example.com/v1")).toMatchObject({ status: "ok" });
    expect(await serverModels(asFetch, "http://127.0.0.1:1234/v1", "sk-local")).toMatchObject({
      status: "ok",
    });
  });

  it("preselects the first tested model, and nothing while none is tested", async () => {
    const models = await openRouterModels(openRouter(), false);
    if (models.status !== "ok") throw new Error(models.status);
    // Nothing is tested until 6.9b's trials with the loop.
    expect(preselected(models.models)).toBeNull();
    const [first, second] = models.models;
    if (first === undefined || second === undefined) throw new Error("two models");
    const tested = { ...second, tested: true };
    expect(preselected([first, tested])).toBe(tested);
  });
});
