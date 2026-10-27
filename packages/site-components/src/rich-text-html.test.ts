import { describe, expect, it } from "vitest";
import { sanitizeRichText, sanitizeStoredRichText } from "./rich-text-html.js";

const HOSTILE =
  '<p onclick="x()">Hi<script>alert(1)</script> <a href="javascript:alert(1)">a</a></p><style>p{}</style>';

describe("sanitizeStoredRichText (4.8)", () => {
  it("cleans rich text as the export does", () => {
    expect(sanitizeStoredRichText(HOSTILE)).toBe("<p>Hi <a>a</a></p>");
    expect(sanitizeStoredRichText(HOSTILE)).toBe(sanitizeRichText(HOSTILE));
  });

  it("keeps links to the site's pages and documents, which the export drops until it rewrites them", () => {
    const html =
      '<p><a href="webforge:page/page-about#team">Team</a> <a href="webforge:file/abc?download" target="_blank">List</a></p>';
    expect(sanitizeStoredRichText(html)).toBe(
      '<p><a href="webforge:page/page-about#team">Team</a> <a href="webforge:file/abc?download" target="_blank" rel="noopener">List</a></p>',
    );
    expect(sanitizeRichText(html)).not.toContain("webforge:");
  });
});

describe("text marks in rich text (2.25, ST-3)", () => {
  it("keeps underline and the theme's highlight and colour classes, and nothing else on a span", () => {
    const html =
      '<p><u>Read</u> <span class="bg-accent/30">this</span> <span class="text-primary">now</span></p>';
    expect(sanitizeRichText(html)).toBe(html);
    expect(sanitizeStoredRichText(html)).toBe(html);
    expect(
      sanitizeRichText(
        '<p><span class="text-primary evil" style="color:red" onclick="x()">Hi</span> <span class="font-black">there</span></p>',
      ),
    ).toBe('<p><span class="text-primary">Hi</span> <span>there</span></p>');
  });
});
