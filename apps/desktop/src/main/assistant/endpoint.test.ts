import { describe, expect, it } from "vitest";
import {
  type EndpointSettings,
  endpointFor,
  OPENROUTER_BASE_URL,
  OPENROUTER_KEY,
  SERVER_KEY,
} from "./endpoint.js";

const MODEL = { id: "anthropic/claude-model" };

/** A credential store holding `keys`. */
const store = (keys: Record<string, string> = {}) => ({
  get: async (key: string) => keys[key] ?? null,
});

const settings = (provider: EndpointSettings["provider"], allow = false): EndpointSettings => ({
  provider,
  model: MODEL,
  allowRetainingModels: allow,
});

describe("where the assistant's model calls go (#873, ADR 0026 §2)", () => {
  it("asks for a model and OpenRouter's sign-in before anything", async () => {
    const openRouter = settings({ kind: "openrouter" });
    expect(await endpointFor({ ...openRouter, model: null }, store(), "Webforge")).toEqual({
      status: "no-model",
    });
    expect(await endpointFor(openRouter, store(), "Webforge")).toEqual({
      status: "not-signed-in",
    });
  });

  it("sends OpenRouter its key, the app's name and zero data retention unless Advanced allows", async () => {
    const keys = store({ [OPENROUTER_KEY]: "sk-or-v1-key" });
    expect(await endpointFor(settings({ kind: "openrouter" }), keys, "Webforge")).toEqual({
      status: "ok",
      model: MODEL.id,
      endpoint: {
        baseUrl: OPENROUTER_BASE_URL,
        key: "sk-or-v1-key",
        openRouter: { title: "Webforge", allowRetaining: false },
      },
    });
    const allowing = await endpointFor(settings({ kind: "openrouter" }, true), keys, "Webforge");
    expect(allowing).toMatchObject({ endpoint: { openRouter: { allowRetaining: true } } });
  });

  it("sends a local server no key, even one kept for another server", async () => {
    const keys = store({ [SERVER_KEY]: "server-key", [OPENROUTER_KEY]: "sk-or-v1-key" });
    const local = { kind: "ollama", baseUrl: "http://localhost:11434/v1" } as const;
    expect(await endpointFor(settings(local), keys, "Webforge")).toEqual({
      status: "ok",
      model: MODEL.id,
      endpoint: { baseUrl: local.baseUrl },
    });
  });

  it("sends a named server its key only where it can't be read on the way (#976)", async () => {
    const keys = store({ [SERVER_KEY]: "server-key" });
    const secure = { kind: "server", baseUrl: "https://ai.example.com/v1" } as const;
    expect(await endpointFor(settings(secure), keys, "Webforge")).toMatchObject({
      endpoint: { baseUrl: secure.baseUrl, key: "server-key" },
    });
    const plain = { kind: "server", baseUrl: "http://ai.example.com/v1" } as const;
    expect(await endpointFor(settings(plain), keys, "Webforge")).toEqual({
      status: "insecure-server",
    });
    // Without a key there's nothing to read on the way but what the person chose to send.
    expect(await endpointFor(settings(plain), store(), "Webforge")).toEqual({
      status: "ok",
      model: MODEL.id,
      endpoint: { baseUrl: plain.baseUrl },
    });
  });
});
