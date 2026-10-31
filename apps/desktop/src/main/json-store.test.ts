import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils/vitest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createJsonStore, type JsonStoreFiles } from "./json-store.js";

const listSchema = z.strictObject({ version: z.literal(1), items: z.array(z.string()) });
type List = z.infer<typeof listSchema>;
const EMPTY: List = { version: 1, items: [] };

const at = () => new Date("2026-10-31T09:30:00.000Z");
const noPause = () => Promise.resolve();

/** A file system error with `code`, as Node's are. */
const failure = (code: string) => Object.assign(new Error(code), { code });

/** `list` with `item` added. */
const adding = (item: string) => (list: List) => ({ ...list, items: [...list.items, item] });

describe("createJsonStore (#666)", () => {
  const tempDir = tempDirFactory();

  it("reads a missing file as empty, and writes the whole file in the order asked", async () => {
    const file = join(tempDir(), "nested", "list.json");
    const store = createJsonStore(file, listSchema, { empty: EMPTY, onDamaged: "reset" });
    expect(await store.read()).toEqual(EMPTY);

    // Asked together, each sees the one before it: none is lost.
    await Promise.all([store.update(adding("a")), store.update(adding("b"))]);

    expect(await store.read()).toEqual({ version: 1, items: ["a", "b"] });
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ version: 1, items: ["a", "b"] });
    expect(readdirSync(join(file, ".."))).toEqual(["list.json"]);
  });

  it("writes nothing when the change makes nothing", async () => {
    const dir = tempDir();
    const store = createJsonStore(join(dir, "list.json"), listSchema, {
      empty: EMPTY,
      onDamaged: "reset",
    });

    await store.update(() => undefined);

    expect(readdirSync(dir)).toEqual([]);
  });

  it("moves a file that won't parse aside before writing, or writes over it, as asked", async () => {
    for (const [onDamaged, content] of [
      ["move-aside", "{ cut off"],
      ["move-aside", '{ "version": 2, "items": [] }'],
      ["reset", "{ cut off"],
    ] as const) {
      const dir = tempDir();
      const file = join(dir, "list.json");
      writeFileSync(file, content);
      const store = createJsonStore(file, listSchema, { empty: EMPTY, onDamaged, now: at });

      expect(await store.read(), onDamaged).toEqual(EMPTY);
      await store.update(adding("a"));

      expect(await store.read()).toEqual({ version: 1, items: ["a"] });
      const aside = join(dir, "list.damaged-2026-10-31T09-30-00-000Z.json");
      if (onDamaged === "move-aside") {
        expect(readFileSync(aside, "utf8")).toBe(content);
      } else {
        expect(readdirSync(dir)).toEqual(["list.json"]);
      }
    }
  });

  it("fails, and writes nothing, when the file is there but can't be opened", async () => {
    const dir = tempDir();
    // A folder where the file should be: reading fails with something other than "not found".
    const file = join(dir, "list.json");
    mkdirSync(file);
    const store = createJsonStore(file, listSchema, { empty: EMPTY, onDamaged: "reset" });

    await expect(store.read()).rejects.toMatchObject({ code: "EISDIR" });
    await expect(store.update(adding("a"))).rejects.toMatchObject({ code: "EISDIR" });
    expect(readdirSync(dir)).toEqual(["list.json"]);
  });

  it("tries a rename again while the file is briefly locked, then gives up", async () => {
    for (const [locks, works] of [
      [4, true],
      [5, false],
    ] as const) {
      const dir = tempDir();
      const file = join(dir, "list.json");
      let left: number = locks;
      const renames: string[] = [];
      const files: JsonStoreFiles = {
        ...fs,
        rename: async (from, to) => {
          renames.push(to);
          if (left-- > 0) throw failure("EBUSY");
          await fs.rename(from, to);
        },
      };
      const store = createJsonStore(file, listSchema, {
        empty: EMPTY,
        onDamaged: "reset",
        files,
        pause: noPause,
      });

      const update = store.update(adding("a"));

      if (works) {
        await update;
        expect(await store.read()).toEqual({ version: 1, items: ["a"] });
      } else {
        await expect(update).rejects.toMatchObject({ code: "EBUSY" });
        expect(readdirSync(dir)).toEqual(["list.json.tmp"]);
      }
      expect(renames).toHaveLength(Math.min(locks + 1, 5));
    }
  });

  it("doesn't try again an error that isn't a lock, and a failure doesn't stop what comes after", async () => {
    const dir = tempDir();
    let fail = true;
    const files: JsonStoreFiles = {
      ...fs,
      rename: async (from, to) => {
        if (fail) {
          fail = false;
          throw failure("EXDEV");
        }
        await fs.rename(from, to);
      },
    };
    const store = createJsonStore(join(dir, "list.json"), listSchema, {
      empty: EMPTY,
      onDamaged: "reset",
      files,
      pause: noPause,
    });

    const [first, second] = await Promise.allSettled([
      store.update(adding("a")),
      store.update(adding("b")),
    ]);

    expect(first).toMatchObject({ status: "rejected", reason: { code: "EXDEV" } });
    expect(second.status).toBe("fulfilled");
    expect(await store.read()).toEqual({ version: 1, items: ["b"] });
  });

  it("keeps a secret's file owner-only where the OS supports it", async () => {
    const file = join(tempDir(), "secret.json");
    const store = createJsonStore(file, listSchema, {
      empty: EMPTY,
      onDamaged: "move-aside",
      mode: 0o600,
    });

    await store.update(adding("a"));

    if (process.platform !== "win32") {
      expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
    }
    await store.idle();
  });
});
