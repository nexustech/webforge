import { type CollectionId, siteDocSchema } from "@webforge/model";
import { describe, expect, it, vi } from "vitest";
import { sessionWith } from "../testing/fixtures.js";
import { addBlog } from "./blog-actions.js";
import { importPosts, postsFromFiles } from "./import-posts.js";
import { importChosenPosts } from "./SitePanel.js";

const md = (name: string, text: string) => ({ name, text });

describe("postsFromFiles (6.10b)", () => {
  it("reads a Markdown file's front matter, its first heading or its name, and its text", () => {
    const posts = postsFromFiles([
      md(
        "spring.md",
        '---\ntitle: "Spring opening"\ndate: 2026-03-01\ndescription: Doors open at nine\ntags: [News, Events]\n---\nWe **open** on Saturday.',
      ),
      md("notes.md", "# New ovens\n\nThey bake *faster*."),
      md("winter-menu_2026.markdown", "Soups and stews."),
    ]);

    expect(posts).toEqual([
      {
        title: "Spring opening",
        entry: { date: "2026-03-01", summary: "Doors open at nine", tags: "News, Events" },
        body: "<p>We <strong>open</strong> on Saturday.</p>",
      },
      { title: "New ovens", entry: {}, body: "<p>They bake <em>faster</em>.</p>" },
      { title: "winter menu 2026", entry: {}, body: "<p>Soups and stews.</p>" },
    ]);
  });

  it("takes the first heading as the title, quickly however long its line (#974)", () => {
    // The pattern that found it took over a minute on a line of a few thousand spaces.
    const spaces = " ".repeat(200_000);
    const start = performance.now();
    const posts = postsFromFiles([
      md("long.md", `Intro\n  # New ovens ##  \nThey bake.`),
      md("spaces.md", `# a${spaces}b\n\nText`),
    ]);

    expect(performance.now() - start).toBeLessThan(1000);
    expect(posts[0]).toEqual({
      title: "New ovens",
      entry: {},
      body: "<p>Intro They bake.</p>",
    });
    // A heading still, cut to a page title's 200 characters, which leaves its first word.
    expect(posts[1]?.title).toBe("a");
  });

  it("reads a CSV a post a row, leaving out rows without a title and dates that aren't", () => {
    const posts = postsFromFiles([
      md(
        "posts.csv",
        'Title,Date,Summary,Tags,Body\n"Spring, at last",2026-03-01,Open,News,"Hello **you**"\n,2026-01-01,No title,,\nSummer,soon,,,',
      ),
    ]);

    expect(posts).toEqual([
      {
        title: "Spring, at last",
        entry: { date: "2026-03-01", summary: "Open", tags: "News" },
        body: "<p>Hello <strong>you</strong></p>",
      },
      { title: "Summer", entry: {}, body: "" },
    ]);
  });
});

describe("importPosts (6.10b)", () => {
  it("adds the posts to the Blog as one undo step, and shows the first", () => {
    const session = sessionWith();
    addBlog(session);
    const site = () => session.history.document.getState();
    const [blog] = Object.values(site().collections);
    if (blog === undefined) throw new Error("no blog");

    const count = importPosts(session, blog.id, [
      { title: "Spring", entry: { date: "2026-03-01" }, body: "<p>Hello</p>" },
      { title: "Summer", entry: {}, body: "" },
    ]);

    expect(count).toBe(2);
    const labels = session.history.entries().map((entry) => entry.label);
    expect(labels.at(-1)).toBe("Imported 2 posts");
    const spring = Object.values(site().pages).find((page) => page.title === "Spring");
    expect(spring).toMatchObject({ folder: "blog", slug: "spring", entry: { date: "2026-03-01" } });
    expect(JSON.stringify(spring?.doc)).toContain("<p>Hello</p>");
    expect(session.ui.getState().pageId).toBe(spring?.id);
    expect(siteDocSchema.safeParse(site()).success).toBe(true);
    session.history.undo();
    expect(Object.values(site().pages).some((page) => page.title === "Spring")).toBe(false);
    expect(
      importPosts(session, "none" as CollectionId, [{ title: "X", entry: {}, body: "" }]),
    ).toBe(0);
  });

  it("says how many it imported, or why none", async () => {
    const session = sessionWith();
    addBlog(session);
    const [blog] = Object.values(session.history.document.getState().collections);
    if (blog === undefined) throw new Error("no blog");
    const notify = vi.fn();
    const run = (
      chosen: Awaited<ReturnType<Parameters<typeof importChosenPosts>[2]["chooseFiles"]>>,
    ) => importChosenPosts(session, blog.id, { chooseFiles: async () => chosen, notify });

    await run({ status: "chosen", files: [md("a.md", "# A"), md("b.md", "# B")] });
    expect(notify).toHaveBeenLastCalledWith("Imported 2 posts", false);
    await run({ status: "chosen", files: [md("empty.csv", "title\n")] });
    expect(notify).toHaveBeenLastCalledWith(
      "No posts found in the files: see Help for what they need",
      true,
    );
    await run({ status: "tooLarge", name: "big.csv" });
    expect(notify).toHaveBeenLastCalledWith(
      "big.csv is too large to import: split it into smaller files",
      true,
    );
    notify.mockClear();
    await run({ status: "cancelled" });
    expect(notify).not.toHaveBeenCalled();
  });
});
