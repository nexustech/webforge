import { t } from "@webforge/i18n";
import type { PublishDestination } from "@webforge/model";
import { useHelpAt } from "../help/index.js";

/** A card: what it is and what it needs, the whole of it one button. */
function Card({
  title,
  description,
  onChoose,
}: {
  readonly title: string;
  readonly description: string;
  readonly onChoose: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className="flex w-full flex-col gap-0.5 rounded-md border border-border bg-panel p-3 text-left hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring"
        onClick={onChoose}
      >
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </button>
    </li>
  );
}

/**
 * A site's first publish destination (#1014, product owner): "Where is your website hosted?", with
 * a card for each answer in place of an empty list. A web host with a control panel opens its form
 * (the connection inside it, FTPS to start); Netlify, where it's offered, its own; and "I don't have
 * a host yet" Help on choosing one, where Help can open.
 */
export function FirstDestination({
  netlify,
  onAdd,
}: {
  /** Whether Netlify is offered. */
  readonly netlify: boolean;
  readonly onAdd: (kind: PublishDestination["kind"]) => void;
}) {
  const choosingHost = useHelpAt("publish.choosingHost");
  return (
    <section aria-labelledby="publish-first-question" className="grid gap-2">
      <h3 id="publish-first-question" className="m-0 text-sm font-medium">
        {t("publish.first.question")}
      </h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        <Card
          title={t("publish.first.fileTransfer")}
          description={t("publish.first.fileTransfer.description")}
          onChoose={() => onAdd("file-transfer")}
        />
        {netlify ? (
          <Card
            title={t("publish.first.netlify")}
            description={t("publish.first.netlify.description")}
            onChoose={() => onAdd("netlify")}
          />
        ) : null}
        {choosingHost === undefined ? null : (
          <Card
            title={t("publish.first.none")}
            description={t("publish.first.none.description")}
            onChoose={choosingHost}
          />
        )}
      </ul>
    </section>
  );
}
