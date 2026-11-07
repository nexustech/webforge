import { Button, cn, Tooltip, TooltipContent, TooltipTrigger } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import { CircleHelpIcon } from "lucide-react";
import { createContext, type ReactNode, useContext } from "react";
import type { HelpTarget } from "../../shared/ipc/help.js";
import { bundledHelpLibrary } from "./help-library.js";
import HELP_LINKS from "./help-links.json";

/**
 * A **?** link's topic (5.4b, HP-6): each opens a fixed page and heading, kept in one table
 * (`help-links.json`) that `pnpm help-check` checks.
 */
export type HelpTopic = keyof typeof HELP_LINKS;

/** Where `topic`'s **?** opens Help. */
const helpLinkOf = (topic: HelpTopic): HelpTarget => HELP_LINKS[topic];

/** The **?** topic of a Settings section, by its id in the dialog (`site:general`), if it has one. */
export function settingsHelpTopic(group: string): HelpTopic | undefined {
  const topic = `settings.${group}`;
  return Object.hasOwn(HELP_LINKS, topic) ? (topic as HelpTopic) : undefined;
}

/** Opens the Help window at a page and heading; without one, a **?** isn't drawn. */
const HelpOpener = createContext<((target: HelpTarget) => void) | undefined>(undefined);

/** Gives the **?** buttons below it a way to open the Help window (the window's `api.help`). */
export function HelpProvider({
  open,
  children,
}: {
  readonly open: (target: HelpTarget) => void;
  readonly children: ReactNode;
}) {
  return <HelpOpener.Provider value={open}>{children}</HelpOpener.Provider>;
}

/** What a **?** is named by: its heading on the page, or the page's title. */
function nameOf(target: HelpTarget): string {
  const page = target.page === undefined ? undefined : bundledHelpLibrary().pages.get(target.page);
  const heading = page?.headings.find((each) => each.anchor === target.anchor);
  return (heading?.text ?? page?.title ?? "").replaceAll("{appName}", t("app.name"));
}

/**
 * A small **?** that opens the Help window at `topic`'s page and heading (5.4b, HP-6), named for
 * what it opens ("Help: Page Settings"). Drawn only where Help can open (inside a
 * {@link HelpProvider}).
 */
export function HelpButton({
  topic,
  about,
  className,
}: {
  readonly topic: HelpTopic;
  /** What it's help about, when the heading it opens isn't: a Site Check rule's name. */
  readonly about?: string;
  readonly className?: string;
}) {
  const open = useContext(HelpOpener);
  if (open === undefined) return null;
  const target = helpLinkOf(topic);
  const label = t("help.button", { topic: about ?? nameOf(target) });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          className={cn("size-6 text-muted-foreground hover:text-foreground", className)}
          onClick={() => open(target)}
        >
          <CircleHelpIcon aria-hidden className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
