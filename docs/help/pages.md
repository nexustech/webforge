---

id: pages
title: Pages and the menu
summary: Add, rename, reorder and delete pages, set what the menu shows, and change each page's settings.
related: [header-and-footer, links, site-settings, site-check, blog]
updated: 2026-11-10
---

# Pages and the menu

The **Site** panel, in the right column, lists your pages at the top and your site's menu below.

## Pages

Pages are listed in order. Click one to show it. Icons mark:

- the **Home page**, the first page visitors see;
- the **Page not found** page, shown when someone follows a broken link;
- pages **hidden from navigation**;
- **Draft** pages, which aren't on your website yet. See [Draft pages](#draft-pages).

To jump to a page from anywhere, press Ctrl+P (Cmd+P on a Mac) and type its name.

### Adding a page

Click **+** (**Add Page**):

- **Blank Page…** asks for the page's name, and shows the file name it will have.
- **Privacy Page** adds a page that tells visitors what your site collects and what you do with it. See [A privacy page](#a-privacy-page).
- **Terms Page** adds your terms for using the site and for booking or buying from you. See [Terms and cookie pages](#terms-and-cookie-pages).
- **Blog** adds a blog, with a first post. Its posts are listed in a group of their own, with **New Post**. See [Your blog](blog.md).
- **Cookie Policy Page** adds a page about the cookies your site uses. It's offered while Google Analytics is on (Site Settings › Analytics). See [Terms and cookie pages](#terms-and-cookie-pages).
- **Suggested Pages** offers ready-made pages for each kind of business, such as _Reviews_, _Gift vouchers_ or _Areas we cover_.

### The page's … menu

Point at a page and click **…** for:

- **Page Settings…:** see [below](#page-settings).
- **Rename…:** the file name follows the new name, unless you've set the file name yourself. When it changes, **Keep the old address working** sends anyone who uses the old address on to the page. See [Keeping old addresses working](#keeping-old-addresses-working).
- **Duplicate:** a copy, just after this page.
- **Move Up · Move Down:** reorder the pages.
- **Move to Folder:** group pages under a folder, such as _services_. The page's address then becomes `services/plumbing.html`.
- **Set as Home Page**.
- **Hide from Navigation:** takes the page off the menu, but keeps it on your site for links.
- **Draft:** keeps the page in your site but off your website. See [Draft pages](#draft-pages).
- **Delete…:** asks first, and says how many pages change, such as pages with links to it. You can undo it.

The Home page and the Page not found page can't be deleted.

### Draft pages

A **draft** is a page you're still working on, or one for later, such as a seasonal menu. It stays in your site, and you edit it like any other page, but it isn't on your website:

- **Export and Publish leave it out,** with its menu item and the pictures and documents only it uses. Search engines and AI tools never see it.
- **Preview shows it,** so you can check it in your browser before it goes live. Open it from the page itself; your menu in Preview leaves it out, as your website's will.
- **Links to it are left out too.** Site Check lists every link to a draft page, under _Links to draft pages_. Its **Fix** opens the draft's Page Settings. Publishing waits until you fix them, so visitors never meet a button that goes nowhere.
- **Site Check doesn't check a draft's own content** until it's published.

To make a page a draft, turn on **Draft** in its **…** menu, or in Page Settings. Turn it off to publish the page with the rest of your site. The Home page and the Page not found page are always published.

## The menu

The **Menu**, under Pages, is what the Header shows. At first it lists your pages in order and follows them as you add, move or remove pages.

Click **+** (**Add to Menu**) to add:

- a **Link…**: to a page, a section, another website, an email address or a phone number;
- a **Button…**: a link that stands out as a button;
- a **Dropdown…**: a heading that opens a list of links.

Each item's menu can rename it, change its link, hide it, move it up or down, or move it into or out of a dropdown.

Once you change the menu yourself, it stops following the pages. **Follow Page Order** makes it follow them again.

A [one-page site](one-page-sites.md) starts with a menu of links to the sections of its home page.

### A privacy page

If your site has a form, a newsletter signup or Google Analytics, it collects details from your visitors, and it should say what you do with them. **Add Page › Privacy Page** writes a page for you to start from:

- who runs the site, using the business name from Site Settings › Contact & hours (or your site's name);
- what the site collects: messages from a form, newsletter sign-ups, and visit counts from Google Analytics, only those your site has;
- why, how long you keep it, and what visitors can ask you to do with their details;
- how to ask, using your email address from Site Settings.

Its first paragraph reminds you that it's a starting point, not legal advice. Read the page, change anything that doesn't match how your business works, then delete that paragraph: [Site Check](site-check.md) lists it as placeholder text until you do, and won't publish the site with it.

The page goes in your menu like any other. To keep it off the menu, turn on **Hide from navigation** in its Page Settings, and link to it from the Footer instead.

If you wrote your own privacy page, open its Page Settings and turn on **This is the site's privacy page**, so Site Check knows it's there.

### Terms and cookie pages

**Add Page › Terms Page** writes your terms for you to start from, using Site Settings › Contact & hours:

- who runs the site (your business name, or your site's name) and your address;
- that the site is for general information and its words and photos are yours;
- that prices are a guide, and you confirm them before someone books or buys;
- links to other websites, and changes to the terms;
- how to ask a question: your email address, or your phone number.

**Add Page › Cookie Policy Page** is there while Google Analytics is on. It explains cookies, then says what your site does:

- with the consent banner, Google Analytics sets its cookies only if a visitor agrees, and **Cookie settings** at the bottom of each page lets them change their mind;
- without the banner, visits are counted without cookies;
- if your site has a video or a map, YouTube, Vimeo or the map's website may set their own cookies once it loads.

Each page is written from your settings at the moment you add it. If you change them later, for example by turning the consent banner off, update the page too.

Like the privacy page, each starts with a reminder that it's a starting point, not legal advice. Check every part, change what doesn't fit your business, then delete that paragraph: Site Check lists it as placeholder text until you do. To keep the pages off the menu, turn on **Hide from navigation** in their Page Settings, and link to them from the Footer.

### Keeping old addresses working

Once your site is published, people and search engines know your pages by their addresses. If a page's address changes, links to the old address would stop working, and the page could lose its place in search results.

So when you rename a page and its file name changes, **Keep the old address working** is ticked once you've published the site. Untick it if nobody uses the old address yet. Moving a page to a folder, making it the Home page or changing its file name in Page Settings keeps the old address too, once the site has been published.

At each old address, your site gets a small page that sends visitors and search engines straight on to the page's new address. On Netlify, the old address redirects for good. Renaming and keeping the old address is one step, so **Undo** takes back both.

A page with two old addresses sends both straight to where it is now. If you later give a page an address that was kept, the page takes it. If you delete a page, its old addresses go with it. You'll find them all in **Site Settings › Search engines**, where you can remove them.

## Page Settings

Open a page's **…** menu and choose **Page Settings…**. These settings decide how the page shows in search results, browser tabs and when someone shares it.

- **Title:** shown in the browser tab and as the link in search results. Give each page its own.
- **Date**, **Summary** and **Picture**, for a blog's post only. See [Your blog](blog.md#a-posts-date-summary-and-picture).
- **File name:** the end of the page's web address, such as `about.html`. The Home page is always `index.html`, and the Page not found page `404.html`.
- **Description:** a sentence or two shown under the title in search results. Leave it empty to use the site's description.
- **Share image:** the picture shown when someone shares the page. _The site's image_ uses the one from Site Settings.
- **Draft: don't publish this page yet:** keeps the page in your site but off your website. See [Draft pages](#draft-pages).
- **Hide the Header on this page** and **Hide the Footer on this page**.
- **Hide from navigation:** takes the page off the menu.
- **Hide this page from search engines:** search engines won't list the page. It stays on your site, and anyone with its address can still open it. This is different from hiding it from navigation, which is about your menu.
- **Hide the back-to-top button on this page:** shown when the site has that button (Site Settings › General).
- **This is the site's privacy page:** tells Site Check this page says what your site collects. **Add Page › Privacy Page** turns it on for the page it adds. See [A privacy page](#a-privacy-page).

While you type, **In search results** shows roughly how the page could look on Google on a phone. **When shared** shows the card people see when the page is shared. Click **Save** to keep your changes, as one step you can undo.
