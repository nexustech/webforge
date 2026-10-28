/**
 * The settings area (LF-12): what other areas use of it. Another area imports only from this file
 * (`pnpm deps`, B2); everything else here is the area's own.
 */

export { registerAppSettings } from "./app-settings.js";
export { SettingsDialog } from "./SettingsDialog.js";
export { SettingsHost } from "./SettingsHost.js";
