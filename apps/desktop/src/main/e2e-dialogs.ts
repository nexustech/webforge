import { readFileSync } from "node:fs";
import { z } from "zod";

/** The environment variable naming the answers file; the smoke test checks it isn't shipped. */
export const E2E_DIALOGS_VARIABLE = "WEBFORGE_E2E_DIALOGS";

/** The native file dialogs a test can answer. */
export type E2eDialog = "save" | "open" | "folder";

const answersSchema = z.strictObject({
  save: z.string().min(1).optional(),
  open: z.string().min(1).optional(),
  folder: z.string().min(1).optional(),
});

/**
 * Test-only answers for the native file dialogs (ADR 0005, finding 6). Packaged E2E tests reach
 * only the renderer (Fuses switch off `--inspect`), so unlike the unpacked tests they can't
 * replace `dialog` in the main process. Instead, when `WEBFORGE_E2E_DIALOGS` names a JSON file
 * (`{ "save"?: path, "open"?: path, "folder"?: path }`), each dialog answers from it, read when
 * the dialog would show, so a test can change its answers as it goes; a dialog it leaves out
 * counts as cancelled.
 *
 * Returns `undefined` when there is no answers file, and the dialog shows as usual. `index.ts`
 * loads this module only in `--mode e2e` builds, so normal builds don't contain it.
 */
export function e2eDialogAnswer(
  dialog: E2eDialog,
  env: NodeJS.ProcessEnv = process.env,
): { readonly path: string | undefined } | undefined {
  const file = env[E2E_DIALOGS_VARIABLE];
  if (file === undefined || file === "") {
    return undefined;
  }
  const answers = answersSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  return { path: answers[dialog] };
}
