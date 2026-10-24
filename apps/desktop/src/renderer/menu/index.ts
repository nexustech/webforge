/**
 * The navigation menu's area (F-ED-17): what other areas use of it. Another area imports only from this file (`pnpm deps`, B2); everything else
 * here is the area's own.
 */

export { MenuPanel, type MenuPanelActions } from "./MenuPanel.js";
export {
  addMenuItem,
  editMenuLink,
  followPages,
  moveMenuItem,
  removeMenuItem,
  renameMenuItem,
  setMenuItemHidden,
} from "./menu-actions.js";
