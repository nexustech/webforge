import { t } from "@webforge/i18n";
import { listPath, type SiteCollectionItem } from "@webforge/model";
import { contentWidthClass, defineSection } from "../frame.js";
import { type ComponentDef, dateText, stringValue } from "../library.js";
import type { RenderContext } from "../schema.js";
import { SectionTitle } from "../typography.js";

/** How many posts a Latest posts section shows. */
const COUNTS = ["3", "6", "9", "12"] as const;

/** How many posts each of the Blog's own pages lists (6.10b): `blog/index`, `blog/page/2`… */
export const POSTS_PER_PAGE = 10;

/** How the posts are laid out: cards in a grid, or a list of titles with their dates. */
const LAYOUTS = ["cards", "list"] as const;

/**
 * Which posts a section shows, from props the export's own pages set (6.10b) beside the fields:
 * page `page` of all of them, or those with the tag whose page is `tag`. A section the person
 * places has neither: the newest `count`.
 */
type Listing = { readonly page?: number; readonly tag?: string };

function listingOf(values: Readonly<Record<string, unknown>>): Listing {
  const page = values.page;
  const tag = stringValue(values.tag);
  return {
    ...(typeof page === "number" && Number.isInteger(page) && page >= 1 ? { page } : {}),
    ...(tag === "" ? {} : { tag }),
  };
}

/** A post's picture, date, title and summary, as the section's options show them. */
function PostCard({
  item,
  context,
  showPicture,
  showDate,
  showSummary,
  layout,
  level,
}: {
  readonly item: SiteCollectionItem;
  readonly context: RenderContext;
  readonly showPicture: boolean;
  readonly showDate: boolean;
  readonly showSummary: boolean;
  readonly layout: (typeof LAYOUTS)[number];
  /** Its title's heading level: under the page's own title on the Blog's pages, else a section's. */
  readonly level: "h2" | "h3";
}) {
  const Title = level;
  const { title, date, summary, picture } = item.values;
  const href = context.link(item.path);
  const image =
    showPicture && layout === "cards" && picture?.kind === "image"
      ? context.image(picture.mediaId)
      : null;
  return (
    <li className={layout === "cards" ? "site-post-card flex flex-col gap-2" : "site-post-row"}>
      {/* The title links to the post: the picture is beside it, not a second link. */}
      {image === null ? null : (
        <img
          src={image.src}
          srcSet={image.fallback.srcset}
          width={image.width}
          height={image.height}
          alt=""
          loading="lazy"
          decoding="async"
          className="aspect-[3/2] w-full rounded-box object-cover"
        />
      )}
      {showDate && date?.kind === "date" ? (
        <time dateTime={date.date} className="text-small opacity-75">
          {dateText(date.date, context.language)}
        </time>
      ) : null}
      <Title className="font-heading text-h4">
        <a href={href} className="link link-hover">
          {title?.kind === "text" ? title.text : ""}
        </a>
      </Title>
      {showSummary && summary?.kind === "text" ? <p>{summary.text}</p> : null}
    </li>
  );
}

/**
 * Latest posts (6.10b, ADR 0025, decision 8): the Blog's newest posts, as cards with their picture,
 * date and summary or as a list, with a link to all of them. Drawn from the posts the build has, so
 * the export is flat HTML with no script (X1); the canvas shows the site's posts as they are. The
 * Blog's own pages (its list, page by page, and each tag's) are this section too, set by the export.
 */
const latestPosts = defineSection({
  label: t("section.latestPosts"),
  name: "latest-posts",
  category: t("category.blog"),
  variants: LAYOUTS.map((value) => ({ label: t(`field.latestPostsLayout.${value}`), value })),
  fields: {
    title: { kind: "text", label: t("field.title"), inline: true },
    count: {
      kind: "select",
      label: t("field.latestPostsCount"),
      options: COUNTS.map((value) => ({ label: value, value })),
    },
    showPicture: { kind: "toggle", label: t("field.latestPostsPicture") },
    showDate: { kind: "toggle", label: t("field.latestPostsDate") },
    showSummary: { kind: "toggle", label: t("field.latestPostsSummary") },
    allPosts: { kind: "toggle", label: t("field.latestPostsAll") },
  },
  defaults: {
    title: t("starter.latestPostsTitle"),
    count: "3",
    showPicture: true,
    showDate: true,
    showSummary: true,
    allPosts: true,
    contentWidth: "wide",
  },
  frame: () => "bg-base-100",
  render: ({ values, context }) => {
    // Props the export's own pages set beside the fields (6.10b): which collection, page and tag.
    const stored: Readonly<Record<string, unknown>> = values;
    const collection = context.posts?.(stringValue(stored.collection) || undefined);
    // On the Blog's own pages, the page's one main heading (6.10b); elsewhere a section's title.
    const ownPage = stored.page !== undefined || stored.tag !== undefined;
    const heading =
      values.title === "" ? null : (
        <SectionTitle size={ownPage ? "page" : "section"}>{values.title}</SectionTitle>
      );
    if (collection === undefined) {
      // No Blog yet: its title, and a hint on the canvas saying where to add one.
      return (
        <div className={`mx-auto ${contentWidthClass(values.contentWidth)} space-y-8`}>
          {heading}
          {context.elementHint === undefined ? null : (
            <p className="text-center">{context.elementHint("blog")}</p>
          )}
        </div>
      );
    }
    const listing = listingOf(stored);
    const tagged =
      listing.tag === undefined
        ? collection.items
        : collection.items.filter((item) => {
            const tags = item.values.tags;
            return tags?.kind === "tags" && tags.tags.some((tag) => tag.path === listing.tag);
          });
    const page = listing.page;
    const shown =
      page === undefined
        ? listing.tag === undefined
          ? tagged.slice(0, Number(values.count))
          : tagged
        : tagged.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);
    const layout = values.variant === "list" ? "list" : "cards";
    const pages = Math.max(1, Math.ceil(tagged.length / POSTS_PER_PAGE));
    const pageLink = (n: number) => context.link(listPath(collection.folder, n));
    return (
      <div className={`mx-auto ${contentWidthClass(values.contentWidth)} space-y-8`}>
        {heading}
        {shown.length === 0 ? (
          <p className="text-center">{t("siteText.noPosts")}</p>
        ) : (
          <ul
            className={
              layout === "cards"
                ? "grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
                : "flex flex-col gap-4"
            }
          >
            {shown.map((item) => (
              <PostCard
                key={item.pageId}
                item={item}
                context={context}
                showPicture={values.showPicture}
                showDate={values.showDate}
                showSummary={values.showSummary}
                layout={layout}
                level={ownPage ? "h2" : "h3"}
              />
            ))}
          </ul>
        )}
        {page !== undefined && pages > 1 ? (
          <nav aria-label={t("siteText.postPages")} className="flex justify-between gap-4">
            {page > 1 ? (
              <a href={pageLink(page - 1)} className="link" rel="prev">
                {t("siteText.newerPosts")}
              </a>
            ) : (
              <span />
            )}
            {page < pages ? (
              <a href={pageLink(page + 1)} className="link" rel="next">
                {t("siteText.olderPosts")}
              </a>
            ) : null}
          </nav>
        ) : null}
        {page === undefined && listing.tag === undefined && values.allPosts ? (
          <p className="text-center">
            <a href={pageLink(1)} className="link">
              {t("siteText.allPosts")}
            </a>
          </p>
        ) : null}
      </div>
    );
  },
});

/** The Latest posts family. */
export const latestPostsComponents: Readonly<Record<string, ComponentDef>> = {
  LatestPosts: latestPosts,
};
