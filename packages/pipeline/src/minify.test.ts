import { describe, expect, it } from "vitest";
import { minifiedCss, minifiedHtml, minifiedJs } from "./minify.js";

describe("minifiedCss", () => {
  it("drops comments and the whitespace that changes nothing", () => {
    expect(
      minifiedCss(`/* theme */
.btn {
  color: red;
  margin: 0 auto !important;
}
.a > .b, .c {
  padding: calc(1rem + 2px);
}`),
    ).toBe(".btn{color:red;margin:0 auto!important}.a>.b,.c{padding:calc(1rem + 2px)}");
  });

  it("keeps the whitespace that does change something", () => {
    // A descendant pseudo-class, `and (…)` in a media query, and an empty custom property.
    expect(minifiedCss(".a :hover { x: y }")).toBe(".a :hover{x:y}");
    expect(minifiedCss("@media screen and (min-width: 40rem) { .a { b: c } }")).toBe(
      "@media screen and (min-width:40rem){.a{b:c}}",
    );
    expect(minifiedCss(".a { --tw-x: ; --y: ; }")).toBe(".a{--tw-x: ;--y: }");
  });

  it("keeps a custom property's value as written, but for its ends and runs of whitespace", () => {
    expect(minifiedCss(':root { --font: "Inter",  ui-sans-serif , serif ; --s: 0 0 #0000; }')).toBe(
      ':root{--font:"Inter", ui-sans-serif , serif;--s:0 0 #0000}',
    );
    // Its brackets don't end it, and a declaration after it is minified again.
    expect(minifiedCss(".a { --x: calc( 1px ; ); color : red , blue }")).toBe(
      ".a{--x:calc( 1px ; );color :red,blue}",
    );
  });

  it("keeps licence notices", () => {
    expect(minifiedCss("/*! tailwindcss v4 | MIT License */\n/* layer */\n.a { b: c }")).toBe(
      "/*! tailwindcss v4 | MIT License */.a{b:c}",
    );
  });

  it("keeps strings as written, comment markers and spaces in them included", () => {
    expect(minifiedCss(`.a { content: "a  /* b */ c"; font-family: 'Open  Sans'; }`)).toBe(
      `.a{content:"a  /* b */ c";font-family:'Open  Sans'}`,
    );
    expect(minifiedCss(`.a { content: "say \\"hi\\"  now" }`)).toBe(
      `.a{content:"say \\"hi\\"  now"}`,
    );
  });

  it("keeps nested rules nested, as Tailwind writes them", () => {
    expect(
      minifiedCss(".x {\n  &:hover {\n    @media (hover: hover) {\n      a: b;\n    }\n  }\n}"),
    ).toBe(".x{&:hover{@media (hover:hover){a:b}}}");
  });
});

describe("minifiedHtml", () => {
  it("drops comments and collapses whitespace to one space or line break, never removing it", async () => {
    expect(
      await minifiedHtml("<!-- Header (shared) -->\n<p>\n  Hello <b>you</b>  there\n</p>"),
    ).toBe("\n<p>\nHello <b>you</b> there\n</p>");
  });

  it("leaves scripts, styles and preformatted text as written", async () => {
    const html = "<pre>  a\n  b</pre><script>let  x = 1;\n</script><style>.a  { b: c }</style>";

    expect(await minifiedHtml(html)).toBe(html);
  });
});

describe("minifiedJs", () => {
  it("shortens a classic script, keeping its global names", async () => {
    const script =
      "function webforgeStart(element) {\n  const wanted = element.dataset;\n  return wanted;\n}\n";

    const small = await minifiedJs(script);

    expect(small.length).toBeLessThan(script.length);
    expect(small).toContain("function webforgeStart(");
  });
});
