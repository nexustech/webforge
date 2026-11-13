import { z } from "zod";
import type { AssistantErrorCode, AssistantModel } from "../../shared/ipc/assistant.js";

/**
 * The models the assistant offers (6.9a, ADR 0026 §2): OpenRouter's that can call tools and have a
 * zero-data-retention endpoint, unless Advanced allows others; or whatever a local or named server
 * lists. Each with its rough cost per reply.
 */

const OPENROUTER_API = "https://openrouter.ai/api/v1";

/**
 * Models Webforge has tried with the assistant's tools, first in the list, the first preselected.
 * Empty until 6.9b's trials with the loop: until then nothing is marked tested or preselected.
 */
const TESTED_MODELS: readonly string[] = [];

/** product/14 §4.2's typical reply: about 80k tokens in and 3k out, over its model calls. */
const TYPICAL_REPLY = { promptTokens: 80_000, completionTokens: 3_000 };

/** A typical reply over this asks once before the model is chosen (§2). */
const PRICEY_REPLY_USD = 0.5;

/** OpenRouter's price per token, as its lists give it: a decimal string, in US dollars. */
const priceSchema = z
  .string()
  .regex(/^\d+(\.\d+)?(e-?\d+)?$/i)
  .transform(Number);

const modelsSchema = z.looseObject({
  data: z.array(
    z.looseObject({
      id: z.string().min(1).max(200),
      name: z.string().min(1).max(200),
      pricing: z.looseObject({ prompt: priceSchema, completion: priceSchema }),
    }),
  ),
});

const zdrSchema = z.looseObject({
  data: z.array(
    z.looseObject({
      model_id: z.string().min(1).max(200),
      supported_parameters: z.array(z.string()).optional(),
      safety_retention: z.boolean().optional(),
    }),
  ),
});

const localSchema = z.looseObject({
  data: z.array(z.looseObject({ id: z.string().min(1).max(200) })),
});

type ModelList =
  | { readonly status: "ok"; readonly models: AssistantModel[] }
  | { readonly status: AssistantErrorCode };

/** GETs `url` as JSON checked by `schema`: the value, or the code for why not. */
async function getJson<T>(
  fetchFn: typeof fetch,
  url: string,
  schema: z.ZodType<T>,
  key?: string,
): Promise<{ ok: true; value: T } | { ok: false; error: AssistantErrorCode }> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      headers: key === undefined ? {} : { authorization: `Bearer ${key}` },
    });
  } catch {
    return { ok: false, error: "offline" };
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    return {
      ok: false,
      error: response.status === 401 || response.status === 403 ? "unauthorized" : "provider-error",
    };
  }
  const parsed = schema.safeParse(await response.json().catch(() => null));
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: "provider-error" };
}

/** "Anthropic" from OpenRouter's "Anthropic: Claude Sonnet 4.5", or its id's first part. */
const makerOf = (id: string, name: string) =>
  name.includes(": ") ? (name.split(": ")[0] ?? id) : (id.split("/")[0] ?? id);

/** A model's name without its maker's prefix: "Claude Sonnet 4.5". */
const shortName = (name: string) =>
  name.includes(": ") ? name.slice(name.indexOf(": ") + 2) : name;

/**
 * OpenRouter's models that can call tools; only those with a ZDR endpoint that can, unless
 * `allowRetaining`. Tested ones first, then cheapest first.
 */
export async function openRouterModels(
  fetchFn: typeof fetch,
  allowRetaining: boolean,
): Promise<ModelList> {
  const [listed, zdr] = await Promise.all([
    getJson(fetchFn, `${OPENROUTER_API}/models?supported_parameters=tools`, modelsSchema),
    getJson(fetchFn, `${OPENROUTER_API}/endpoints/zdr`, zdrSchema),
  ]);
  if (!listed.ok) return { status: listed.error };
  if (!zdr.ok) return { status: zdr.error };
  // Safety Retention endpoints keep flagged prompts, so they don't count (ADR 0026 §2).
  const withZdr = new Set(
    zdr.value.data
      .filter(
        (endpoint) =>
          endpoint.safety_retention !== true &&
          (endpoint.supported_parameters?.includes("tools") ?? false),
      )
      .map((endpoint) => endpoint.model_id),
  );
  const models = listed.value.data
    .filter((model) => allowRetaining || withZdr.has(model.id))
    .map((model): AssistantModel => {
      const perReplyUsd =
        TYPICAL_REPLY.promptTokens * model.pricing.prompt +
        TYPICAL_REPLY.completionTokens * model.pricing.completion;
      return {
        id: model.id,
        name: shortName(model.name),
        maker: makerOf(model.id, model.name),
        tested: TESTED_MODELS.includes(model.id),
        zdr: withZdr.has(model.id),
        perReplyUsd: Math.round(perReplyUsd * 10_000) / 10_000,
        pricey: perReplyUsd > PRICEY_REPLY_USD,
      };
    })
    .sort(
      (a, b) =>
        Number(b.tested) - Number(a.tested) ||
        (a.tested && b.tested
          ? TESTED_MODELS.indexOf(a.id) - TESTED_MODELS.indexOf(b.id)
          : (a.perReplyUsd ?? 0) - (b.perReplyUsd ?? 0)),
    );
  return { status: "ok", models };
}

/** The models a local or named server lists at `<baseUrl>/models`: unpriced, by their ids. */
export async function serverModels(
  fetchFn: typeof fetch,
  baseUrl: string,
  key?: string,
): Promise<ModelList> {
  const listed = await getJson(fetchFn, `${baseUrl}/models`, localSchema, key);
  if (!listed.ok) return { status: listed.error };
  return {
    status: "ok",
    models: listed.value.data.map((model) => ({
      id: model.id,
      name: model.id,
      maker: null,
      tested: false,
      zdr: false,
      perReplyUsd: null,
      pricey: false,
    })),
  };
}

/** The model OpenRouter's list would preselect: its first tested one, if any. */
export const preselected = (models: readonly AssistantModel[]) =>
  models.find((model) => model.tested) ?? null;
