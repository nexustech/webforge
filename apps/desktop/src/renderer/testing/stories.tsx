import { TooltipProvider } from "@webforge/editor-ui";
import type { SiteDoc } from "@webforge/model";
import {
  type ReactElement,
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { EditorSession } from "../editor/editor-session.js";
import { CommandRegistryProvider } from "../shell/command-context.js";
import { ContextualToolbarsProvider } from "../shell/contextual-toolbar-context.js";
import { PanelRegistryProvider } from "../shell/panel-context.js";
import type { PanelRegistry } from "../shell/panels.js";
import { registriesForTest, sessionWith, type TestRegistries } from "./fixtures.js";

/**
 * Story helpers for the app's Storybook (2.20, B6): a panel as its area registers it, and a dialog
 * on a session, each in the providers the app gives them. Every `register…Panel` has a story made
 * with {@link panelStory}; a test checks it.
 */

/** What a story starts from: the site (a new site's starter page by default). */
export type StoryFixture = { readonly site?: SiteDoc };

/** A story that draws itself, for a story file's `render`. */
export type DrawnStory = { readonly render: () => ReactElement };

/** The providers the app wraps every panel and dialog in. */
function AppProviders({
  registries,
  children,
}: {
  readonly registries: TestRegistries;
  readonly children: ReactNode;
}) {
  return (
    <CommandRegistryProvider registry={registries.commands}>
      <PanelRegistryProvider registry={registries.panels}>
        <ContextualToolbarsProvider registry={registries.toolbars}>
          <TooltipProvider>{children}</TooltipProvider>
        </ContextualToolbarsProvider>
      </PanelRegistryProvider>
    </CommandRegistryProvider>
  );
}

/**
 * How an area registers a panel: into the registry, on a session; returns how to remove it (a
 * function, or a registration with `remove()`, as the Add panel's).
 */
export type RegisterPanel = (
  panels: PanelRegistry,
  session: EditorSession,
  registries: TestRegistries,
) => (() => void) | { readonly remove: () => void };

function PanelHost({
  register,
  site,
}: {
  readonly register: RegisterPanel;
  readonly site?: SiteDoc;
}) {
  const [registries] = useState(registriesForTest);
  const [session] = useState(() => sessionWith(site));
  useEffect(() => {
    const registered = register(registries.panels, session, registries);
    return typeof registered === "function" ? registered : () => registered.remove();
  }, [register, registries, session]);
  const panels = useSyncExternalStore(
    registries.panels.subscribe,
    registries.panels.list,
    registries.panels.list,
  );
  return (
    <AppProviders registries={registries}>
      {/* "drawing" until the panels, registered in an effect after the first render, are on the
          page: the visual tests wait for "ready" (#365). */}
      <div
        className="flex h-[640px] gap-3 bg-background p-3 text-foreground"
        data-story-state={panels.length === 0 ? "drawing" : "ready"}
      >
        {panels.map(({ id, title, component: Panel }) => (
          <section
            key={id}
            aria-label={title}
            className="flex w-80 flex-col overflow-hidden rounded-md border border-border"
          >
            <h2 className="border-b border-border px-3 py-1.5 text-xs font-medium">{title}</h2>
            <div className="min-h-0 flex-1 overflow-auto">
              <Panel />
            </div>
          </section>
        ))}
      </div>
    </AppProviders>
  );
}

/**
 * A story of the panels `register` adds (2.20, B6): registered into a registry of their own on a
 * session for `fixture`'s site, as the app does, and drawn side by side, each under its title.
 *
 * @example export const Layers: Story = panelStory((panels, session) => registerLayersPanel(panels, session));
 */
export function panelStory(register: RegisterPanel, fixture: StoryFixture = {}): DrawnStory {
  return { render: () => <PanelHost register={register} {...fixture} /> };
}

function DialogHost({
  draw,
  site,
}: {
  readonly draw: (session: EditorSession) => ReactNode;
  readonly site?: SiteDoc;
}) {
  const [registries] = useState(registriesForTest);
  const [session] = useState(() => sessionWith(site));
  return <AppProviders registries={registries}>{draw(session)}</AppProviders>;
}

/**
 * A story of a dialog `draw` shows on a session for `fixture`'s site (2.20, B6), in the providers
 * the app gives it.
 */
export function dialogStory(
  draw: (session: EditorSession) => ReactNode,
  fixture: StoryFixture = {},
): DrawnStory {
  return { render: () => <DialogHost draw={draw} {...fixture} /> };
}
