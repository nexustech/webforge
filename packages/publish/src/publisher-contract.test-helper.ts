import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { BuildOutput, PublishEvent, Publisher } from "./publisher.js";
import { MANIFEST_FILE } from "./remote-folder.js";

// What every publisher to a host's folder promises (0.3, #991), run against each one with a real
// server of its kind (FTP, SFTP): it sends only what changed, leaves the host's other files alone,
// keeps the live site whole when cancelled, tells its failures apart, and never says the password.

/** A destination whose folder and port a test can change. */
type FolderDestination = { readonly folder: string; readonly port: number };

/** A publisher under test, read once its server has started (`beforeAll`). */
export type PublisherUnderTest<D extends FolderDestination> = {
  /** The publisher signing in with `password`. */
  readonly publisher: (password: string) => Publisher<D>;
  /** The test server's site folder, as a destination names it. */
  readonly destination: () => D;
  /** Where the test server keeps the site's files on disk. */
  readonly siteFolder: () => string;
  /** The password the test server takes. */
  readonly password: string;
};

const bytes = (text: string) => new TextEncoder().encode(text);

/** A site's files, as the export builds them. */
export const build = (files: Record<string, string>): BuildOutput => ({
  files: new Map(Object.entries(files).map(([path, content]) => [path, bytes(content)])),
});

/** Runs a publish to its end: its events, or the error it stopped with. */
export async function run(
  publishing: AsyncIterable<PublishEvent>,
): Promise<{ readonly events: PublishEvent[]; readonly error?: unknown }> {
  const events: PublishEvent[] = [];
  try {
    for await (const event of publishing) events.push(event);
  } catch (error) {
    return { events, error };
  }
  return { events };
}

const SITE = {
  "index.html": "<p>Home</p>",
  "about.html": "<p>About</p>",
  "assets/css/site.css": "body {}",
};

/**
 * The tests every folder publisher passes, against the server `under` names. Each talks to a real
 * server over the network stack, several publishes in some: 30 seconds, for a loaded CI runner.
 */
export function describePublisherContract<D extends FolderDestination>(
  name: string,
  under: () => PublisherUnderTest<D>,
): void {
  describe(`${name}: what every folder publisher promises (0.3, #991)`, { timeout: 30_000 }, () => {
    const publish = async (files: Record<string, string>) => {
      const { publisher, destination, password } = under();
      const { events, error } = await run(
        publisher(password).publish(build(files), destination(), AbortSignal.timeout(30_000)),
      );
      if (error !== undefined) throw error;
      return events;
    };
    const onHost = (path: string) => readFileSync(join(under().siteFolder(), path), "utf8");

    it("publishes, then sends only what changed and removes what the site dropped", async () => {
      const first = await publish(SITE);
      expect(first.at(-1)).toMatchObject({ type: "published", uploaded: 3, removed: 0 });
      expect(onHost("assets/css/site.css")).toBe("body {}");
      expect(JSON.parse(onHost(MANIFEST_FILE)).files).toHaveProperty("index.html");

      const { "about.html": _dropped, ...rest } = SITE;
      const second = await publish({ ...rest, "index.html": "<p>Home, v2</p>" });

      expect(second.filter((event) => event.type === "uploading")).toEqual([
        { type: "uploading", path: "index.html", done: 0, total: 1 },
      ]);
      expect(second.at(-1)).toEqual({
        type: "published",
        url: "https://bakery.example/",
        uploaded: 1,
        unchanged: 1,
        removed: 1,
      });
      // Replaced, on a server whose rename won't overwrite too.
      expect(onHost("index.html")).toBe("<p>Home, v2</p>");
      expect(existsSync(join(under().siteFolder(), "about.html"))).toBe(false);
      // No upload file is left beside the files it replaced.
      const left = readdirSync(under().siteFolder()).filter((file) =>
        file.endsWith(".webforge-upload"),
      );
      expect(left).toEqual([]);
    });

    it("leaves files Webforge didn't put there alone", async () => {
      writeFileSync(join(under().siteFolder(), "their-notes.txt"), "keep me");

      await publish({ "index.html": "<p>Home, v3</p>" });

      expect(onHost("their-notes.txt")).toBe("keep me");
    });

    it("keeps the live site whole when cancelled mid-publish", async () => {
      await publish(SITE);
      const { publisher, destination, password } = under();
      const controller = new AbortController();
      const changed = Object.fromEntries(
        Object.entries(SITE).map(([path, text]) => [path, `${text} v9`]),
      );

      const { error } = await run(
        (async function* () {
          for await (const event of publisher(password).publish(
            build(changed),
            destination(),
            controller.signal,
          )) {
            // Cancelled as the first file starts, so it's cut off mid-transfer or before it.
            if (event.type === "uploading") controller.abort();
            yield event;
          }
        })(),
      );

      expect(error).toMatchObject({ name: "PublishError", code: "cancelled" });
      // The pages are the published ones: the home page goes last and was never reached.
      expect(onHost("index.html")).toBe("<p>Home</p>");
      expect(onHost("about.html")).toBe("<p>About</p>");
    });

    it("tells a wrong password, a missing folder and an unreachable host apart", async () => {
      const { publisher, destination, password } = under();
      const dest = destination();

      expect(await publisher(password).test(dest)).toEqual({ ok: true });
      expect(await publisher("wrong").test(dest)).toEqual({ ok: false, code: "unauthorized" });
      expect(await publisher(password).test({ ...dest, folder: "/nowhere" })).toEqual({
        ok: false,
        code: "not-found",
      });
      expect(await publisher(password).test({ ...dest, port: 1 })).toEqual({
        ok: false,
        code: "network",
      });
    });

    it("never puts the password in an error", async () => {
      const { publisher, destination } = under();

      const { error } = await run(
        publisher("wrong-secret").publish(build(SITE), destination(), AbortSignal.timeout(30_000)),
      );

      expect(error).toMatchObject({ code: "unauthorized" });
      expect(String((error as Error).message)).not.toContain("wrong-secret");
    });
  });
}
