import { t } from "@webforge/i18n";
import { defineComponent } from "../define.js";
import { MARGIN_FIELD, marginClasses } from "../frame.js";
import type { ComponentDef } from "../library.js";

/**
 * Post tags (6.10b): the tags of the post the page is, each a link to the page listing its posts
 * (`blog/tag/news.html`), which the export writes. For a Blog's design: on a page that isn't a post
 * it draws nothing, and on a post without tags the canvas's hint says where to add them.
 */
const postTags = defineComponent({
  label: t("element.postTags"),
  category: t("category.blog"),
  fields: {
    margin: MARGIN_FIELD,
  },
  defaults: {},
  render: ({ values, context }) => {
    if (context.item === undefined) return null;
    const value = context.item("tags");
    if (value?.kind !== "tags") {
      const hint = context.emptyItem?.("tags");
      return hint === undefined ? null : (
        <p className={marginClasses(values.margin).trim()}>{hint}</p>
      );
    }
    return (
      <ul
        aria-label={t("siteText.postTags")}
        className={`site-post-tags flex flex-wrap gap-2${marginClasses(values.margin)}`}
      >
        {value.tags.map((tag) => (
          <li key={tag.path}>
            <a href={context.link(tag.path)} className="badge badge-outline">
              {tag.name}
            </a>
          </li>
        ))}
      </ul>
    );
  },
});

/** The Post tags family. */
export const postTagsComponents: Readonly<Record<string, ComponentDef>> = {
  PostTags: postTags,
};
