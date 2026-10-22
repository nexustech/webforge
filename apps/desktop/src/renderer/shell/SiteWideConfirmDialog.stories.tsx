import type { Meta, StoryObj } from "@storybook/react-vite";
import { t } from "@webforge/i18n";
import { useState } from "react";
import {
  createSiteWideConfirm,
  type SiteWideAction,
  SiteWideConfirmDialog,
} from "./confirm-site-wide.js";

/** The dialog, asking `action` as soon as it shows. */
function Asking({ action }: { readonly action: SiteWideAction }) {
  const [confirm] = useState(() => {
    const created = createSiteWideConfirm();
    void created.confirmSiteWide(action);
    return created;
  });
  return <SiteWideConfirmDialog confirm={confirm} />;
}

const meta = {
  title: "Shell/SiteWideConfirmDialog",
  component: Asking,
} satisfies Meta<typeof Asking>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Deleting a page the menu links to changes every page (D7). */
export const DeletePage: Story = {
  args: {
    action: {
      action: t("pages.deleteDialog.title", { name: "Contact" }),
      description: t("pages.deleteDialog.description"),
      confirm: t("pages.deleteDialog.confirm"),
      affectedPages: 6,
    },
  },
};

/** Deleting an element of the shared Footer changes every page that shows it (F-ED-7). */
export const SharedFooterElement: Story = {
  args: {
    action: {
      action: t("canvas.sharedDelete.title", {
        item: "Heading",
        region: t("canvas.sharedRegion.footer"),
      }),
      confirm: t("canvas.delete"),
      affectedPages: 1,
    },
  },
};
