import { addPanelArea } from "./add/area.js";
import { aiRequestsArea } from "./ai/area.js";
import { clipboardCommandsArea, styleCommandsArea } from "./clipboard/area.js";
import { editPanelArea } from "./edit-panel/area.js";
import type { Area, EditorContext, WindowContext } from "./editor/areas.js";
import {
  canvasCommandsArea,
  columnsToolbarArea,
  elementCommandsArea,
  fieldDragsArea,
  headerToolbarArea,
  siteCssArea,
  textToolbarsArea,
} from "./editor/editor-areas.js";
import { exportCommandArea } from "./export/area.js";
import { layersPanelArea } from "./layers/area.js";
import { canvasImagesArea, mediaPanelArea } from "./media/area.js";
import { canvasNavigationArea } from "./menu/area.js";
import { previewArea } from "./preview/area.js";
import { settingsArea } from "./settings/area.js";
import { sharedSectionCommandsArea } from "./shared-sections/area.js";
import { viewCommandsArea } from "./shell/area.js";
import { pageCommandsArea, sitePanelArea } from "./site/area.js";
import { siteCheckArea } from "./site-check/area.js";
import { canvasSettingsArea, siteCodeArea, siteSettingsArea } from "./site-settings/area.js";
import { saveSiteZipArea } from "./start/save-site-zip.js";
import { crashReportsArea } from "./storage/area.js";
import { themePanelArea } from "./theme/area.js";
import { undoHistoryArea } from "./undo-history/area.js";

/*
 * The composition root (2.20, B1): every area the editor window registers, in order. Menus, the
 * command box and each panel slot list what is registered in the order it registers, so an area's
 * place in its list is its place there.
 *
 * Two lists, for two moments. The editor's areas register around its canvas as the editor mounts
 * (those needing the canvas engine as each engine mounts): the Edit menu's commands, after Undo
 * and Redo. The window's register after the shell's own commands (New Site, About), as the window
 * mounts: so Export follows Site Settings in the File menu, and the view commands follow the panel
 * toggles in the View menu.
 */

/** The areas the editor registers (Editor), in order. */
export const EDITOR_AREAS: readonly Area<EditorContext>[] = [
  // First, so Undo and Redo head the Edit menu, and the Edit panel tops the right column.
  undoHistoryArea,
  editPanelArea,
  siteCssArea,
  canvasImagesArea,
  canvasSettingsArea,
  canvasNavigationArea,
  clipboardCommandsArea,
  styleCommandsArea,
  canvasCommandsArea,
  sharedSectionCommandsArea,
  elementCommandsArea,
  addPanelArea,
  fieldDragsArea,
  mediaPanelArea,
  textToolbarsArea,
  headerToolbarArea,
  columnsToolbarArea,
];

/** The areas the window registers (App), in order. */
export const WINDOW_AREAS: readonly Area<WindowContext>[] = [
  sitePanelArea,
  pageCommandsArea,
  layersPanelArea,
  crashReportsArea,
  viewCommandsArea,
  exportCommandArea,
  saveSiteZipArea,
  previewArea,
  settingsArea,
  siteSettingsArea,
  siteCodeArea,
  themePanelArea,
  siteCheckArea,
  aiRequestsArea,
];
