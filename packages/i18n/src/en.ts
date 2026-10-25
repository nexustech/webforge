import { app } from "./en/app.js";
import { canvas } from "./en/canvas.js";
import { components } from "./en/components/index.js";
import { errors } from "./en/errors.js";
import { exportSite } from "./en/export.js";
import { fonts } from "./en/fonts.js";
import { history } from "./en/history.js";
import { panels } from "./en/panels.js";
import { puck } from "./en/puck.js";
import { shell } from "./en/shell.js";
import { site } from "./en/site.js";
import { storage } from "./en/storage.js";
import { templates } from "./en/templates.js";
import { theme } from "./en/theme.js";

/**
 * The per-area catalogues that make up the English UI strings. Each area lives in its own file under
 * `src/en/`, so work on different areas adds keys to different files. A key belongs to exactly one
 * area (checked by a test).
 */
export const areas = {
  app,
  shell,
  panels,
  site,
  storage,
  canvas,
  history,
  components,
  export: exportSite,
  fonts,
  puck,
  errors,
  theme,
  templates,
} as const;

/**
 * English UI strings. Wording follows the glossary in `research/product/01-terminology.md`.
 * Keys are dotted paths (`area.item`); placeholders use `{name}`.
 */
export const en = {
  ...app,
  ...shell,
  ...panels,
  ...site,
  ...storage,
  ...canvas,
  ...history,
  ...components,
  ...exportSite,
  ...fonts,
  ...puck,
  ...errors,
  ...theme,
  ...templates,
} as const;
