import { z } from "zod";
/**
 * Webforge's update channels (5.2, spec/03 §10, ADR 0024). Stable gets the repository's latest
 * release; Beta gets the newest published one, prereleases included, so each release reaches Beta
 * first (docs/releasing.md).
 */
export declare const updateChannelSchema: z.ZodEnum<{
  beta: "beta";
  stable: "stable";
}>;
/** Stable or Beta. */
export type UpdateChannel = z.infer<typeof updateChannelSchema>;
/**
 * The channel an installation follows: the person's choice in Settings › App › Updates, or else
 * Beta while the app is below 1.0.0, as every build before it is a prerelease, and Stable from
 * 1.0.0. Only a choice is stored, so the default moves with the version.
 */
export declare function updateChannelFor(
  choice: UpdateChannel | undefined,
  appVersion: string,
): UpdateChannel;
//# sourceMappingURL=update-channel.d.ts.map
