import { t } from "@webforge/i18n";
import {
  type CollectionId,
  collectionById,
  csvRecords,
  frontMatter,
  ITEM_VALUE_MAX,
  markdownHeading,
  markdownToRichText,
  newId,
  PAGE_TITLE_MAX,
  pageTitle,
  tagNames,
} from "@webforge/model";
import type { PostFile } from "../../shared/ipc/posts.js";
import { insertPost } from "./blog-actions.js";
import { editShowing, type PagesSession } from "./page-actions.js";

/**
 * *Import Posts…* (6.10b, M2): posts drafted elsewhere, from Markdown files or a CSV, added to a
 * Blog in one undo step. A Markdown file is a post: its front matter gives its `title`, `date`,
 * `summary` (or `description`) and `tags`, else its first heading or its file name is its title;
 * the rest is its text. A CSV is a post a row, its header naming the same columns, `body` its
 * Markdown text. A row or file without a title is left out.
 */

/** A post read from a file, to add. */
export type ImportedPost = {
  readonly title: string;
  /** Its date, summary and tags, as the Blog's fields store them; empty ones left out. */
  readonly entry: Readonly<Record<string, string>>;
  /** Its text as rich text; empty for none. */
  readonly body: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The post `fields` give, its text Markdown `markdown`: none without a title. */
function postOf(
  fields: Readonly<Record<string, string>>,
  markdown: string,
): ImportedPost | undefined {
  const title = pageTitle((fields.title ?? "").slice(0, PAGE_TITLE_MAX));
  if (title === "") return undefined;
  const entry: Record<string, string> = {};
  const date = (fields.date ?? "").trim().slice(0, 10);
  if (DATE.test(date)) entry.date = date;
  const summary = (fields.summary ?? fields.description ?? "").trim();
  if (summary !== "") entry.summary = summary.slice(0, ITEM_VALUE_MAX);
  const tags = tagNames(fields.tags ?? "").join(", ");
  if (tags !== "") entry.tags = tags.slice(0, ITEM_VALUE_MAX);
  return { title, entry, body: markdownToRichText(markdown) };
}

/** The post a Markdown file is: see the module's comment. */
function markdownPost(file: PostFile): ImportedPost | undefined {
  const { data, body } = frontMatter(file.text);
  let text = body;
  let title = data.title;
  if (title === undefined) {
    // Its first heading, taken out of its text, else its file's name. Read a line at a time: a
    // pattern over the whole file took minutes on one long line (#974).
    const lines = body.split("\n");
    const at = lines.findIndex((line) => {
      const heading = markdownHeading(line.trimStart());
      return heading?.level === 1 && heading.text !== "";
    });
    const heading = at === -1 ? undefined : markdownHeading(lines[at]?.trimStart() ?? "");
    if (heading !== undefined) {
      title = heading.text;
      text = lines.filter((_, index) => index !== at).join("\n");
    } else {
      title = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
    }
  }
  return postOf({ ...data, title: title ?? "" }, text);
}

/** The posts in `files`: a CSV's rows, each other file a post, in the order chosen. */
export function postsFromFiles(files: readonly PostFile[]): ImportedPost[] {
  return files.flatMap((file) => {
    if (/\.csv$/i.test(file.name)) {
      return csvRecords(file.text).flatMap((record) => postOf(record, record.body ?? "") ?? []);
    }
    return markdownPost(file) ?? [];
  });
}

/**
 * Adds `posts` to the Blog `collectionId` as one undo step ("Imported 12 posts"), and shows the
 * first. A post without a date is dated today. Returns how many it added.
 */
export function importPosts(
  session: PagesSession,
  collectionId: CollectionId,
  posts: readonly ImportedPost[],
): number {
  if (posts.length === 0) return 0;
  if (collectionById(session.history.document.getState(), collectionId) === undefined) return 0;
  const ids = posts.map(() => newId("page"));
  const [first] = ids;
  if (first === undefined) return 0;
  const label =
    posts.length === 1
      ? t("blog.history.imported.one")
      : t("blog.history.imported.other", { count: posts.length });
  editShowing(session, "insert", label, first, (draft) => {
    posts.forEach((post, index) => {
      const id = ids[index];
      if (id === undefined) return;
      insertPost(
        draft,
        collectionId,
        id,
        post.title,
        post.entry,
        undefined,
        post.body === "" ? undefined : post.body,
      );
    });
  });
  return posts.length;
}
