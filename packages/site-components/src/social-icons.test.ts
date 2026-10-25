import facebook from "simple-icons/icons/facebook.svg?raw";
import github from "simple-icons/icons/github.svg?raw";
import instagram from "simple-icons/icons/instagram.svg?raw";
import tiktok from "simple-icons/icons/tiktok.svg?raw";
import x from "simple-icons/icons/x.svg?raw";
import youtube from "simple-icons/icons/youtube.svg?raw";
import { describe, expect, it } from "vitest";
import { SOCIAL_LOGOS, socialName } from "./social-icons.js";

/** The package's own SVGs, as Vite reads them. */
const PACKAGE_SVGS: Readonly<Record<keyof typeof SOCIAL_LOGOS, string>> = {
  facebook,
  github,
  instagram,
  tiktok,
  x,
  youtube,
};

describe("the social networks' logos (PH2-4)", () => {
  it.each(Object.entries(SOCIAL_LOGOS))("copies %s from Simple Icons as it is", (slug, logo) => {
    const svg = PACKAGE_SVGS[slug as keyof typeof SOCIAL_LOGOS];
    expect(svg).toContain(`<title>${logo.title}</title>`);
    expect(svg).toContain(` d="${logo.path}"`);
  });

  it("names a profile by its network, or by its address's host", () => {
    expect(socialName({ network: "x", url: "https://x.com/ourbakery" })).toBe("X");
    expect(socialName({ network: "linkedin", url: "https://www.linkedin.com/in/me" })).toBe(
      "LinkedIn",
    );
    expect(socialName({ network: "custom", url: "https://www.mastodon.social/@me" })).toBe(
      "mastodon.social",
    );
    expect(socialName({ network: "custom", url: "not an address" })).toBe("not an address");
  });
});
