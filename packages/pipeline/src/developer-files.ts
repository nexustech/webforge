import type { SiteSnapshot } from "@webforge/model";
import daisyuiPackage from "daisyui/package.json" with { type: "json" };
import tailwindPackage from "tailwindcss/package.json" with { type: "json" };
import { type SiteCssOptions, siteStylesheetSource } from "./css.js";

/** The folder of the export the developer files go in. */
const DEVELOPER_FOLDER = "developer";

/**
 * *Include developer files* (F-EX-4, X6): what a developer needs to rebuild or extend the site's
 * styles with the standard tools. The exported pages don't use them.
 * - `input.css`: the Tailwind v4 source, with the theme's tokens, daisyUI's theme and the fonts;
 * - `package.json`: the exact Tailwind, Tailwind CLI and daisyUI versions this export used, and a
 *   `build-css` script that rebuilds the stylesheet the pages link to;
 * - `design-tokens.json`: the theme;
 * - `site.json`: the Site Settings the pages show;
 * - `README.md`: how the export is laid out, and how to rebuild the stylesheet.
 *
 * Written in English, like the code they're for. `cssPath` is the stylesheet the pages link to.
 */
export function developerFiles(
  site: SiteSnapshot,
  css: SiteCssOptions,
  cssPath: string,
): ReadonlyMap<string, string> {
  const settings = {
    name: site.name,
    language: site.language,
    ...(site.settings === undefined ? {} : { settings: site.settings }),
    ...(site.openingHours === undefined ? {} : { openingHours: site.openingHours }),
    ...(site.socialProfiles === undefined ? {} : { socialProfiles: site.socialProfiles }),
    ...(site.formService === undefined ? {} : { formService: site.formService }),
  };
  // The CLI is released with Tailwind itself, at the same version.
  const packageJson = {
    private: true,
    description: `Rebuilds the stylesheet of ${site.name}: npm install, then npm run build-css.`,
    scripts: { "build-css": `tailwindcss -i input.css -o ../${cssPath}` },
    devDependencies: {
      "@tailwindcss/cli": tailwindPackage.version,
      daisyui: daisyuiPackage.version,
      tailwindcss: tailwindPackage.version,
    },
  };
  return new Map([
    [`${DEVELOPER_FOLDER}/input.css`, `${siteStylesheetSource(css, "package")}\n`],
    [`${DEVELOPER_FOLDER}/package.json`, `${JSON.stringify(packageJson, null, 2)}\n`],
    [`${DEVELOPER_FOLDER}/design-tokens.json`, `${JSON.stringify(site.theme, null, 2)}\n`],
    [`${DEVELOPER_FOLDER}/site.json`, `${JSON.stringify(settings, null, 2)}\n`],
    [`${DEVELOPER_FOLDER}/README.md`, readme(site, cssPath)],
  ]);
}

function readme(site: SiteSnapshot, cssPath: string): string {
  return `# ${site.name}: developer files

This site was made with Webforge. Its pages work as they are: open \`index.html\` from disk or
upload the folder to any web host. These files are for a developer who wants to change its styles.

## Layout
- \`*.html\`: one file per page, linked to each other by relative paths. Pages in folders link
  back with \`../\`.
- \`${cssPath}\`: the site's stylesheet, compiled by Tailwind CSS v4 with daisyUI from the classes
  the pages use.
- \`assets/js/\`: \`webforge.*.js\`, the behaviours the pages' components use (only if any do).
  A classic script, loaded with \`defer\`.
- \`assets/fonts/\`, \`assets/img/\`: the theme's fonts (self-hosted) and each image as WebP with a
  JPEG or PNG fallback, at several widths.
- \`files/\`: documents the pages link to, as they were added.
- \`developer/\`: these files. Nothing on the pages refers to them.

## The styles
- \`developer/input.css\`: the stylesheet's source, with the site's theme as daisyUI and Tailwind
  tokens, the fonts, and the classes the pages use.
- \`developer/design-tokens.json\`: the theme's values (colours, fonts, sizes, corners).
- \`developer/site.json\`: the Site Settings the pages show (contact details, opening hours,
  social profiles).
- \`developer/package.json\`: the Tailwind CSS (${tailwindPackage.version}) and daisyUI
  (${daisyuiPackage.version}) versions this export used.

To rebuild the stylesheet after changing the pages or \`input.css\`, from the \`developer\` folder:

\`\`\`sh
npm install
npm run build-css
\`\`\`

Tailwind reads the classes from every \`.html\` file of the site as well as those \`input.css\`
lists, so a class added to a page is compiled in. The script writes the file the pages link to.

Edits made here are not read back into Webforge: the next export from Webforge writes the site
again from the site file.
`;
}
