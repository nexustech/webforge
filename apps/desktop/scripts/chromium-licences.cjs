// electron-builder's `afterExtract` hook (5.3): Chromium's licences in a Mac app.
//
// electron-builder leaves Electron's LICENSES.chromium.html beside the program on Windows, but
// deletes it from a Mac app's folder once the bundle is made. So, just after Electron is unpacked
// and before that, it is copied into the bundle's Resources, where the main process reads it
// (`licenceFiles` in src/main/licences.ts). The packaged-app E2E test checks it is there.
//
// CommonJS, as electron-builder loads its hooks with `require`.

const { copyFile } = require("node:fs/promises");
const { join } = require("node:path");

/** @param {{ appOutDir: string, electronPlatformName: string, packager: { info: { framework: { distMacOsAppName?: string } } } }} context */
exports.default = async function chromiumLicences(context) {
  if (context.electronPlatformName !== "darwin") return;
  const bundle = context.packager.info.framework.distMacOsAppName ?? "Electron.app";
  await copyFile(
    join(context.appOutDir, "LICENSES.chromium.html"),
    join(context.appOutDir, bundle, "Contents", "Resources", "LICENSES.chromium.html"),
  );
};
