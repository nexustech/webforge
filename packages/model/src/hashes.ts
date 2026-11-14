import { z } from "zod";

/**
 * A SHA-256 as lower-case hex (#988): what names a site's blob, a template's or a font's file, a
 * kept piece of code and a publish's fingerprint.
 */
export const SHA256_HEX = /^[0-9a-f]{64}$/;

/** Validates a {@link SHA256_HEX}. */
export const sha256HexSchema = z.string().regex(SHA256_HEX);
