// Security review S22 (docs/reviews/2026-10-30-security-review.md), restored by #659.
import { describe, expect, it } from "vitest";
import { sanitizeCustomCode } from "./custom-code.js";

// Security audit: SVG presentation attributes must not carry web addresses in url().
describe("sanitizeCustomCode: url() in SVG attributes", () => {
  it.each([
    ["fill", '<svg><rect fill="url(https://evil.example/x.svg#a)"></rect></svg>'],
    ["stroke", '<svg><rect stroke="url(https://evil.example/s.svg#s)"></rect></svg>'],
    ["clip-path", '<svg><rect clip-path="url(https://evil.example/c.svg#c)"></rect></svg>'],
    ["fill on a div", '<div fill="url(//evil.example/x#a)">a</div>'],
  ])("drops a web address in %s", (_name, code) => {
    const out = sanitizeCustomCode(code);
    expect(out).not.toContain("evil.example");
  });

  it("keeps a same-document reference", () => {
    expect(sanitizeCustomCode('<svg><rect fill="url(#g)"></rect></svg>')).toContain(
      'fill="url(#g)"',
    );
  });
});
