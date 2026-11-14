# The first security review's tests

The [first security review](../2026-10-30-security-review.md) (30 Oct 2026) had each finding checked by a verifier, which tried to disprove it in the code. Where it could, the verifier wrote a Vitest test that failed on `main` because of the flaw. These are those 27 tests.

- **Stored as `.ts.txt`** (or `.tsx.txt`), so CI doesn't run tests that were meant to fail.
- **Each one's first line** gives its original path and what it showed when it ran on `main` then.
- **The file names** are the review's finding ids (`ipc-1`, `files-2`); the review's summary table maps them to S1–S25.
- **To run one,** copy it back to its original path. It is the regression test for its fix.

## Which were adopted (13 Nov 2026)

20 were copied back to their paths as `zz-security-*.test.ts(x)` with their fixes, and run with every `pnpm check`: ai-1, ai-2, ai-4, customcode-1 to customcode-3, deps-2, downloads-1 and downloads-2, export-1, export-2, export-4, ipc-1, ipc-2, packaging-1 and packaging-2, publish-1, and servers-1 to servers-3.

customcode-2's copy now checks the opposite: the canvas stays a same-origin iframe, the exception [ADR 0023](../../adr/0023-app-scheme-and-canvas-boundary.md) documents.

The other 7 weren't copied back:

- **files-1 (S4)** became `packages/storage/test/crafted-views.test.ts`, with the same tests.
- **files-2 (S12), publish-2 (S13), export-3 (S14) and ai-3 (S20)** were fixed with tests of their own; the [second security review](../2026-11-08-security-review-2.md) checked each fix in the code.
- **ai-5 and ai-6** tested requirements for 4.9's code, which didn't exist yet; 4.9 came later, with tests of its own.

Keep these files as the review left them: they record what it found.
