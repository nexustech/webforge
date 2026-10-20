import { describe, expect, it } from "vitest";
import { uploadOrder } from "./order.js";

describe("uploadOrder", () => {
  it("uploads assets, then pages, then the home page last", () => {
    expect(
      uploadOrder([
        "index.html",
        "about.html",
        "assets/css/site.3f9a1c2b4d.css",
        "services/web-design.html",
        "404.html",
        "robots.txt",
        "assets/img/hero.webp",
      ]),
    ).toEqual([
      "assets/css/site.3f9a1c2b4d.css",
      "assets/img/hero.webp",
      "robots.txt",
      "404.html",
      "about.html",
      "services/web-design.html",
      "index.html",
    ]);
  });

  it("treats only the top-level index.html as the home page", () => {
    expect(uploadOrder(["index.html", "blog/index.html", "a.css"])).toEqual([
      "a.css",
      "blog/index.html",
      "index.html",
    ]);
  });

  it("returns an empty list for no paths", () => {
    expect(uploadOrder([])).toEqual([]);
  });
});
