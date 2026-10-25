import {
  COLOR_ROLES,
  DEFAULT_THEME,
  INVERSE_THEME,
  type Oklch,
  SHADE_STEPS,
  type ThemeTokens,
  themeTokensSchema,
} from "@webforge/model";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  hexToOklch,
  inverseColors,
  oklchToSrgb,
  resolveColorRef,
  shadeOf,
} from "./colors.js";
import { AA_LARGE, AA_TEXT, contrastIssues } from "./contrast.js";
import { CURATED_THEMES } from "./curated/index.js";
import { FONT_CATALOGUE, FONT_PAIRINGS } from "./fonts/catalogue.js";
import { THEME_PRESETS, themePreset } from "./presets.js";
import { oklchCss, themeCss } from "./theme-css.js";

const BLACK: Oklch = { l: 0, c: 0, h: 0 };
const WHITE: Oklch = { l: 1, c: 0, h: 0 };
const { inverse: _inverse, ...withoutInverse } = DEFAULT_THEME;

const color = fc.record({
  l: fc.double({ min: 0, max: 1, noNaN: true }),
  c: fc.double({ min: 0, max: 0.4, noNaN: true }),
  h: fc.double({ min: 0, max: 360, noNaN: true }),
});

describe("colours (2.1)", () => {
  it("convert to sRGB as screens show them", () => {
    const white = oklchToSrgb(WHITE);
    const black = oklchToSrgb(BLACK);
    for (const channel of ["r", "g", "b"] as const) {
      expect(white[channel]).toBeCloseTo(1, 6);
      expect(black[channel]).toBeCloseTo(0, 6);
    }
    // #767676 is OKLCH lightness 0.5658.
    expect(oklchToSrgb({ l: 0.5658, c: 0, h: 0 }).r * 255).toBeCloseTo(118, 0);
  });

  it("give WCAG's ratios: 21 for black on white, 4.54 for #767676 on white, 1 on itself", () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 1);
    expect(contrastRatio(WHITE, BLACK)).toBeCloseTo(21, 1);
    expect(contrastRatio({ l: 0.5658, c: 0, h: 0 }, WHITE)).toBeCloseTo(4.54, 1);
    expect(contrastRatio(DEFAULT_THEME.colors.primary, DEFAULT_THEME.colors.primary)).toBe(1);
  });

  it("lay a see-through foreground over its background first", () => {
    // Black at 0% on white is white: no contrast; at 50% it's a mid grey.
    expect(contrastRatio(BLACK, WHITE, 0)).toBe(1);
    const half = contrastRatio(BLACK, WHITE, 0.5);
    expect(half).toBeGreaterThan(3);
    expect(half).toBeLessThan(contrastRatio(BLACK, WHITE));
  });

  it("are always between 1 and 21", () => {
    fc.assert(
      fc.property(color, color, fc.double({ min: 0, max: 1, noNaN: true }), (a, b, opacity) => {
        const ratio = contrastRatio(a, b, opacity);
        return ratio >= 1 && ratio <= 21.01;
      }),
    );
  });

  it("make shades from light to dark, keeping the hue", () => {
    const shades = SHADE_STEPS.map((step) => shadeOf(DEFAULT_THEME.colors.primary, step));

    expect(shades.map((shade) => shade.h)).toEqual(
      SHADE_STEPS.map(() => DEFAULT_THEME.colors.primary.h),
    );
    for (const [index, shade] of shades.entries()) {
      const next = shades[index + 1];
      if (next !== undefined) expect(next.l).toBeLessThan(shade.l);
    }
  });
});

describe("colour refs with a theme (2.1)", () => {
  const theme: ThemeTokens = DEFAULT_THEME;

  it("show a role, a shade, an opacity and a field's own hex colour", () => {
    expect(resolveColorRef(theme, "primary")).toEqual({
      color: DEFAULT_THEME.colors.primary,
      opacity: 1,
    });
    expect(resolveColorRef(theme, "primary-300/80")).toEqual({
      color: shadeOf(DEFAULT_THEME.colors.primary, 300),
      opacity: 0.8,
    });
    // In an inverse section, the role's own colour there; a hex colour stays as it is.
    expect(resolveColorRef(theme, "base-100", "inverse")?.color).toEqual(
      DEFAULT_THEME.inverse?.["base-100"],
    );
    const hex = resolveColorRef(theme, "[#1F6FEB]/50", "inverse");
    expect(hex?.opacity).toBe(0.5);
    expect(hex?.color).toEqual(hexToOklch("#1f6feb"));
  });

  it("read hex colours as OKLCH, and back to the same sRGB", () => {
    expect(hexToOklch("#ffffff").l).toBeCloseTo(1, 5);
    expect(hexToOklch("#000000")).toEqual({ l: 0, c: 0, h: 0 });
    for (const hex of ["#1f6feb", "#ff0000", "#00ff00", "#767676", "#e5c07b"]) {
      const { r, g, b } = oklchToSrgb(hexToOklch(hex));
      const back = [r, g, b].map((value) => Math.round(value * 255));
      expect(back).toEqual([1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)));
    }
    // #767676 on white is the classic 4.54:1.
    expect(contrastRatio(hexToOklch("#767676"), WHITE)).toBeCloseTo(4.54, 2);
  });

  it("show nothing for a ref that isn't one", () => {
    expect(resolveColorRef(theme, "brand")).toBeUndefined();
    expect(resolveColorRef(theme, "custom-sky")).toBeUndefined();
    expect(resolveColorRef(theme, "[#fff]")).toBeUndefined();
  });

  it("fall back to neutral for inverse sections in a theme without their colours", () => {
    const inverse = inverseColors(withoutInverse);

    expect(inverse["base-100"]).toEqual(DEFAULT_THEME.colors.neutral);
    expect(inverse["base-content"]).toEqual(DEFAULT_THEME.colors["neutral-content"]);
    expect(inverse.primary).toEqual(DEFAULT_THEME.colors.primary);
  });
});

describe("contrastIssues (2.1)", () => {
  it("reports exactly the pairs below AA, in both palettes", () => {
    fc.assert(
      fc.property(
        fc.record(Object.fromEntries(COLOR_ROLES.map((role) => [role, color]))),
        (colors) => {
          const theme = themeTokensSchema.parse({ ...DEFAULT_THEME, colors, inverse: colors });
          const issues = contrastIssues(theme);
          for (const issue of issues) {
            const ratio = contrastRatio(
              theme.colors[issue.foreground],
              theme.colors[issue.background],
            );
            expect(ratio).toBeLessThan(issue.required);
            expect(issue.ratio).toBeLessThanOrEqual(ratio);
          }
          // The inverse palette is the same colours here, so it fails the same pairs.
          const page = issues.filter((issue) => issue.palette === "colors");
          expect(issues.filter((issue) => issue.palette === "inverse")).toHaveLength(page.length);
        },
      ),
    );
  });

  it("reports nothing for a theme whose pairs all pass", () => {
    const colors = Object.fromEntries(
      COLOR_ROLES.map((role) => [role, role.endsWith("content") ? BLACK : WHITE]),
    );
    const theme = themeTokensSchema.parse({
      ...DEFAULT_THEME,
      // Brand colours on the page need contrast with it too.
      colors: {
        ...colors,
        primary: BLACK,
        secondary: BLACK,
        accent: BLACK,
        "primary-content": WHITE,
        "secondary-content": WHITE,
        "accent-content": WHITE,
      },
    });
    const passing = themeTokensSchema.parse({ ...theme, inverse: theme.colors });

    expect(contrastIssues(passing)).toEqual([]);
  });

  it("names a failing pair, its ratio rounded down, and what it needs", () => {
    const grey: Oklch = { l: 0.7, c: 0, h: 0 };
    const theme = themeTokensSchema.parse({
      ...withoutInverse,
      colors: { ...DEFAULT_THEME.colors, "base-content": grey },
    });

    const issues = contrastIssues(theme).filter(
      (issue) => issue.palette === "colors" && issue.foreground === "base-content",
    );
    expect(issues.map((issue) => [issue.background, issue.required])).toEqual([
      ["base-100", AA_TEXT],
      ["base-200", AA_TEXT],
      ["base-300", AA_TEXT],
    ]);
    expect(issues[0]?.ratio).toBe(Math.floor(contrastRatio(grey, WHITE) * 100) / 100);
  });

  it("checks links apart from the text by colour alone against it: 3:1 (WCAG 1.4.1)", () => {
    const theme = (underline: ThemeTokens["links"]["underline"]) =>
      themeTokensSchema.parse({ ...DEFAULT_THEME, links: { underline } });
    const linkIssues = (tokens: ThemeTokens) =>
      contrastIssues(tokens).filter((issue) => issue.background === "base-content");

    // The default theme's primary is close to its text: fine underlined, too close otherwise.
    expect(linkIssues(theme("always"))).toEqual([]);
    expect(
      linkIssues(theme("never")).map((issue) => [issue.palette, issue.required]),
    ).toContainEqual(["colors", AA_LARGE]);
  });

  it("checks the main colour as text on every surface: an outline button's label (2.13a)", () => {
    const theme = themeTokensSchema.parse({
      ...DEFAULT_THEME,
      colors: { ...DEFAULT_THEME.colors, primary: { l: 0.95, c: 0.02, h: 90 } },
    });

    const brand = contrastIssues(theme).filter(
      (issue) => issue.palette === "colors" && issue.foreground === "primary",
    );
    expect(brand.map((issue) => [issue.background, issue.required])).toEqual([
      ["base-100", AA_TEXT],
      ["base-200", AA_TEXT],
      ["base-300", AA_TEXT],
    ]);
  });
});

describe("presets (2.1)", () => {
  it("are valid themes, the development ones first, light first as a new site's", () => {
    expect(THEME_PRESETS.map((preset) => preset.preset)).toEqual([
      "light",
      "dark",
      "high-contrast-rounded",
      ...CURATED_THEMES.map((theme) => theme.preset),
    ]);
    expect(new Set(THEME_PRESETS.map((preset) => preset.preset)).size).toBe(THEME_PRESETS.length);
    for (const preset of THEME_PRESETS) {
      expect(themeTokensSchema.parse(preset)).toEqual(preset);
    }
    expect(themePreset("light")).toBe(DEFAULT_THEME);
    expect(themePreset("cupcake")).toBeUndefined();
  });

  it("include one that passes every contrast check, its inverse sections too", () => {
    const preset = themePreset("high-contrast-rounded");
    expect(preset === undefined ? ["missing"] : contrastIssues(preset)).toEqual([]);
  });

  it("report the pairs each one has below AA, without failing (#312)", async ({ annotate }) => {
    // Contrast is a guideline the site owner may override (product owner, #312): the presets aim
    // to pass, and the Theme panel warns about what doesn't, but nothing blocks on it.
    for (const preset of THEME_PRESETS) {
      const issues = contrastIssues(preset);
      if (issues.length > 0) {
        await annotate(
          `${preset.preset}: ${issues.map((issue) => `${issue.palette} ${issue.foreground} on ${issue.background} ${issue.ratio}:1`).join("; ")}`,
        );
      }
    }
  });
});

describe("curated themes (2.13)", () => {
  it("use one of the tested font pairings, in weights the catalogue has", () => {
    for (const theme of CURATED_THEMES) {
      const { heading, body } = theme.fonts;
      const headingFont = FONT_CATALOGUE.find((font) => font.family === heading.family);
      const bodyFont = FONT_CATALOGUE.find((font) => font.family === body.family);
      expect(headingFont, `${theme.preset}: ${heading.family}`).toBeDefined();
      expect(bodyFont, `${theme.preset}: ${body.family}`).toBeDefined();
      expect(headingFont?.fallback).toBe(heading.fallback);
      expect(bodyFont?.fallback).toBe(body.fallback);
      expect(
        FONT_PAIRINGS.some(
          (pairing) => pairing.heading === headingFont?.id && pairing.body === bodyFont?.id,
        ),
        `${theme.preset}: ${heading.family} with ${body.family}`,
      ).toBe(true);
      for (const style of ["h1", "h2", "h3", "h4", "h5", "h6"] as const) {
        expect(headingFont?.weights, `${theme.preset} ${style}`).toContain(
          theme.typeScale[style].weight,
        );
      }
      expect(bodyFont?.weights).toContain(theme.typeScale.body.weight);
    }
  });

  it("set their own inverse sections, dark under a light page", () => {
    for (const theme of CURATED_THEMES) {
      expect(theme.scheme).toBe("light");
      const inverse = theme.inverse;
      expect(inverse, theme.preset).toBeDefined();
      if (inverse === undefined) continue;
      expect(inverse["base-100"].l).toBeLessThan(0.4);
      expect(inverse["base-content"].l).toBeGreaterThan(0.85);
    }
  });

  it("look distinct: each its own fonts, brand colour and shape", () => {
    // How far apart two colours look (OKLab's distance): about 0.02 is just noticeable.
    const distance = (a: Oklch, b: Oklch) => {
      const lab = ({ l, c, h }: Oklch) => [
        l,
        c * Math.cos((h * Math.PI) / 180),
        c * Math.sin((h * Math.PI) / 180),
      ];
      const [x, y] = [lab(a), lab(b)];
      return Math.hypot(...x.map((value, at) => value - (y[at] ?? 0)));
    };
    CURATED_THEMES.forEach((theme, index) => {
      for (const other of CURATED_THEMES.slice(index + 1)) {
        const pair = `${theme.preset} and ${other.preset}`;
        expect(theme.fonts.heading.family, pair).not.toBe(other.fonts.heading.family);
        expect(distance(theme.colors.primary, other.colors.primary), pair).toBeGreaterThan(0.1);
        const shape = (t: ThemeTokens) => [
          t.radius.box,
          t.buttons.shape,
          t.buttons.style,
          t.spacing,
        ];
        const differences = shape(theme).filter((value, at) => value !== shape(other)[at]);
        expect(differences.length, pair).toBeGreaterThanOrEqual(1);
      }
    });
  });
});

describe("themeCss (2.1)", () => {
  it("writes colours as daisyUI does", () => {
    expect(oklchCss({ l: 0.45, c: 0.24, h: 277.023 })).toBe("oklch(45% 0.24 277.023)");
    expect(oklchCss({ l: 0.97807, c: 0.029, h: 256.847 })).toBe("oklch(97.807% 0.029 256.847)");
  });

  it("writes every role for the page and for inverse sections, with or without its own", () => {
    for (const theme of [DEFAULT_THEME, withoutInverse]) {
      const css = themeCss(theme);
      for (const role of COLOR_ROLES) {
        expect(css.split(`--color-${role}:`)).toHaveLength(3);
      }
      expect(css).toContain(`name: "${INVERSE_THEME}";`);
    }
    // The light preset's inverse sections are dark.
    expect(themeCss(DEFAULT_THEME)).toMatch(
      /name: "wf_inverse";\n {2}default: false;\n {2}color-scheme: dark;/,
    );
  });

  it("writes the colour roles' shades, following the role", () => {
    const css = themeCss(DEFAULT_THEME);

    expect(css).toContain("--color-primary-300: var(--wf-color-primary-300);");
    // Each theme sets its own shades, as `resolveColorRef` shows them.
    const shadeIn = (selector: string, palette: "colors" | "inverse") => {
      const block = css.slice(css.indexOf(`${selector} {`));
      const shade = resolveColorRef(DEFAULT_THEME, "primary-300", palette);
      expect(shade).toBeDefined();
      expect(block.slice(0, block.indexOf("}"))).toContain(
        `--wf-color-primary-300: ${oklchCss(shade?.color ?? DEFAULT_THEME.colors.primary)};`,
      );
    };
    shadeIn(':root, [data-theme="light"]', "colors");
    shadeIn('[data-theme="wf_inverse"]', "inverse");
    expect(css).not.toContain("--color-base-100-300");
  });

  it("writes every choice of the tokens as CSS", () => {
    const css = (change: Partial<ThemeTokens>) => themeCss({ ...DEFAULT_THEME, ...change });

    expect(css({ links: { underline: "never" } })).toContain("--wf-link-decoration: none;");
    // Underlined on hover and focus whatever the theme says, and in the main colour unless always
    // underlined: a link must show it's one (WCAG 1.4.1, 2.13a).
    expect(css({ links: { underline: "never" } })).toContain(
      "--wf-link-hover-decoration: underline;",
    );
    expect(css({ links: { underline: "never" } })).toContain(
      "--wf-link-color: var(--color-primary);",
    );
    expect(css({ links: { underline: "always" } })).toContain("--wf-link-color: currentColor;");
    // The Shadow hover effect keeps a shadow under a theme without shadows.
    expect(css({ shadow: "none" })).toContain(
      "--wf-hover-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);",
    );
    expect(css({ links: { underline: "hover" } })).toContain(
      "--wf-link-hover-decoration: underline;",
    );
    expect(css({ effects: { depth: false, noise: true } })).toMatch(/--depth: 0;\n {2}--noise: 1;/);
    expect(css({ border: "thick" })).toContain("--border: 2px;");
    expect(css({ spacing: "compact" })).toContain("--spacing: 0.225rem;");
    // The shadow scale (#423): none, Tailwind's own for soft, or darker.
    expect(css({ shadow: "none" })).toContain("--shadow-md: 0 0 #0000;");
    expect(css({ shadow: "soft" })).not.toContain("--shadow-md:");
    expect(css({ shadow: "strong" })).toContain(
      "--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.2), 0 2px 4px -2px rgb(0 0 0 / 0.2);",
    );
    // The buttons (#423): their shape and size on every button, their style on the main ones.
    const square = css({ buttons: { shape: "square", size: "s", style: "outline" } });
    expect(square).toContain("--wf-button-radius: 0rem;\n  --wf-button-height: 2rem;");
    expect(square).toContain("--radius-field: var(--wf-button-radius);");
    expect(square).toContain("--size: var(--wf-button-height);");
    expect(square).toContain(
      // Never a Button set to Filled (PH2-14).
      ".btn-primary:not(.btn-outline, .btn-ghost, .btn-link, .wf-filled) {\n    @apply btn-outline;",
    );
    const ghost = css({ buttons: { shape: "pill", size: "m", style: "ghost" } });
    expect(ghost).toContain("@apply btn-ghost;");
    // On a dark band, an outline or ghost button takes the band's text colour (2.13a).
    for (const styled of [square, ghost]) {
      expect(styled).toContain(
        ".bg-neutral .btn-primary:not(.btn-outline, .btn-ghost, .btn-link, .wf-filled) {\n    --btn-color: var(--color-neutral-content);",
      );
    }
    const filled = css({ buttons: { shape: "pill", size: "m", style: "filled" } });
    expect(filled).not.toContain("@apply");
    // Rounded buttons keep the theme's field corners, as they always had.
    const rounded = css({ buttons: { shape: "rounded", size: "m", style: "filled" } });
    expect(rounded).not.toContain("--radius-field: var(--wf-button-radius);");
    expect(css({ radius: { box: "none", field: "full", selector: "s" } })).toContain(
      "--radius-selector: 0.25rem;\n  --radius-field: 9999px;\n  --radius-box: 0rem;",
    );
  });

  it("sets the page title a size smaller on phones, never above 4xl (#419)", () => {
    const phone = (size: ThemeTokens["typeScale"]["h1"]["size"]) =>
      /@media \(width < 48rem\) \{\s*:root \{\s*--text-h1: ([^;]+);/.exec(
        themeCss({
          ...DEFAULT_THEME,
          typeScale: { ...DEFAULT_THEME.typeScale, h1: { ...DEFAULT_THEME.typeScale.h1, size } },
        }),
      )?.[1];
    // The default theme's 5xl is 4xl, as its titles always were on phones.
    expect(phone("5xl")).toBe("2.25rem");
    // A display size stops at 4xl, so it fits a 375 px screen.
    expect(phone("6xl")).toBe("2.25rem");
    expect(phone("3xl")).toBe("1.5rem");
    expect(phone("xs")).toBe("0.75rem");
  });

  it("quotes every font family the model allows, safely", () => {
    const css = (heading: string, body: string) =>
      themeCss({
        ...DEFAULT_THEME,
        fonts: {
          heading: { family: heading, fallback: "monospace" },
          body: { family: body, fallback: "serif" },
        },
      });

    expect(css("Josefin Sans", "Mrs. Saint-Delafield")).toContain(
      '--font-sans: "Mrs. Saint-Delafield", ui-serif, Georgia, serif;\n  --font-heading: "Josefin Sans", ui-monospace, monospace;',
    );
    expect(css("Rock 'n' Roll One", "M PLUS 1p")).toContain(
      "--font-heading: \"Rock 'n' Roll One\", ui-monospace, monospace;",
    );
  });
});
