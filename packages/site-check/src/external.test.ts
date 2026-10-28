import { describe, expect, it } from "vitest";
import { cssResources, htmlResources, isAllowed, scriptResources } from "./external.js";

describe("htmlResources (C8, 3.9)", () => {
  it("finds what the HTML loads from other websites, however it's quoted", () => {
    const html = `
      <script src="https://cdn.example.com/lib.js"></script>
      <link rel='stylesheet' href=https://fonts.example.com/css?family=Inter>
      <link rel="icon" href="//img.example.com/icon.png">
      <link rel="preload" as="font" href="https://fonts.example.com/inter.woff2">
      <img src="https://img.example.com/a.jpg" srcset="https://img.example.com/a-2x.jpg 2x, local.jpg 1x">
      <video src="https://media.example.com/clip.mp4" poster="https://img.example.com/poster.jpg"></video>
      <iframe src="https://maps.example.com/embed"></iframe>
      <div style="background: url('https://img.example.com/bg.png')"></div>
      <style>@import url("https://cdn.example.com/theme.css");</style>
      <script>loadScript("https://cdn.example.com/widget.js");</script>`;

    expect(htmlResources(html)).toEqual([
      { url: "https://cdn.example.com/lib.js", kind: "script" },
      { url: "https://fonts.example.com/css?family=Inter", kind: "style" },
      { url: "//img.example.com/icon.png", kind: "image" },
      { url: "https://fonts.example.com/inter.woff2", kind: "font" },
      { url: "https://img.example.com/a.jpg", kind: "image" },
      { url: "https://img.example.com/a-2x.jpg", kind: "image" },
      { url: "https://media.example.com/clip.mp4", kind: "media" },
      { url: "https://img.example.com/poster.jpg", kind: "image" },
      { url: "https://maps.example.com/embed", kind: "frame" },
      { url: "https://img.example.com/bg.png", kind: "image" },
      { url: "https://cdn.example.com/theme.css", kind: "style" },
      { url: "https://cdn.example.com/widget.js", kind: "script" },
    ]);
  });

  it("finds every kind of link and media element by what it loads", () => {
    const html = `
      <link rel="modulepreload" href="https://cdn.example.com/m.js">
      <link rel="prefetch" href="https://cdn.example.com/next.json">
      <link rel="preload" as="style" href="https://cdn.example.com/s.css">
      <link rel="apple-touch-icon" href="https://img.example.com/touch.png">
      <link rel="manifest" href="https://cdn.example.com/site.webmanifest">
      <link rel="alternate" href="https://example.com/feed.xml">
      <input type="image" src="https://img.example.com/go.png">
      <picture><source srcset="https://img.example.com/b.webp 1x"></picture>
      <audio><source src="https://media.example.com/song.mp3"><track src="https://media.example.com/t.vtt"></audio>
      <embed src="https://media.example.com/doc.pdf"><object data="https://media.example.com/o.swf"></object>
      <frame src="https://frames.example.com/f.html">`;

    expect(htmlResources(html)).toEqual([
      { url: "https://cdn.example.com/m.js", kind: "script" },
      { url: "https://cdn.example.com/next.json", kind: "other" },
      { url: "https://cdn.example.com/s.css", kind: "style" },
      { url: "https://img.example.com/touch.png", kind: "image" },
      { url: "https://cdn.example.com/site.webmanifest", kind: "other" },
      { url: "https://img.example.com/go.png", kind: "image" },
      { url: "https://img.example.com/b.webp", kind: "image" },
      { url: "https://media.example.com/song.mp3", kind: "media" },
      { url: "https://media.example.com/t.vtt", kind: "media" },
      { url: "https://media.example.com/doc.pdf", kind: "media" },
      { url: "https://media.example.com/o.swf", kind: "media" },
      { url: "https://frames.example.com/f.html", kind: "frame" },
    ]);
  });

  it("leaves out links, the site's own files, data and what's in comments", () => {
    const html = `
      <a href="https://example.com/about">About us</a>
      <form action="https://forms.example.com/in"></form>
      <img src="assets/img/local.jpg"><img src="data:image/png;base64,AAAA">
      <!-- <script src="https://cdn.example.com/old.js"></script> -->`;

    expect(htmlResources(html)).toEqual([]);
  });
});

describe("cssResources (C8, 3.9)", () => {
  it("finds imported stylesheets, and fonts and images in url()", () => {
    const css = `
      /* url(https://cdn.example.com/commented.png) */
      @import "https://cdn.example.com/base.css";
      @font-face { font-family: Inter; src: url(https://fonts.example.com/inter) format("woff2"); }
      .hero { background-image: url("//img.example.com/hero.jpg"); }
      .logo { background: url(assets/img/logo.png); }`;

    expect(cssResources(css)).toEqual([
      { url: "https://cdn.example.com/base.css", kind: "style" },
      { url: "https://fonts.example.com/inter", kind: "font" },
      { url: "//img.example.com/hero.jpg", kind: "image" },
    ]);
  });
});

describe("scriptResources (C8, 3.9)", () => {
  it("finds the files a script names, but not the addresses it only goes to", () => {
    const js = `
      const s = document.createElement("script");
      s.src = 'https://cdn.example.com/chat.js';
      new Image().src = \`https://img.example.com/pixel.gif\`;
      location.href = "https://example.com/thanks";
      fetch("https://api.example.com/hours");`;

    expect(scriptResources(js)).toEqual([
      { url: "https://cdn.example.com/chat.js", kind: "script" },
      { url: "https://img.example.com/pixel.gif", kind: "image" },
    ]);
  });

  it("knows each kind of file by its name, whatever follows it", () => {
    const js = `[
      "https://cdn.example.com/a.mjs?v=2", "https://cdn.example.com/b.css#x",
      "https://fonts.example.com/c.woff2", "https://media.example.com/d.webm",
      "https://cdn.example.com/a.mjs?v=2"
    ]`;

    expect(scriptResources(js).map((resource) => resource.kind)).toEqual([
      "script",
      "style",
      "font",
      "media",
    ]);
  });
});

describe("scriptResources and apostrophes (3.9)", () => {
  it("reads a string after a comment with an apostrophe in it, which ends with its line", () => {
    const js = `// it's the chat\nload("https://cdn.example.com/chat.js"); // that's all`;

    expect(scriptResources(js)).toEqual([
      { url: "https://cdn.example.com/chat.js", kind: "script" },
    ]);
  });
});

describe("isAllowed (C8)", () => {
  const allowed = ["https://cdn.example.com/lib.js", "https://fonts.example.com/"];

  it("allows an address on the list, or under a folder on it", () => {
    expect(isAllowed("https://cdn.example.com/lib.js", allowed)).toBe(true);
    expect(isAllowed("//cdn.example.com/lib.js", allowed)).toBe(true);
    expect(isAllowed("https://fonts.example.com/css?family=Inter", allowed)).toBe(true);
  });

  it("allows nothing else: another file, another site, or a folder without its slash", () => {
    expect(isAllowed("https://cdn.example.com/lib2.js", allowed)).toBe(false);
    expect(isAllowed("https://fonts.example.com.evil.test/x.css", allowed)).toBe(false);
    expect(isAllowed("https://cdn.example.com/lib.js/x", ["https://cdn.example.com/lib.js"])).toBe(
      false,
    );
  });
});
