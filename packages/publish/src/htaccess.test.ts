import { describe, expect, it } from "vitest";
import { HTACCESS_BEGIN, HTACCESS_END, withRedirectRules } from "./htaccess.js";

const RULES = ["<IfModule mod_rewrite.c>", "RewriteEngine On", "</IfModule>"].join("\n");
const OTHER = ["ErrorDocument 404 /404.html", "Options -Indexes", ""].join("\n");

/** Webforge's block holding `rules`, with `newline` between its lines. */
const block = (rules = RULES, newline = "\n") =>
  [
    HTACCESS_BEGIN,
    "# Old addresses of pages, sent on to where the pages are now. Webforge writes this block each",
    "# time it publishes; the rest of this file is yours, and stays as it is.",
    ...rules.split("\n"),
    HTACCESS_END,
  ].join(newline);

describe("withRedirectRules (5.15, CC-7)", () => {
  it("writes a file of the block alone where the host has none", () => {
    expect(withRedirectRules(undefined, RULES)).toBe(`${block()}\n`);
  });

  it("puts a new block first in the host's file, keeping all the rest", () => {
    expect(withRedirectRules(OTHER, RULES)).toBe(`${block()}\n\n${OTHER}`);
  });

  it("replaces the block where it is, nothing outside it changed", () => {
    const before = `# Mine\n${block()}\n\n${OTHER}`;
    const next = [
      "<IfModule mod_rewrite.c>",
      "RewriteRule ^old(\\.html)?$ %1new.html [R=301,NC,L]",
      "</IfModule>",
    ].join("\n");

    expect(withRedirectRules(before, next)).toBe(`# Mine\n${block(next)}\n\n${OTHER}`);
    // Published again unchanged: the same file, which publishing then doesn't write.
    expect(withRedirectRules(before, RULES)).toBe(before);
  });

  it("takes the block out without rules, and the whole file when it held only the block", () => {
    expect(withRedirectRules(`${block()}\n\n${OTHER}`, undefined)).toBe(OTHER);
    expect(withRedirectRules(`# Mine\n${block()}\n${OTHER}`, undefined)).toBe(`# Mine\n${OTHER}`);
    expect(withRedirectRules(`${block()}\n`, undefined)).toBeNull();
  });

  it("leaves a file without the block as it is when there are no rules", () => {
    expect(withRedirectRules(OTHER, undefined)).toBe(OTHER);
    expect(withRedirectRules(undefined, undefined)).toBeUndefined();
  });

  it("keeps a file's Windows line endings", () => {
    const windows = "Options -Indexes\r\n";
    expect(withRedirectRules(windows, RULES)).toBe(`${block(RULES, "\r\n")}\r\n\r\n${windows}`);
  });

  it("leaves a file with a broken block as it is: its rest can't be told from the block", () => {
    const open = `${HTACCESS_BEGIN}\nRewriteEngine On\n${OTHER}`;
    const reversed = `${HTACCESS_END}\n${OTHER}${HTACCESS_BEGIN}\n`;
    expect(withRedirectRules(open, RULES)).toBe(open);
    expect(withRedirectRules(reversed, undefined)).toBe(reversed);
  });
});
