import type { Meta, StoryObj } from "@storybook/react-vite";
import { FieldRenderersProvider } from "@webforge/editor-ui";
import { type NodeDoc, newId, type SiteDoc } from "@webforge/model";
import { useEffect, useState } from "react";
import { fireEvent, userEvent, within } from "storybook/test";
import { starterSite } from "../../shared/starter-site.js";
import { EditPanelHost } from "../editor/EditPanelHost.js";
import type { EditorSession } from "../editor/editor-session.js";
import { ElementMenu } from "../element-menu/index.js";
import { fieldRenderers } from "../fields/index.js";
import { useCommand, useCommandRegistry } from "../shell/command-context.js";
import { createSiteWideConfirm, SiteWideConfirmDialog } from "../shell/confirm-site-wide.js";
import { createPreferencesStore } from "../shell/preferences-store.js";
import { dialogStory } from "../testing/stories.js";
import { LOOK_COMMANDS, lookChange, lookConfirmation, registerLookCommands } from "./apply-look.js";

// Apply Look to Every… (2.27, ST-4): in the element menu, in the Appearance group's right-click
// menu, and the question asked before it changes other pages (D7).
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

/** Registers the look commands on the story's registry, with the styled Button selected. */
function useLookCommands(session: EditorSession) {
  const registry = useCommandRegistry();
  const [confirm] = useState(createSiteWideConfirm);
  useEffect(() => {
    session.select("styled");
    return registerLookCommands(registry, session, () => undefined, confirm).remove;
  }, [registry, session, confirm]);
  return confirm;
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

/** The Edit panel on the styled Button, the Appearance group's right-click menu open. */
function PanelOnButton({ session }: { readonly session: EditorSession }) {
  useLookCommands(session);
  const registry = useCommandRegistry();
  const actions = [useCommand(LOOK_COMMANDS.page), useCommand(LOOK_COMMANDS.site)].flatMap(
    (command) =>
      command === undefined
        ? []
        : [
            {
              label: command.label,
              enabled: command.enabled !== false,
              onSelect: () => void registry.run(command.id),
            },
          ],
  );
  const [renderers] = useState(() =>
    fieldRenderers({
      session,
      preferences: createPreferencesStore(),
      // No image picker asked for from the canvas in a story.
      imagePicks: { request: () => undefined, take: () => false, subscribe: () => () => undefined },
    }),
  );
  return (
    <FieldRenderersProvider renderers={renderers}>
      <div className="h-[720px] w-80 bg-panel text-foreground">
        <EditPanelHost
          session={session}
          flush={() => undefined}
          groupActions={(id) => (id === "appearance" ? actions : [])}
        />
      </div>
    </FieldRenderersProvider>
  );
}

/** The Appearance group's right-click menu, with the panel's own actions first. */
export const InAppearanceGroup: Story = {
  ...dialogStory((session) => <PanelOnButton session={session} />, { site: siteWithButtons() }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("tab", { name: "Style" }));
    fireEvent.contextMenu(await canvas.findByRole("button", { name: "Appearance" }));
    await within(canvasElement.ownerDocument.body).findByRole("menuitem", {
      name: "Apply Look to Every Button on the Site",
    });
  },
};

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
