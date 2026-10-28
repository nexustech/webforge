import type { BuildOutput, PublishEvent, Publisher, Verification } from "./publisher.js";
import { verifyPublished } from "./verify.js";

/** Progress of a publish run: the publisher's events, then the live site's check (08). */
export type PublishRunEvent =
  | PublishEvent
  /** Checking that the address serves what was published. */
  | { readonly type: "verifying"; readonly url: string }
  /** What the check found; the publish itself is done whatever it says. */
  | { readonly type: "verified"; readonly url: string; readonly result: Verification };

/** Options of {@link publishSite}. */
export type PublishRunOptions = {
  /**
   * Checks the live site in place of the publisher's own check (Netlify's API) or, without one,
   * {@link verifyPublished}'s.
   */
  readonly verify?: (url: string, build: BuildOutput, signal: AbortSignal) => Promise<Verification>;
};

/**
 * Publishes `build` to `dest` with `publisher`, then checks the live site (08, architecture §7's
 * publish steps 2–4): what changed goes up, assets first and the home page last, the files the
 * site dropped are removed, and the new version is checked: by the host itself where it can say
 * (Netlify), or else by asking the address for the new home page. A publisher's error,
 * cancelling included, ends the run before anything is checked, and leaves the previous site
 * usable (each publisher sees to that). Cancelling while the site is checked ends the check only:
 * the publish is done, and `verified` says the site wasn't checked.
 */
export async function* publishSite<D>(
  publisher: Publisher<D>,
  build: BuildOutput,
  dest: D,
  signal: AbortSignal,
  options: PublishRunOptions = {},
): AsyncIterable<PublishRunEvent> {
  for await (const event of publisher.publish(build, dest, signal)) {
    yield event;
    if (event.type !== "published") continue;
    yield { type: "verifying", url: event.url };
    const result: Verification = signal.aborted
      ? { status: "unchecked" }
      : options.verify !== undefined
        ? await options.verify(event.url, build, signal)
        : publisher.verify !== undefined
          ? await publisher.verify(event, dest, signal)
          : await verifyPublished(event.url, build, { signal });
    yield { type: "verified", url: event.url, result };
  }
}
