import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDirFactory } from "@webforge/test-utils";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { ProjectFileError, ProjectStore } from "../src/index.js";

// #295: a copy of a .wforge taken while a commit writes it (a sync client copying the file alone)
// can hold some pages of the new commit and the rest of the old one. Here every such copy is
// made on purpose, from two real commits, page by page, instead of hoping a timed copy hits one.

const tempDir = tempDirFactory();
const PAGE = 4096;
/** Enough documents that the documents table spans several pages, as a real site's does. */
const FILLERS = 300;

/** A commit's two documents that must always agree, and the documents around them. */
function commitSeq(store: ProjectStore, seq: number): void {
  store.commit([
    { type: "put", id: "page:home", kind: "page", content: { seq } },
    // Last in id order, so its row is on another page of the documents table than page:home's.
    { type: "put", id: "zz-progress", kind: "page", content: { seq } },
  ]);
}

/** The project's bytes after a commit of `seq`, and after the next commit. */
function twoCommits(): { before: Buffer; after: Buffer } {
  const path = join(tempDir(), "site.wforge");
  const store = ProjectStore.create(path, { name: "Torn" });
  store.commit(
    Array.from({ length: FILLERS }, (_, index) => ({
      type: "put" as const,
      id: `page:filler-${String(index).padStart(3, "0")}`,
      kind: "page",
      content: { index, text: "x".repeat(40) },
    })),
  );
  commitSeq(store, 1);
  store.close();
  const before = readFileSync(path);
  const reopened = ProjectStore.open(path);
  commitSeq(reopened, 2);
  reopened.close();
  return { before, after: readFileSync(path) };
}

/** A copy whose first `pages` pages come from `head`, the rest from `tail`, as long as `head`. */
function torn(head: Buffer, tail: Buffer, pages: number): Buffer {
  const copy = Buffer.from(head);
  tail.copy(copy, pages * PAGE, pages * PAGE, Math.min(tail.length, copy.length));
  return copy;
}

const seqOf = (store: ProjectStore, id: string) => {
  const content = store.readDocument(id)?.content;
  return typeof content === "object" && content !== null && "seq" in content
    ? content.seq
    : undefined;
};

/** Whether SQLite alone (`quick_check`) would accept the file, and its two documents disagree. */
function wouldHaveOpenedInconsistent(path: string): boolean {
  const db = new Database(path, { readonly: true });
  try {
    if (db.pragma("quick_check", { simple: true }) !== "ok") return false;
    const seqs = db
      .prepare(
        `SELECT json_extract(CAST(data AS TEXT), '$.seq') FROM documents
         JOIN blobs ON blobs.hash = documents.blob_hash WHERE id IN ('page:home', 'zz-progress')`,
      )
      .pluck()
      .all();
    return seqs.length !== 2 || seqs[0] !== seqs[1];
  } catch {
    return false;
  } finally {
    db.close();
  }
}

describe("a .wforge copied while a commit writes it (#295)", () => {
  it("never opens with parts of two commits, at any page of either order", () => {
    const { before, after } = twoCommits();
    const pages = Math.ceil(Math.max(before.length, after.length) / PAGE);
    const dir = tempDir();
    let opened = 0;
    let inconsistent = 0;

    for (const [head, tail] of [
      [after, before],
      [before, after],
    ] as const) {
      for (let page = 1; page < pages; page += 1) {
        const path = join(dir, `copy-${opened + inconsistent}.wforge`);
        writeFileSync(path, torn(head, tail, page));
        if (wouldHaveOpenedInconsistent(path)) inconsistent += 1;
        let store: ProjectStore;
        try {
          store = ProjectStore.open(path);
        } catch (error) {
          expect(error).toBeInstanceOf(ProjectFileError);
          expect(error).toMatchObject({ code: "corrupt" });
          continue;
        }
        expect(seqOf(store, "page:home")).toBe(seqOf(store, "zz-progress"));
        store.close();
        opened += 1;
      }
    }

    // The copies above include the case #295 found: SQLite's own check passes, yet the two
    // documents disagree. Without the content check, those would have opened.
    expect(inconsistent).toBeGreaterThan(0);
  });

  it("opens either commit whole", () => {
    const { before, after } = twoCommits();
    const dir = tempDir();

    for (const [name, bytes, seq] of [
      ["before", before, 1],
      ["after", after, 2],
    ] as const) {
      const path = join(dir, `${name}.wforge`);
      writeFileSync(path, bytes);
      const store = ProjectStore.open(path);
      expect(seqOf(store, "page:home")).toBe(seq);
      expect(seqOf(store, "zz-progress")).toBe(seq);
      store.close();
    }
  });

  it("still opens a file written before fingerprints, whose header holds none", () => {
    const { after } = twoCommits();
    const path = join(tempDir(), "older.wforge");
    writeFileSync(path, after);
    const db = new Database(path);
    db.pragma("user_version = 0");
    db.close();

    const store = ProjectStore.open(path);
    expect(seqOf(store, "page:home")).toBe(2);
    store.close();
  });
});
