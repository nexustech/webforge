import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { ProjectFileError, ProjectStore } from "../src/index.js";
import { startChildWriter } from "./support/child-writer.js";

// Integration tests with a real writer process (support/writer.ts) that commits in a loop and is
// killed abruptly, as a crash or a forced quit would (engineering standards §5, ADR 0003).

const tempDir = tempDirFactory();

function createProject(): string {
  const path = join(tempDir(), "site.wforge");
  ProjectStore.create(path, { name: "Crash test" }).close();
  return path;
}

function seqOf(store: ProjectStore, id: string): unknown {
  const content = store.readDocument(id)?.content;
  return typeof content === "object" && content !== null && "seq" in content
    ? content.seq
    : undefined;
}

describe("crash safety", () => {
  it("opens after the writer is killed mid-write and loses at most the unfinished commit", async () => {
    // Kill at varying moments: at least 5 rounds, and more (up to 20) until one kill has hit a
    // transaction. On a busy machine a few kills can land between commits.
    const delays = [0, 15, 40, 80, 150];
    let killedMidTransaction = 0;
    for (let round = 0; round < 20 && (round < 5 || killedMidTransaction === 0); round += 1) {
      const delayMs = delays[round % delays.length] ?? 0;
      const path = createProject();
      const writer = startChildWriter(path);
      await writer.waitForCommits(3);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await writer.kill();
      // A hot journal means the kill interrupted a transaction that SQLite must roll back.
      if (existsSync(`${path}-journal`)) {
        killedMidTransaction += 1;
      }

      const store = ProjectStore.open(path);
      const seq = seqOf(store, "menu");
      // Every commit the writer saw return is on disk; the one in flight may or may not be.
      expect(seq).toBeGreaterThanOrEqual(writer.lastAcknowledged());
      expect(seq).toBeLessThanOrEqual(writer.lastAcknowledged() + 1);
      // Both documents of a commit land together.
      expect(seqOf(store, "page:home")).toBe(seq);
      // An asset never points at a blob that isn't there.
      const asset = store.readAsset("photo");
      expect(asset === undefined ? undefined : store.readBlob(asset.hash)).toBeDefined();
      // A kill before the journal header was finished leaves a journal SQLite ignores (not
      // "hot"); the next write transaction removes it.
      store.commit([{ type: "put", id: "code", kind: "code", content: true }]);
      store.close();
      expect(existsSync(`${path}-journal`)).toBe(false);
    }
    // Proves the rounds above really interrupted a write, not only idle moments.
    expect(killedMidTransaction).toBeGreaterThan(0);
  }, 120_000);
});

describe("cloud-synced folders", () => {
  it("never yields a copy that opens with inconsistent content, even mid-write", async () => {
    // A sync client (OneDrive, Dropbox) copies the .wforge while Webforge is writing. With the
    // rollback journal a copy taken during a commit can be torn; it must then fail the integrity
    // check on open instead of opening with half a commit.
    const path = createProject();
    const writer = startChildWriter(path);
    await writer.waitForCommits(2);
    const copyDir = tempDir();
    const copies: string[] = [];
    while (copies.length < 60) {
      const copy = join(copyDir, `copy-${copies.length}.wforge`);
      copyFileSync(path, copy);
      copies.push(copy);
      await new Promise((resolve) => setTimeout(resolve, copies.length % 7));
    }
    await writer.kill();

    let opened = 0;
    for (const copy of copies) {
      let store: ProjectStore;
      try {
        store = ProjectStore.open(copy);
      } catch (error) {
        expect(error).toBeInstanceOf(ProjectFileError);
        continue;
      }
      expect(seqOf(store, "page:home")).toBe(seqOf(store, "menu"));
      store.close();
      opened += 1;
    }
    expect(opened).toBeGreaterThan(0);
    // The project itself is unharmed.
    const store = ProjectStore.open(path);
    expect(seqOf(store, "menu")).toBeGreaterThanOrEqual(writer.lastAcknowledged());
    store.close();
    // 60 copies, each opened and integrity-checked: about 80 s on CI's macOS runners.
  }, 120_000);

  it("keeps every commit in the .wforge itself, unlike WAL (why we use the rollback journal)", () => {
    // Copying only the .wforge while it is open (what a sync client, e-mail or a USB stick sees)
    // must include all committed work. In WAL mode recent commits live in the -wal side file.
    const rowsInCopy = (journalMode: "DELETE" | "WAL"): number => {
      const dir = tempDir();
      const path = join(dir, "db.sqlite");
      const db = new Database(path);
      db.pragma(`journal_mode = ${journalMode}`);
      db.exec("CREATE TABLE edits (n INTEGER)");
      const insert = db.prepare("INSERT INTO edits VALUES (?)");
      for (let n = 0; n < 10; n += 1) {
        insert.run(n);
      }
      copyFileSync(path, join(dir, "copy.sqlite"));
      db.close();

      const copy = new Database(join(dir, "copy.sqlite"), { readonly: true });
      try {
        const tables = copy.prepare("SELECT count(*) FROM sqlite_schema").pluck().get();
        return tables === 0 ? 0 : Number(copy.prepare("SELECT count(*) FROM edits").pluck().get());
      } finally {
        copy.close();
      }
    };

    expect(rowsInCopy("DELETE")).toBe(10);
    expect(rowsInCopy("WAL")).toBe(0);
  });
});
