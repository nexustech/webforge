import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  formatTotals,
  readReports,
  reportTotals,
} from "../../apps/desktop/src/main/report-totals.js";
import { loadUsageLists } from "../../apps/desktop/src/main/usage-summary.js";

// The beta's reports added up (5.42, BD-3): `pnpm report-totals <folder>` reads every `.json` and
// `.txt` file in the folder (the reports testers attached, as downloaded), checks each against the
// usage summary's schema, counts each install once, and prints the totals for note 22 §2's
// questions. `docs/beta/triage.md` says when to run it and where the totals go.

const folder = process.argv[2];
if (folder === undefined) {
  console.error("Usage: pnpm report-totals <folder of reports>");
  process.exit(2);
}
const names = (await readdir(folder)).filter((name) => /\.(json|txt)$/i.test(name)).sort();
const reports = await Promise.all(
  names.map(async (name) => ({ name, text: await readFile(join(folder, name), "utf8") })),
);
const lists = await loadUsageLists();
const read = readReports(reports, lists);
process.stdout.write(formatTotals(read, reportTotals(read.summaries, lists)));
