import { describe, expect, it } from "vitest";
import { sanitizeCustomCode } from "./custom-code.js";

// Custom Code as the editor shows it (F-ED-15): known ways of running or loading something from
// markup, each removed, while the markup people write shows.

describe("sanitizeCustomCode (2.11)", () => {
  it.each([
    ["a script", "<p>Hi</p><script>alert(1)</script>", "<p>Hi</p>"],
    [
      "an event handler",
      '<img src="x.png" onerror="alert(1)" alt="x">',
      '<img src="x.png" alt="x" />',
    ],
    [
      "a frame with srcdoc",
      '<iframe srcdoc="<script>alert(1)</script>"></iframe><p>a</p>',
      "<p>a</p>",
    ],
    [
      "a script inside SVG",
      '<svg><script>alert(1)</script><circle r="2"></circle></svg>',
      '<svg><circle r="2"></circle></svg>',
    ],
    [
      "an SVG link with xlink:href",
      '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>',
      "<svg><a><text>x</text></a></svg>",
    ],
    [
      "an SVG use",
      '<svg><use href="data:image/svg+xml,&lt;svg onload=alert(1)&gt;"></use></svg>',
      "<svg></svg>",
    ],
    [
      "an animation setting a link",
      '<svg><animate attributeName="href" to="javascript:alert(1)"></animate></svg>',
      "<svg></svg>",
    ],
    [
      "a javascript: link with entities and spaces",
      '<a href=" &#106;ava&#x73;cript:alert(1)">x</a>',
      "<a>x</a>",
    ],
    ["a javascript: link with a tab in it", '<a href="java\tscript:alert(1)">x</a>', "<a>x</a>"],
    ["a MathML trick", "<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>", ""],
    [
      "a style with url()",
      '<div style="background:url(https://example.com/x.png)">a</div>',
      "<div>a</div>",
    ],
    // A CSS escape for the u of url(), which a check for "url(" alone would miss.
    [
      "a style with a CSS escape",
      String.raw`<div style="background:\75rl(x)">a</div>`,
      "<div>a</div>",
    ],
    ["a style element", "<style>body{display:none}</style><p>a</p>", "<p>a</p>"],
    ["a form", '<form action="https://example.com"><input name="x"></form><p>a</p>', "<p>a</p>"],
    [
      "a meta refresh",
      '<meta http-equiv="refresh" content="0;url=https://example.com"><p>a</p>',
      "<p>a</p>",
    ],
    ["an object", '<object data="x.swf"></object><p>a</p>', "<p>a</p>"],
  ])("removes %s", (_name, code, expected) => {
    expect(sanitizeCustomCode(code)).toBe(expected);
  });

  it("asks nothing of the web: no http(s) image or link, a data: image only", () => {
    expect(sanitizeCustomCode('<img src="https://example.com/x.png" alt="x">')).toBe(
      '<img alt="x" />',
    );
    expect(sanitizeCustomCode('<a href="https://example.com">x</a>')).toBe("<a>x</a>");
    expect(sanitizeCustomCode('<a href="data:text/html,x">x</a>')).toBe("<a>x</a>");
    expect(sanitizeCustomCode('<img src="data:image/png;base64,AAAA" alt="">')).toBe(
      '<img src="data:image/png;base64,AAAA" alt="" />',
    );
  });

  it("keeps what people write: structure, classes, safe styles, tables, SVG shapes", () => {
    const code =
      '<div class="grid gap-4" style="color: red"><h2 id="t">Prices</h2>' +
      '<table><tr><th scope="col">Cake</th><td colspan="2">£12</td></tr></table>' +
      '<svg viewBox="0 0 10 10"><path d="M0 0L10 10" stroke="currentColor"></path></svg>' +
      '<a href="#t" target="_blank">Top</a><a href="mailto:rosa@example.com">Mail</a></div>';

    expect(sanitizeCustomCode(code)).toBe(
      '<div class="grid gap-4" style="color:red"><h2 id="t">Prices</h2>' +
        '<table><tr><th scope="col">Cake</th><td colspan="2">£12</td></tr></table>' +
        // Lower-cased as HTML parses it; the HTML parser gives SVG's viewBox its case back.
        '<svg viewbox="0 0 10 10"><path d="M0 0L10 10" stroke="currentColor"></path></svg>' +
        '<a href="#t" target="_blank" rel="noopener noreferrer">Top</a>' +
        '<a href="mailto:rosa@example.com">Mail</a></div>',
    );
  });

  it.each([
    ["an address written with entities", '<rect fill="url&#40;https://evil.example/a)"></rect>'],
    ["a CSS escape", '<rect stroke="u\\72l(https://evil.example/a)"></rect>'],
    ["a quoted address", "<rect clip-path=\"url('https://evil.example/a')\"></rect>"],
    ["an address after a same-document one", '<rect fill="url(#g) url(https://evil.example)">'],
  ])("drops an SVG attribute that could load something, as %s (S22)", (_name, code) => {
    expect(sanitizeCustomCode(`<svg>${code}</svg>`)).toBe("<svg><rect></rect></svg>");
  });

  it("keeps a same-document url(), quoted or with a colour after it (S22)", () => {
    const code = `<svg><rect fill="url('#g') red" clip-path="url( #c )" stroke="#333"></rect></svg>`;
    expect(sanitizeCustomCode(code)).toBe(code);
  });
});
