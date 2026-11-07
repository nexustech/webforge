import type { HelpPage, Token, Tokens } from "@webforge/help";
import { t } from "@webforge/i18n";
import type { ReactNode } from "react";
import type { HelpTarget } from "../../shared/ipc/help.js";
import { helpLinkDestination } from "./help-navigation.js";

export type HelpPageViewProps = {
  readonly page: HelpPage;
  /** Shows another help page, or a heading of one. */
  readonly onHelpLink: (target: HelpTarget) => void;
  /** Opens a page on the web in the browser. */
  readonly onWebLink: (url: string) => void;
};

/** What drawing a page needs besides its tokens. */
type Context = HelpPageViewProps & { readonly anchors: ReadonlyMap<Token, string> };

/** `{appName}` in a page's text, as the app's name (`docs/branding.md`). */
const withAppName = (text: string) => text.replaceAll("{appName}", t("app.name"));

const HEADING_CLASSES: Readonly<Record<number, string>> = {
  1: "mb-3 text-2xl font-semibold",
  2: "mt-8 mb-2 text-xl font-semibold",
  3: "mt-6 mb-1 text-lg font-semibold",
};

/** A link: in Help, on the web (opens the browser), or nowhere the window can go (text). */
function Link({ token, context }: { readonly token: Tokens.Link; readonly context: Context }) {
  const children = inline(token.tokens, context);
  const destination = helpLinkDestination(token.href, context.page.id);
  if (destination.kind === "none") return <>{children}</>;
  const web = destination.kind === "web";
  return (
    <a
      href={web ? destination.url : `#${destination.target.anchor ?? ""}`}
      className="text-primary underline underline-offset-2 hover:no-underline"
      {...(web ? { title: t("help.link.external", { text: withAppName(token.text) }) } : {})}
      onClick={(event) => {
        event.preventDefault();
        if (destination.kind === "web") context.onWebLink(destination.url);
        else context.onHelpLink(destination.target);
      }}
    >
      {children}
    </a>
  );
}

/** Inline tokens as React: text, emphasis, code, links. Raw HTML is shown as text. */
function inline(tokens: readonly Token[] | undefined, context: Context): ReactNode {
  return (tokens ?? []).map((token, index) => {
    switch (token.type) {
      case "strong":
        return <strong key={index}>{inline(token.tokens, context)}</strong>;
      case "em":
        return <em key={index}>{inline(token.tokens, context)}</em>;
      case "del":
        return <del key={index}>{inline(token.tokens, context)}</del>;
      case "codespan":
        return (
          <code key={index} className="rounded bg-muted px-1 font-mono text-[0.9em]">
            {(token as Tokens.Codespan).text}
          </code>
        );
      case "br":
        return <br key={index} />;
      case "link":
        return <Link key={index} token={token as Tokens.Link} context={context} />;
      case "image":
        return withAppName((token as Tokens.Image).text);
      default: {
        const nested = (token as { tokens?: Token[] }).tokens;
        if (nested !== undefined && nested.length > 0) return inline(nested, context);
        return withAppName("text" in token ? String(token.text) : token.raw);
      }
    }
  });
}

/** Block tokens as React: headings with their anchors, paragraphs, lists, tables, code. */
function blocks(tokens: readonly Token[], context: Context): ReactNode {
  return tokens.map((token, index) => {
    switch (token.type) {
      case "heading": {
        const heading = token as Tokens.Heading;
        const level = Math.min(Math.max(heading.depth, 1), 6);
        const Tag = `h${level}` as "h1";
        return (
          <Tag
            key={index}
            id={context.anchors.get(token)}
            className={HEADING_CLASSES[level] ?? "mt-4 mb-1 font-semibold"}
          >
            {inline(heading.tokens, context)}
          </Tag>
        );
      }
      case "paragraph":
        return (
          <p key={index} className="my-2 leading-relaxed">
            {inline((token as Tokens.Paragraph).tokens, context)}
          </p>
        );
      case "list": {
        const list = token as Tokens.List;
        const items = list.items.map((item, at) => (
          <li key={at} className="my-1">
            {blocks(item.tokens, context)}
          </li>
        ));
        return list.ordered ? (
          <ol key={index} className="my-2 list-decimal pl-6">
            {items}
          </ol>
        ) : (
          <ul key={index} className="my-2 list-disc pl-6">
            {items}
          </ul>
        );
      }
      case "table": {
        const table = token as Tokens.Table;
        const align = (at: number) => table.align[at] ?? "left";
        return (
          <div key={index} className="my-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {table.header.map((cell, at) => (
                    <th
                      key={at}
                      scope="col"
                      style={{ textAlign: align(at) }}
                      className="border-b border-border px-2 py-1.5 font-semibold"
                    >
                      {inline(cell.tokens, context)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, at) => (
                  <tr key={at} className="align-top">
                    {row.map((cell, column) => (
                      <td
                        key={column}
                        style={{ textAlign: align(column) }}
                        className="border-b border-border px-2 py-1.5"
                      >
                        {inline(cell.tokens, context)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      case "code":
        return (
          <pre key={index} className="my-3 overflow-x-auto rounded bg-muted p-3 text-sm">
            <code className="font-mono">{(token as Tokens.Code).text}</code>
          </pre>
        );
      case "blockquote":
        return (
          <blockquote
            key={index}
            className="my-3 border-l-4 border-border pl-4 text-muted-foreground"
          >
            {blocks((token as Tokens.Blockquote).tokens, context)}
          </blockquote>
        );
      case "hr":
        return <hr key={index} className="my-6 border-border" />;
      case "space":
        return null;
      // A list item's text, and anything else: its words, never raw HTML.
      default: {
        const nested = (token as { tokens?: Token[] }).tokens;
        return (
          <span key={index}>
            {nested !== undefined && nested.length > 0
              ? inline(nested, context)
              : withAppName("text" in token ? String(token.text) : token.raw)}
          </span>
        );
      }
    }
  });
}

/**
 * A help page, drawn from its Markdown tokens (5.4b, HP-6), never from HTML: a page's raw HTML
 * shows as text, which `pnpm help-check` keeps out anyway. Headings carry their anchors, so a link
 * or a **?** reaches them; links between pages stay in Help, and a page on the web opens in the
 * browser. `{appName}` is the app's name.
 */
export function HelpPageView(props: HelpPageViewProps) {
  const anchors = new Map<Token, string>(
    props.page.headings.map((heading) => [heading.token, heading.anchor]),
  );
  return (
    <article className="max-w-3xl">{blocks(props.page.tokens, { ...props, anchors })}</article>
  );
}
