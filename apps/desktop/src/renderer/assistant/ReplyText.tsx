import { t } from "@webforge/i18n";
import { Lexer, type Token, type Tokens } from "marked";
import { Fragment, type ReactNode } from "react";

/** Props of {@link ReplyText}. */
export type ReplyTextProps = {
  /** The reply's text so far, as the model streamed it. */
  readonly text: string;
  /** Opens a web address in the person's browser, once they have clicked its link. */
  readonly onOpenLink: (href: string) => void;
};

/** A link's address as the reply shows it, or none when it isn't a web address. */
function webAddress(href: string): URL | undefined {
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "http:" ? url : undefined;
  } catch {
    return undefined;
  }
}

/** A token's own text, for what is shown as text: raw HTML, a table. */
const rawText = (token: Token) => ("text" in token ? String(token.text) : token.raw);

/**
 * A link in a reply (product/14 §6.4): its text and, beside it, its address, so the person sees
 * where it goes before they click. A click asks the window to open it in the browser; nothing loads
 * here. An address that isn't on the web is shown as text.
 */
function ReplyLink({
  href,
  children,
  onOpenLink,
}: {
  readonly href: string;
  readonly children: ReactNode;
  readonly onOpenLink: (href: string) => void;
}) {
  const url = webAddress(href);
  if (url === undefined) return <>{children}</>;
  const address = url.href;
  return (
    <a
      href={address}
      title={t("assistant.link.open", { address })}
      className="font-medium underline underline-offset-2 hover:no-underline"
      onClick={(event) => {
        event.preventDefault();
        onOpenLink(address);
      }}
    >
      {children}
      <span className="ml-1 text-xs font-normal break-all text-muted-foreground">({address})</span>
    </a>
  );
}

/** Inline tokens as React: text, emphasis, code, links. An image or raw HTML is text. */
function inline(tokens: readonly Token[] | undefined, open: (href: string) => void): ReactNode {
  return (tokens ?? []).map((token, index) => {
    switch (token.type) {
      case "strong":
        return (
          <strong key={index} className="font-semibold">
            {inline(token.tokens, open)}
          </strong>
        );
      case "em":
        return <em key={index}>{inline(token.tokens, open)}</em>;
      case "del":
        return <del key={index}>{inline(token.tokens, open)}</del>;
      case "codespan":
        return (
          <code key={index} className="rounded-sm bg-muted px-1 font-mono text-[0.9em]">
            {token.text}
          </code>
        );
      case "br":
        return <br key={index} />;
      case "text":
      case "escape":
        return "tokens" in token && token.tokens !== undefined ? (
          <span key={index}>{inline(token.tokens, open)}</span>
        ) : (
          <Fragment key={index}>{token.text}</Fragment>
        );
      case "link":
        return (
          <ReplyLink key={index} href={token.href} onOpenLink={open}>
            {inline(token.tokens, open)}
          </ReplyLink>
        );
      // Never fetched: a remote image is a request and a way out for what the model read (§6.4).
      case "image":
        return (
          <span key={index} className="text-muted-foreground italic">
            [{t("assistant.image", { alt: token.text })}]
          </span>
        );
      default:
        return "tokens" in token && token.tokens !== undefined && token.type !== "html" ? (
          <span key={index}>{inline(token.tokens, open)}</span>
        ) : (
          <span key={index}>{rawText(token)}</span>
        );
    }
  });
}

/** Block tokens as React: paragraphs, lists, code, quotes; a heading is a bold paragraph. */
function blocks(tokens: readonly Token[], open: (href: string) => void): ReactNode {
  return tokens.map((token, index) => {
    switch (token.type) {
      case "space":
      case "hr":
        return null;
      case "paragraph":
      case "heading":
        return (
          <p key={index} className={token.type === "heading" ? "m-0 font-semibold" : "m-0"}>
            {inline(token.tokens, open)}
          </p>
        );
      case "list": {
        const list = token as Tokens.List;
        const List = list.ordered ? "ol" : "ul";
        return (
          <List
            key={index}
            className={list.ordered ? "m-0 list-decimal pl-5" : "m-0 list-disc pl-5"}
          >
            {list.items.map((item, at) => (
              <li key={at}>{blocks(item.tokens, open)}</li>
            ))}
          </List>
        );
      }
      case "code":
        return (
          <pre
            key={index}
            className="m-0 overflow-x-auto rounded-sm bg-muted p-2 font-mono text-xs whitespace-pre-wrap"
          >
            {token.text}
          </pre>
        );
      case "blockquote":
        return (
          <blockquote
            key={index}
            className="m-0 border-l-2 border-border pl-2 text-muted-foreground"
          >
            {blocks(token.tokens ?? [], open)}
          </blockquote>
        );
      case "text":
        return (
          <p key={index} className="m-0">
            {"tokens" in token && token.tokens !== undefined
              ? inline(token.tokens, open)
              : token.text}
          </p>
        );
      default:
        // Raw HTML, a table, anything else: its text as it was written, never as markup.
        return (
          <p key={index} className="m-0 whitespace-pre-wrap">
            {token.raw}
          </p>
        );
    }
  });
}

/**
 * A reply's text (product/14 §6.4, ADR 0026 §7): plain text with limited Markdown, drawn from
 * `marked`'s tokens as React, never as HTML. Emphasis, code, lists and quotes show; raw HTML shows
 * as the text it is; an image is never loaded, only named; a link shows its address and opens in
 * the browser only when clicked. It may be part of a reply still streaming.
 */
export function ReplyText({ text, onOpenLink }: ReplyTextProps) {
  return (
    <div className="flex flex-col gap-2 text-sm [overflow-wrap:anywhere]">
      {blocks(new Lexer().lex(text), onOpenLink)}
    </div>
  );
}
