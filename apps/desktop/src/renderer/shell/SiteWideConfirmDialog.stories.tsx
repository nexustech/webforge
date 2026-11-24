import type { Meta, StoryObj } from "@storybook/react-vite";
import { plural, t } from "@webforge/i18n";
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

/**
 * An AI app's change to every page (D7), offering to let it work without asking (5.35, UA-2):
 * Allow, Allow and don't ask again for an hour, or Cancel.
 */
export const AiAppOffersUnasked: Story = {
  args: {
    action: {
      action: "Allow Claude Desktop to Change the Theme?",
      confirm: t("ai.confirm.allow"),
      affectedPages: 6,
      allowAlways: () => undefined,
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
          plural("ai.plan.moreAsks", 40),
        ].join(" "),
      ].join("\n\n"),
      confirm: t("ai.confirm.allow"),
      affectedPages: 152,
    },
  },
};

/** A picture for the stories, as an SVG with no text, so it draws the same everywhere. */
const svg = (width: number, height: number, shapes: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${shapes}</svg>`,
  )}`;

/** A wide logo with a see-through background, and a square icon. */
const LOGO = svg(
  240,
  80,
  '<circle cx="40" cy="40" r="32" fill="#c0392b"/><rect x="88" y="22" width="132" height="14" rx="7" fill="#2c3e50"/><rect x="88" y="46" width="96" height="10" rx="5" fill="#7f8c8d"/>',
);
const ICON = svg(
  64,
  64,
  '<rect width="64" height="64" rx="14" fill="#c0392b"/><circle cx="32" cy="32" r="14" fill="#fff"/>',
);

/**
 * An AI app setting the logo and the site's icon (UA-8): always asked, each named from and to by
 * its file name, and each new picture shown small, so the person sees what they allow.
 */
export const AiAppSetsLogo: Story = {
  args: {
    action: {
      action: t("ai.confirm.settings", {
        app: "Claude Desktop",
        sections: t("site.settings.section.general"),
      }),
      description: [
        t("ai.confirm.destinationFromTo", {
          field: t("site.settings.logo"),
          from: t("ai.confirm.noPicture"),
          to: t("ai.confirm.toPicture", { file: "rapidfix-logo.png" }),
        }),
        t("ai.confirm.destinationFromTo", {
          field: t("site.settings.icon"),
          from: t("ai.confirm.toPicture", { file: "old-icon.png" }),
          to: t("ai.confirm.toPicture", { file: "rapidfix-icon.png" }),
        }),
      ].join(" "),
      confirm: t("ai.confirm.allow"),
      affectedPages: 6,
      pictures: [
        { label: t("site.settings.logo"), src: LOGO },
        { label: t("site.settings.icon"), src: ICON },
      ],
    },
  },
};
