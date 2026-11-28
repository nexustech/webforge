import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ExportDialogs } from "./ExportDialogs.js";
import { createExportDialogs, type ExportReport } from "./export-dialogs.js";

/** The report `report` shows, as the export opens it once it's done. */
function Showing({ report }: { readonly report: ExportReport }) {
  const [dialogs] = useState(() => {
    const made = createExportDialogs();
    made.showReport(report);
    return made;
  });
  return (
    <ExportDialogs
      dialogs={dialogs}
      actions={{
        onOpen: () => undefined,
        onShowFolder: () => undefined,
        onSiteCheck: () => undefined,
      }}
    />
  );
}

// Site Exported (3.3, 07): where the site went, what's worth a look, and Done, the primary, last
// (#1444), as Your Site Is Live has it.
const meta = {
  title: "Dialogs/Site Exported",
  component: Showing,
} satisfies Meta<typeof Showing>;

export default meta;
type Story = StoryObj<typeof meta>;

const REPORT: ExportReport = {
  format: "folder",
  name: "rosas-bakery",
  location: String.raw`D:\Sites\rosas-bakery`,
  summary: "Pages: 4 · Files: 23 · Size: 2.4 MB",
  issues: ["On “About us”, a link goes to a page that's been deleted."],
  more: 0,
  noWebAddress: false,
  toFix: 1,
};

/** A folder: Show the Folder and Open in Browser, then Done. */
export const Folder: Story = { args: { report: REPORT } };

/** A ZIP file: Show ZIP File, then Done. */
export const Zip: Story = {
  args: { report: { ...REPORT, format: "zip", name: "rosas-bakery.zip", issues: [], toFix: 0 } },
};
