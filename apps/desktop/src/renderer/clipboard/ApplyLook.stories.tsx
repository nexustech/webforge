import type { Meta, StoryObj } from "@storybook/react-vite";
import { type NodeDoc, newId, type SiteDoc } from "@webforge/model";
import { useEffect, useState } from "react";
import { starterSite } from "../../shared/starter-site.js";
import type { EditorSession } from "../editor/editor-session.js";
import { ElementMenu } from "../element-menu/index.js";
import { useCommand, useCommandRegistry } from "../shell/command-context.js";
import { createSiteWideConfirm, SiteWideConfirmDialog } from "../shell/confirm-site-wide.js";
import { dialogStory } from "../testing/stories.js";
import { LOOK_COMMANDS, lookChange, lookConfirmation, registerLookCommands } from "./apply-look.js";
import { registerStyleCommands } from "./style-clipboard.js";

// Apply Look to Every… (2.27, ST-4): in the element menu, and the question asked before it changes
// other pages (D7). The Appearance group's right-click menu offers the same commands (a test).
const meta = { title: "Edit/Apply look to every" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const button = (id: string, look: Readonly<Record<string, unknown>> = {}): NodeDoc => ({
  type: "Button",
  props: { id, label: "Book a table", link: "about", ...look },
});

/**
 * The starter site with a styled Button on Home, and plain ones on Home and on two more pages,
 * one of them in a hidden section.
 */
function siteWithButtons(): SiteDoc {
  const site = starterSite();
  const home = site.pages[site.homePageId];
  if (home === undefined) return site;
  home.doc.content = [
    {
      type: "Section",
      props: {
        id: "s",
        content: [button("styled", { lookShadow: "large", lookCorners: "full" }), button("plain")],
      },
    },
  ];
  for (const [slug, hidden] of [
    ["menu", false],
    ["contact", true],
  ] as const) {
    const id = newId("page");
    site.pages[id] = {
      ...structuredClone(home),
      id,
      slug,
      title: slug,
      doc: {
        root: { props: {} },
        content: [
          { type: "Section", props: { id: `${slug}-s`, hidden, content: [button(`${slug}-b`)] } },
        ],
      },
    };
    site.pageOrder.push(id);
  }
  return site;
}

/**
 * Registers Copy Style, Paste Style and the look commands on the story's registry, as the app does,
 * with the styled Button selected.
 */
function useLookCommands(session: EditorSession) {
  const registry = useCommandRegistry();
  const [confirm] = useState(createSiteWideConfirm);
  useEffect(() => {
    session.select("styled");
    const style = registerStyleCommands(registry, session, () => undefined);
    const look = registerLookCommands(registry, session, () => undefined, confirm);
    return () => {
      look.remove();
      style.remove();
    };
  }, [registry, session, confirm]);
}

/** The element menu on the styled Button, open. */
function MenuOnButton({ session }: { readonly session: EditorSession }) {
  useLookCommands(session);
  // Drawn once the commands are registered, as the menu opens on a selected element.
  const ready = useCommand(LOOK_COMMANDS.site) !== undefined;
  return (
    <div className="h-[420px] w-[480px] bg-background">
      <ElementMenu
        at={ready ? { x: 24, y: 24 } : null}
        onClose={() => undefined}
        onRename={undefined}
      />
    </div>
  );
}

/** The element menu: the two actions after Copy Style and Paste Style, named for the Button. */
export const InElementMenu: Story = dialogStory((session) => <MenuOnButton session={session} />, {
  site: siteWithButtons(),
});

/** The question it asks, as the Edit menu's command asks it for the site. */
function Asking({ session }: { readonly session: EditorSession }) {
  const [confirm] = useState(() => {
    const created = createSiteWideConfirm();
    session.select("styled");
    const change = lookChange(session, "site");
    if (change !== undefined) void created.confirmSiteWide(lookConfirmation(change, "site"));
    return created;
  });
  return <SiteWideConfirmDialog confirm={confirm} />;
}

/** How many change, how many are hidden, on how many pages; Cancel changes nothing. */
export const Confirmation: Story = dialogStory((session) => <Asking session={session} />, {
  site: siteWithButtons(),
});
