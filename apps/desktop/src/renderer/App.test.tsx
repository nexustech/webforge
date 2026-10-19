import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { App } from "./App.js";

describe("App", () => {
  it("shows the app name and version", () => {
    const html = renderToStaticMarkup(<App info={{ name: "Webforge", version: "1.2.0" }} />);

    expect(html).toContain("<h1");
    expect(html).toContain(">Webforge</h1>");
    expect(html).toContain("Version 1.2.0");
  });
});
