import { ai } from "./en/ai.js";
import { aiApps } from "./en/aiApps.js";
import { app } from "./en/app.js";
import { assistant } from "./en/assistant.js";
import { blog } from "./en/blog.js";
import { canvas } from "./en/canvas.js";
import { components } from "./en/components/index.js";
import { exportSite } from "./en/export.js";
import { find } from "./en/find.js";
import { fonts } from "./en/fonts.js";
import { help } from "./en/help.js";
import { history } from "./en/history.js";
import { notes } from "./en/notes.js";
import { onboarding } from "./en/onboarding.js";
import { panels } from "./en/panels.js";
import { publish } from "./en/publish.js";
import { puck } from "./en/puck.js";
import { shell } from "./en/shell.js";
import { site } from "./en/site.js";
import { siteCheck } from "./en/siteCheck.js";
import { storage } from "./en/storage.js";
import { stylesheet } from "./en/stylesheet.js";
import { templates } from "./en/templates.js";
import { theme } from "./en/theme.js";
import { updates } from "./en/updates.js";
import { versions } from "./en/versions.js";

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
  siteCheck,
  storage,
  canvas,
  history,
  components,
  export: exportSite,
  fonts,
  puck,
  publish,
  theme,
  templates,
  ai,
  aiApps,
  assistant,
  versions,
  help,
  onboarding,
  updates,
  find,
  stylesheet,
  notes,
  blog,
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
  ...siteCheck,
  ...storage,
  ...canvas,
  ...history,
  ...components,
  ...exportSite,
  ...fonts,
  ...puck,
  ...publish,
  ...theme,
  ...templates,
  ...ai,
  ...aiApps,
  ...assistant,
  ...versions,
  ...help,
  ...onboarding,
  ...updates,
  ...find,
  ...stylesheet,
  ...notes,
  ...blog,
} as const;
