import { describe, expect, it } from "vitest";
import { htmlToMarkdown } from "./markdown.js";

const markdown = (html: string) => htmlToMarkdown(html, { url: (href) => `/${href}` });

describe("htmlToMarkdown (F-EX-5)", () => {
  it("writes headings and paragraphs, one blank line apart", () => {
    expect(
      markdown(`<section class="hero"><div><h1 class="text-5xl">Fresh  bread
      daily</h1><p>Baked <strong>every</strong> <em>morning</em>.</p></div></section>`),
    ).toBe("# Fresh bread daily\n\nBaked **every** *morning*.\n");
  });

  it("writes lists, numbered and nested", () => {
    expect(markdown("<ol><li>Mix</li><li>Bake<ul><li>Hot</li><li>Long</li></ul></li></ol>")).toBe(
      "1. Mix\n2. Bake\n   - Hot\n   - Long\n",
    );
  });

  it("writes links and images' alt text, resolving their addresses; decorative images say nothing", () => {
    expect(
      markdown(
        '<p>See <a href="about.html">our story</a>.</p><img src="assets/img/a.jpg" alt="Loaves"><img src="b.jpg" alt="">',
      ),
    ).toBe("See [our story](/about.html).\n\n![Loaves](/assets/img/a.jpg)\n");
  });

  it("keeps a broken link's text, and a card that's one link apart", () => {
    expect(markdown('<p><a href="#">Gone</a></p>')).toBe("Gone\n");
    expect(markdown('<a href="cakes.html"><div><h3>Cakes</h3><p>For birthdays</p></div></a>')).toBe(
      "[Cakes For birthdays](/cakes.html)\n",
    );
  });

  it("leaves out scripts, forms, embeds and what's hidden from everyone", () => {
    expect(
      markdown(`<p>Shown</p><script>var a = "{year}";</script><style>p{}</style>
        <form><label>Name</label><input></form><iframe src="x"></iframe>
        <span aria-hidden="true">★</span><div hidden>Secret</div><nav><a href="x">Menu</a></nav>`),
    ).toBe("Shown\n");
  });

  it("keeps line breaks, quotes, code and rules", () => {
    expect(
      markdown(
        "<p>Mon–Fri<br>7–3</p><blockquote><p>Best bread</p><p>– Sam</p></blockquote><pre>a  b\n</pre><hr><p><code>x`y</code></p>",
      ),
    ).toBe("Mon–Fri\n7–3\n\n> Best bread\n>\n> – Sam\n\n```\na  b\n```\n\n---\n\n`xy`\n");
  });

  it("escapes what Markdown would read as formatting, and decodes entities", () => {
    expect(markdown("<p>2 * 3 &amp; [a_b]</p>")).toBe("2 \\* 3 & \\[a\\_b\\]\n");
  });

  it("writes nothing for a page with no text", () => {
    expect(markdown("<div><img src='a.jpg' alt=''></div>")).toBe("");
  });
});
