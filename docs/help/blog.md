---

id: blog
title: Your blog
summary: Add a blog, write posts on the page, tag them, list them anywhere, import them, and change the design every post shares.
components: [LatestPosts, PostTags]
related: [pages, header-and-footer, edit-panel, export, site-settings]
updated: 2026-11-11
---

# Your blog

A **blog** holds your news, offers and stories. Each **post** is a page of your site that you write on the page, like any other. The blog's **design** is drawn above and below every post: its title, date and picture at the top, and its tags and a button back to your Home page at the bottom.

## Adding a blog

In the **Site** panel, click **+** (**Add Page**) and choose **Blog**. {appName} adds the blog, with a first post to show you how a post looks, and opens it.

The **Pages** list shows your blog as a group of its own, under its name, with your posts newest first. A site has one blog.

## Writing a post

Click **+** beside the blog's name (**New Post**) to add a post dated today. Its **…** menu has **New Post** too, and **Import Posts…** (see [Importing posts](#importing-posts)). Then write it on the page, as on any page: type in its text, and add sections and elements from the **Add** panel.

Each post's address is in the blog's folder, such as `blog/spring-opening.html`. Renaming a post changes its address, as for any page.

Drafted your post elsewhere in Markdown? Paste it into the post's text: headings, **bold**, _italic_, links and lists keep their shape. A heading becomes a bold line, as text on your pages has no headings of its own.

### A post's date, summary, picture and tags

Open the post's **…** menu and choose **Page Settings…**. Under its **Title**:

- **Date:** the day of the post. Posts are listed newest first.
- **Summary:** a sentence or two about the post.
- **Picture:** a picture from **Media**, which the design shows at the top of the post. It's also the picture shown when someone shares the post, unless you choose another **Share image**.
- **Tags:** words that group your posts, separated by commas: _Opening times, News_. Each tag gets a page listing its posts, and **Post tags** in the design links to them.

Click **Save** to keep them, as one step you can undo.

## The blog's design

The sections above and below each post are the blog's design, shared by every post. Click one of its elements on any post to change it: a banner over the page says _Editing the design of 'Blog': changes show on all 3 posts_. Each change is one step you can undo, such as _Edited the design of 'Blog'_.

The design's elements show each post's own **Title**, **Date** and **Picture**. In the **Edit** panel, **Text shows** (or **Image shows**) chooses what an element shows: its own text, or one of the post's fields, such as _The post's Summary_. An empty field shows a faint hint on the page, saying where to fill it in, and nothing on your website.

You can't add, move or delete the design's sections themselves. A post that hides the Header or Footer (Page Settings) still shows the design.

## Latest posts on any page

Add **Latest posts** from the **Add** panel (under _Blog_) to show your newest posts on any page, such as your Home page. In the **Edit** panel:

- **Layout:** _Cards_, with each post's picture, or a _List_ of titles and dates.
- **Number of posts:** 3, 6, 9 or 12.
- **Show pictures**, **Show dates** and **Show summaries**.
- **Link to all posts:** a link to your blog's own page, which lists every post.

On the page you're editing, Latest posts shows your posts as they are, drafts too. Your website shows only published ones.

## Post tags

**Post tags** (under _Blog_ in the **Add** panel) shows a post's tags, each a link to the page listing the posts with that tag. It belongs in the blog's design, where it shows each post's own tags; a new blog's design has it below the post. On a page that isn't a post it shows nothing.

## Importing posts

To bring in posts you wrote elsewhere, open the **…** menu beside the blog's name and choose **Import Posts…**, then choose one or more files:

- **Markdown files** (`.md`): each file is a post. Its title is the `title:` in the front matter at its top, else its first heading, else its file's name. The front matter can also give its `date:` (such as `2026-03-01`), `summary:` (or `description:`) and `tags:`.
- **A CSV file** (`.csv`), as a spreadsheet saves it: each row is a post, under a first row naming the columns `title`, `date`, `summary`, `tags` and `body`, the post's text in Markdown.

A post without a title is left out, and one without a date is dated today. All the posts come in as one step you can undo, such as _Imported 12 posts_. You can choose up to 200 files at once, each up to 1 MB.

## What a post can't do

A post is always in the blog's folder, so **Move to Folder** isn't offered for it, and posts are listed by date, so they aren't moved up or down. A post can't be the Home page. The menu doesn't list posts by itself; to put one in it, add it to the menu yourself (see [The menu](pages.md#the-menu)). **Duplicate** makes another post of the same blog.

Like any page, a post can be a **Draft**, kept off your website until you publish it. See [Draft pages](pages.md#draft-pages).

## On your website

Export and Publish write each post as its own page, in the blog's folder, with the design around it. The date is written out in your site's language, such as _10 November 2026_.

They also write your blog's own pages, with your Header and Footer:

- **`blog/index.html`** lists your posts, ten a page, newest first, with **Older posts** and **Newer posts** links to `blog/page/2.html` and on. **All posts** in Latest posts goes here.
- **`blog/tag/opening-times.html`** lists the posts with that tag, one page for each tag.
- **`blog/feed.xml`** is your blog's feed (RSS), for readers who follow blogs in an app. Every page links to it. A feed needs your site's web address ([Site Settings › Web address](site-settings.md#web-address)), as its links are whole addresses; until you add it, there's no feed and Site Check says so.

Site Check also tips you when a post has no summary or no picture, which Latest posts and shares show.
