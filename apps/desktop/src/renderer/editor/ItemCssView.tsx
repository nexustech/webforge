import { Button } from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import type { NodeDoc } from "@webforge/model";
import { appearanceClassGroups, type ComponentDef, withLook } from "@webforge/site-components";
import { CheckIcon, CopyIcon } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import type { EditorSession } from "./editor-session.js";
import {
  type ClassGroup,
  type ItemCssApi,
  type ItemCssState,
  itemCssOf,
  tokensIn,
} from "./item-css.js";
import { useDocument, useUi } from "./use-document.js";

/** How long the document must stay unchanged before the tab asks for the CSS again. */
const REFRESH_DELAY_MS = 300;

/** What the CSS tab uses besides the document: the canvas styles worker, the clipboard, Settings. */
export type ItemCssServices = {
  /** The canvas styles worker, which writes the item as the export does. */
  readonly api: ItemCssApi;
  /** Puts text on the system clipboard (through main: the renderer has no web permissions). */
  readonly copyText: (text: string) => Promise<unknown>;
  /** Opens Settings at Custom Code, where CSS of the person's own goes (F-ED-15). */
  readonly onOpenCustomCode?: (() => void) | undefined;
};

/** The CSS tab's worker and clipboard through the preload API, reached only when used. */
export const PRELOAD_ITEM_CSS: Omit<ItemCssServices, "onOpenCustomCode"> = {
  api: {
    itemHtml: (request) => window.webforge.canvas.itemHtml(request),
    classCss: (theme, classes) => window.webforge.canvas.classCss(theme, classes),
  },
  copyText: (text) => window.webforge.clipboard.copyText(text),
};

/** Props of {@link ItemCssView}. */
export type ItemCssViewProps = ItemCssServices & {
  readonly session: Pick<EditorSession, "history" | "ui">;
  /** The selected item's classes, by the Appearance control that set them. */
  readonly groups: readonly ClassGroup[];
  /** A control's name, as the Style tab labels it. */
  readonly labelOf: (field: string) => string;
};

/** A part's Copy button, which says so for a moment once it has copied. */
function CopyButton({
  part,
  text,
  copyText,
}: {
  readonly part: string;
  readonly text: string;
  readonly copyText: ItemCssViewProps["copyText"];
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label={t("itemCss.copy.label", { part })}
      onClick={() => {
        void copyText(text).then(() => setCopied(true));
      }}
    >
      {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
      {t(copied ? "itemCss.copied" : "itemCss.copy")}
    </Button>
  );
}

/** One part of the tab: its heading and Copy button, then what it shows. */
function Part({
  title,
  hint,
  copy,
  copyText,
  children,
}: {
  readonly title: string;
  readonly hint?: string;
  /** What Copy puts on the clipboard; no Copy button without it. */
  readonly copy?: string | undefined;
  readonly copyText: ItemCssViewProps["copyText"];
  readonly children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <h4 id={id} className="text-xs font-semibold uppercase text-muted-foreground">
          {title}
        </h4>
        {copy === undefined ? null : (
          <span className="ml-auto">
            <CopyButton part={title} text={copy} copyText={copyText} />
          </span>
        )}
      </div>
      {hint === undefined ? null : <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </section>
  );
}

/** Code as it's written, kept on its lines and scrolled sideways rather than wrapped. */
const Code = ({ children }: { readonly children: string }) => (
  <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-xs">
    {children}
  </pre>
);

/**
 * Advanced mode's *CSS* tab (3.14, CT-7): the selected item as the export writes it, its classes by
 * the Appearance control that set them with the theme tokens behind each, and the rules they make
 * in the site's stylesheet. Read only: Webforge writes it again on the next change, so the tab says
 * so and points at Custom Code. It follows the document, asking again once it has been still for a
 * moment; nothing is logged.
 */
export function ItemCssView({
  session,
  api,
  copyText,
  groups,
  labelOf,
  onOpenCustomCode,
}: ItemCssViewProps) {
  const site = useDocument(session, (doc) => doc);
  const pageId = useUi(session, (ui) => ui.pageId);
  const nodeId = useUi(session, (ui) => ui.nodeId);
  const [css, setCss] = useState<ItemCssState | "loading">("loading");
  useEffect(() => {
    if (nodeId === null) return;
    let current = true;
    const timer = setTimeout(() => {
      void itemCssOf(site, pageId, nodeId, api)
        .catch((): ItemCssState => ({ status: "failed" }))
        .then((next) => {
          if (current) setCss(next);
        });
    }, REFRESH_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [site, pageId, nodeId, api]);

  const rules = css !== "loading" && css.status === "ready" ? css.rules : [];
  const cssOf = (classes: string) =>
    classes
      .split(" ")
      .flatMap((name) => rules.find((rule) => rule.className === name)?.css ?? [])
      .join("\n");
  const classesText = groups.map((group) => `${labelOf(group.field)}: ${group.classes}`).join("\n");
  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      <p className="text-xs text-muted-foreground">
        {t("itemCss.note")}{" "}
        {onOpenCustomCode === undefined ? null : (
          <Button
            size="sm"
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={onOpenCustomCode}
          >
            {t("itemCss.openCustomCode")}
          </Button>
        )}
      </p>
      {css === "loading" ? (
        <p role="status" className="text-muted-foreground">
          {t("itemCss.loading")}
        </p>
      ) : css.status === "hidden" ? (
        <p role="status" className="text-muted-foreground">
          {t("itemCss.hidden")}
        </p>
      ) : css.status === "failed" ? (
        <p role="status" className="text-muted-foreground">
          {t("itemCss.failed")}
        </p>
      ) : (
        <>
          <Part
            title={t("itemCss.markup")}
            hint={t("itemCss.markup.hint")}
            copy={css.html}
            copyText={copyText}
          >
            <Code>{css.html}</Code>
          </Part>
          <Part
            title={t("itemCss.classes")}
            copy={groups.length === 0 ? undefined : classesText}
            copyText={copyText}
          >
            {groups.length === 0 ? (
              <p className="text-muted-foreground">{t("itemCss.classes.none")}</p>
            ) : (
              <dl className="flex flex-col gap-1.5">
                {groups.map((group) => {
                  const tokens = tokensIn(cssOf(group.classes));
                  return (
                    <div key={group.field} className="flex flex-col">
                      <dt className="font-medium">
                        {labelOf(group.field)}
                        {group.fromLook === true ? (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            {t("itemCss.classes.fromLook")}
                          </span>
                        ) : null}
                      </dt>
                      <dd className="font-mono text-xs [overflow-wrap:anywhere]">
                        {group.classes}
                      </dd>
                      {tokens.length === 0 ? null : (
                        <dd className="text-xs text-muted-foreground">
                          {t("itemCss.classes.tokens", { tokens: tokens.join(", ") })}
                        </dd>
                      )}
                    </div>
                  );
                })}
              </dl>
            )}
          </Part>
          <Part
            title={t("itemCss.rules")}
            copy={rules.length === 0 ? undefined : rules.map((rule) => rule.css).join("\n\n")}
            copyText={copyText}
          >
            {rules.length === 0 ? (
              <p className="text-muted-foreground">{t("itemCss.rules.none")}</p>
            ) : (
              <Code>{rules.map((rule) => rule.css).join("\n\n")}</Code>
            )}
          </Part>
        </>
      )}
    </div>
  );
}

/**
 * The CSS tab for `node` (3.14): its classes grouped by the Appearance control that set them, from
 * its own values with its kind's look in the theme under them (3.12), as it renders; each named as
 * `component`'s Style tab names it.
 */
export function ItemCss({
  session,
  node,
  component,
  services,
}: {
  readonly session: Pick<EditorSession, "history" | "ui">;
  readonly node: NodeDoc;
  readonly component: ComponentDef;
  readonly services: ItemCssServices;
}) {
  const looks = useDocument(session, (site) => site.theme.looks);
  const groups = appearanceClassGroups(withLook(node.props, node.type, looks)).map((group) => ({
    ...group,
    fromLook: node.props[group.field] === undefined,
  }));
  return (
    <ItemCssView
      session={session}
      {...services}
      groups={groups}
      labelOf={(field) => component.fields[field]?.label ?? field}
    />
  );
}
