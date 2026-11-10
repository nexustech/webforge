/**
 * The Blog (`apps/desktop/src/renderer/blog/`, 6.10a, ADR 0025): a post is a page written on the
 * canvas inside the Blog's design. The UI says Blog and post, never "collection" (M2-1).
 */
export const blog = {
  // Add Page › Blog, and the Blog's group in the Pages panel.
  "blog.add": "Blog",
  "blog.name": "Blog",
  "blog.newPost": "New Post",
  "blog.newPostTitle": "New post",
  "blog.noPosts": "No posts yet",
  // The Blog's fields, beside each post's title.
  "blog.field.date": "Date",
  "blog.field.summary": "Summary",
  "blog.field.picture": "Picture",
  // What a new Blog starts with: its design, and a first post to show it.
  "blog.design.title": "Post title",
  "blog.design.date": "Date",
  "blog.design.summary": "Summary",
  "blog.design.home": "Back to Home",
  "blog.firstPost.title": "Our first post",
  "blog.firstPost.summary": "What's new, in a sentence or two.",
  "blog.firstPost.text": "<p>Write your post here. Its title, date and picture are above.</p>",
  // The banner over the canvas while an element of the design is selected.
  "blog.banner.one": "Editing the design of {name}: changes show on its 1 post",
  "blog.banner.many": "Editing the design of {name}: changes show on all {count} posts",
  // What an element of the design shows while the post's field is empty, on the canvas only.
  "blog.empty": "The post's {field}: add it in Page Settings",
  // The Edit panel's "shows" choice, in the design.
  "blog.binding.field": "The post's {field}",
  "blog.binding.title": "Title",
  "blog.binding.ownPicture": "Its own picture",
  "blog.binding.shows": "{field} shows",
  // Page Settings for a post.
  "blog.settings.post": "Post",
  "blog.settings.date": "{field}",
  "blog.settings.picture": "{field}",
  "blog.settings.noPicture": "No picture",
  "blog.settings.dateHint": "Posts are listed newest first.",
  "blog.settings.summaryHint": "A sentence or two, shown where the design shows the summary.",
  "blog.settings.folder": "Posts are in the folder {folder}.",
  // Undo steps.
  "blog.item": "post '{name}'",
  "blog.history.addedBlog": "Added a blog",
  "blog.history.editedDesign": "Edited the design of {name}",
  "blog.history.changedPost": "Changed post settings",
  "blog.history.binding": "{item} shows the post's {field}",
} as const;
