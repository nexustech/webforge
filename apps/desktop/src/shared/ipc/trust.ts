import { z } from "zod";
import { sessionIdSchema } from "./project.js";

/**
 * The texts of pieces of the open site's code (#649): Settings' Custom Code parts, Custom Code
 * elements, the allowed addresses. As many as a site can hold, each as long as code can be.
 */
const codeTextsSchema = z.array(z.string().max(1_000_000)).max(2_000);

/** Why the main process can't answer for the site a call names. */
const trustFailureSchema = z.strictObject({
  status: z.literal("failed"),
  reason: z.enum(["no-site", "stale-session", "unknown"]),
});

const untrustedResultSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("checked"),
    /** The positions, in the texts asked about, of those the owner hasn't written or confirmed. */
    untrusted: z.array(z.int().nonnegative()),
  }),
  trustFailureSchema,
]);

/** See {@link trustChannels}' `untrustedCode`. */
type UntrustedCodeResult = z.infer<typeof untrustedResultSchema>;

const trustResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("trusted") }),
  trustFailureSchema,
]);

/** See {@link trustChannels}' `trustCode`. */
type TrustCodeResult = z.infer<typeof trustResultSchema>;

/** IPC channels of the `trust` domain (`trust:*`, #649). Each one's arguments are checked. */
export const trustChannels = {
  /** Which of these pieces of the open site's code its owner hasn't written here or confirmed. */
  untrustedCode: {
    channel: "trust:untrusted-code",
    request: z.tuple([sessionIdSchema, codeTextsSchema]),
    response: untrustedResultSchema,
  },
  /** Trusts these pieces of the open site's code: the owner wrote them here, or confirmed them. */
  trustCode: {
    channel: "trust:trust-code",
    request: z.tuple([sessionIdSchema, codeTextsSchema]),
    response: trustResultSchema,
  },
} as const;

/** `window.webforge.trust`: which of the open site's code its owner trusts (#649). */
export interface TrustApi {
  /** Which of `texts`, pieces of the code of the site `sessionId` opened, aren't trusted yet. */
  untrusted(sessionId: string, texts: readonly string[]): Promise<UntrustedCodeResult>;
  /** Trusts `texts` for the site `sessionId` opened: its owner wrote or confirmed them. */
  trust(sessionId: string, texts: readonly string[]): Promise<TrustCodeResult>;
}
