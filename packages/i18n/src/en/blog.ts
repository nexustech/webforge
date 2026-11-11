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
  "blog.field.tags": "Tags",
  // What a new Blog starts with: its design, and a first post to show it.
  "blog.design.title": "Post title",
  "blog.design.date": "Date",
  "blog.design.home": "Back to Home",
  "blog.firstPost.title": "Our first post",
  "blog.firstPost.summary": "What's new, in a sentence or two.",
  "blog.firstPost.text": "<p>Write your post here. Its title, date and picture are above.</p>",
  // The banner over the canvas while an element of the design is selected.
  "blog.banner.one": "Editing the design of {name}: changes show on its 1 post",
  "blog.banner.many": "Editing the design of {name}: changes show on all {count} posts",
  // Asked before an element leaves the design, and so every post (D7).
  "blog.designDelete.title": "Delete {item} from the design of {name}?",
  "blog.designCut.title": "Cut {item} from the design of {name}?",
  "blog.designChange": "Every post shows the change.",
  // What an element of the design shows while the post's field is empty, on the canvas only.
  "blog.empty": "The post's {field}: add it in Page Settings",
  // The Edit panel's "shows" choice, in the design.
  "blog.binding.field": "The post's {field}",
  "blog.binding.title": "Title",
  "blog.binding.ownPicture": "Its own picture",
  // Page Settings for a post.
  "blog.settings.noPicture": "No picture",
  "blog.settings.dateHint": "Posts are listed newest first.",
  "blog.settings.summaryHint": "A sentence or two, shown where the design shows the summary.",
  "blog.settings.tagsHint":
    "Separated by commas: Opening times, News. Each tag gets a page listing its posts.",
  // Import Posts… (6.10b).
  "blog.import": "Import Posts…",
  "blog.import.chooseTitle": "Import posts",
  "blog.import.fileType": "Markdown or CSV",
  "blog.import.done.one": "Imported 1 post",
  "blog.import.done.other": "Imported {count} posts",
  "blog.import.none": "No posts found in the files: see Help for what they need",
  "blog.import.tooLarge": "{name} is too large to import: split it into smaller files",
  "blog.import.tooMany": "Choose at most 200 files at once",
  // Undo steps.
  "blog.history.imported.one": "Imported 1 post",
  "blog.history.imported.other": "Imported {count} posts",
  "blog.item": "post '{name}'",
  "blog.history.addedBlog": "Added a blog",
  "blog.history.editedDesign": "Edited the design of {name}",
  "blog.history.inDesign": " in the design of {name}",
  "blog.history.changedPost": "Changed post settings",
  "blog.history.binding": "{item} shows the post's {field}",
  // Renaming a blog, its folder with it, and deleting it while it has no posts (#937).
  "blog.rename": "Rename…",
  "blog.delete": "Delete",
  "blog.renameDialog.title": "Rename Blog",
  "blog.renameDialog.label": "Name",
  "blog.renameDialog.confirm": "Rename",
  "blog.renameDialog.moveFolder": "Move its posts to a folder of the new name",
  "blog.renameDialog.moveHint": "Each post's address changes from {from}/… to {folder}/….",
  "blog.renameDialog.moveHintKept":
    "Each post's address changes from {from}/… to {folder}/…. Links and search results that use a post's old address go on to the new one, but not those to the blog's list of posts, its tag pages or its feed.",
  "blog.deleteDialog.title": "Delete blog '{name}'?",
  "blog.deleteDialog.description": "It has no posts. Its design goes with it.",
  "blog.deleteDialog.cancel": "Cancel",
  "blog.deleteDialog.confirm": "Delete Blog",
  "blog.blogItem": "blog '{name}'",
  "blog.history.renamed": "Renamed blog '{name}'",
} as const;
