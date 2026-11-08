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

/** The pages an AI app's long plan adds: ten named, and the rest counted. */
const addedPages = Array.from({ length: 10 }, (_, at) => `"Service ${at + 1}"`).join(", ");

/**
 * An AI app's long plan (S30, #795): its payment link and Site Settings changes first, set apart,
 * then the rest, cut short. The question scrolls, and Allow and Cancel stay in view.
 */
export const LongPlan: Story = {
  args: {
    action: {
      action: t("ai.confirm.plan", { app: "Claude Desktop", title: "Add service pages" }),
      description: [
        [
          t("ai.plan.first"),
          t("ai.confirm.destination", {
            app: "Claude Desktop",
            item: "Buy button",
            field: "Payment link",
          }),
          t("ai.confirm.destinationFromTo", {
            field: "Payment link",
            from: "buy.stripe.com",
            to: "pay.example.net",
          }),
          t("ai.confirm.settings", { app: "Claude Desktop", sections: "Contact & hours" }),
          t("ai.confirm.destinationFromTo", {
            field: "Email",
            from: "hello@rapidfix.example",
            to: "orders@example.net",
          }),
        ].join(" "),
        [
          t("ai.plan.pagesAdded", { pages: `${addedPages} ${t("ai.plan.more", { count: 140 })}` }),
          t("ai.plan.elements", { added: 300, changed: 150, moved: 0, removed: 0 }),
        ].join(" "),
        [
          t("ai.plan.asks"),
          ...Array.from({ length: 10 }, (_, at) =>
            t("ai.confirm.layout", { app: "Claude Desktop", part: `part ${at + 1}` }),
          ),
          t("ai.plan.moreAsks", { count: 40 }),
        ].join(" "),
      ].join("\n\n"),
      confirm: t("ai.confirm.allow"),
      affectedPages: 152,
    },
  },
};
