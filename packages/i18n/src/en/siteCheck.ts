/** Site Check (F-CHK-1, 3.6): its panel, its rules' verdicts, its fixes. Friendly, not alarming. */
export const siteCheck = {
  "siteCheck.title": "Site Check",
  "siteCheck.level.must": "Must fix",
  "siteCheck.level.should": "Should fix",
  "siteCheck.level.tip": "Tips",
  "siteCheck.allClear": "Nothing to fix. Your site is ready to export.",
  "siteCheck.count.must.one": "1 must fix",
  "siteCheck.count.must.other": "{count} must fix",
  "siteCheck.count.should.one": "1 should fix",
  "siteCheck.count.should.other": "{count} should fix",
  "siteCheck.count.tip.one": "1 tip",
  "siteCheck.count.tip.other": "{count} tips",
  "siteCheck.fix": "Fix",
  "siteCheck.ignore": "Ignore",
  "siteCheck.ignore.label": "Ignore: {item}",
  "siteCheck.show.label": "Show {item}",
  "siteCheck.restore.one": "Show 1 ignored item again",
  "siteCheck.restore.other": "Show {count} ignored items again",
  "siteCheck.status.pass": "Passed",
  "siteCheck.status.warn": "Worth a look",
  "siteCheck.status.fail": "Must be fixed",

  // Each rule: its name, the verdict when it passes, and when it doesn't.
  "siteCheck.rule.deviceNames": "Page names",
  "siteCheck.rule.deviceNames.pass": "Every page has a name Windows can save",
  "siteCheck.rule.deviceNames.fail.one": "1 page has a name Windows keeps for itself",
  "siteCheck.rule.deviceNames.fail.other": "{count} pages have a name Windows keeps for itself",
  "siteCheck.rule.homePage": "Home page",
  "siteCheck.rule.homePage.pass": "The site has a home page",
  "siteCheck.rule.homePage.fail.one": "The site has no home page",
  "siteCheck.rule.homePage.fail.other": "The site has no home page",
  "siteCheck.rule.brokenLinks": "Broken links",
  "siteCheck.rule.brokenLinks.pass": "Every link goes somewhere",
  "siteCheck.rule.brokenLinks.fail.one": "1 link goes to a page or file that's gone",
  "siteCheck.rule.brokenLinks.fail.other": "{count} links go to a page or file that's gone",
  "siteCheck.rule.placeholders": "Placeholder text",
  "siteCheck.rule.placeholders.pass": "No placeholder text left",
  "siteCheck.rule.placeholders.fail.one": "1 text is still a placeholder",
  "siteCheck.rule.placeholders.fail.other": "{count} texts are still placeholders",
  "siteCheck.rule.pageTitles": "Page titles",
  "siteCheck.rule.pageTitles.pass": "Every page has a title",
  "siteCheck.rule.pageTitles.fail.one": "1 page has no title",
  "siteCheck.rule.pageTitles.fail.other": "{count} pages have no title",
  "siteCheck.rule.webAddress": "Web address",
  "siteCheck.rule.webAddress.pass": "The site's web address is in Site Settings",
  "siteCheck.rule.webAddress.fail.one":
    "Add your web address: without it, the site has no sitemap, no picture when it's shared and no business details for search engines",
  "siteCheck.rule.webAddress.fail.other":
    "Add your web address: without it, the site has no sitemap, no picture when it's shared and no business details for search engines",
  "siteCheck.rule.externalResources": "Files from other websites",
  "siteCheck.rule.externalResources.pass": "Your site loads nothing from other websites",
  "siteCheck.rule.externalResources.fail.one":
    "1 file comes from another website, so your site won't work offline. Remove it, or allow its address in Settings › Custom Code",
  "siteCheck.rule.externalResources.fail.other":
    "{count} files come from other websites, so your site won't work offline. Remove them, or allow their addresses in Settings › Custom Code",
  "siteCheck.rule.forms": "Forms",
  "siteCheck.rule.forms.pass": "Every form has somewhere to send its messages",
  "siteCheck.rule.forms.fail.one": "1 form has nowhere to send its messages",
  "siteCheck.rule.forms.fail.other": "{count} forms have nowhere to send their messages",
  "siteCheck.rule.missingImages": "Missing images",
  "siteCheck.rule.missingImages.pass": "Every image is in Media",
  "siteCheck.rule.missingImages.fail.one": "1 image was deleted from Media",
  "siteCheck.rule.missingImages.fail.other": "{count} images were deleted from Media",
  "siteCheck.rule.altText": "Alt text",
  "siteCheck.rule.altText.pass": "Every image has alt text",
  "siteCheck.rule.altText.fail.one": "1 image has no alt text",
  "siteCheck.rule.altText.fail.other": "{count} images have no alt text",
  "siteCheck.rule.contrast": "Colour contrast",
  "siteCheck.rule.contrast.pass": "Text is easy to read on its background",
  "siteCheck.rule.contrast.fail.one": "1 colour is hard to read on its background",
  "siteCheck.rule.contrast.fail.other": "{count} colours are hard to read on their background",
  "siteCheck.rule.largeImages": "Large images",
  "siteCheck.rule.largeImages.pass": "No image is bigger than it needs to be",
  "siteCheck.rule.largeImages.fail.one": "1 image is over 4000 pixels",
  "siteCheck.rule.largeImages.fail.other": "{count} images are over 4000 pixels",
  "siteCheck.rule.largeFiles": "Large downloads",
  "siteCheck.rule.largeFiles.pass": "No linked file is over 10 MB",
  "siteCheck.rule.largeFiles.fail.one": "1 linked file is over 10 MB, slow to download on a phone",
  "siteCheck.rule.largeFiles.fail.other":
    "{count} linked files are over 10 MB, slow to download on a phone",
  "siteCheck.rule.underlinedText": "Underlined text",
  "siteCheck.rule.underlinedText.pass": "Only links are underlined",
  "siteCheck.rule.underlinedText.fail.one":
    "1 underlined text isn't a link, which visitors may click",
  "siteCheck.rule.underlinedText.fail.other":
    "{count} underlined texts aren't links, which visitors may click",

  // Being found (3.17): what stops people finding the site. Nothing on keywords or lengths (SEO-11).
  "siteCheck.group.found": "Being found",
  "siteCheck.group.found.intro": "What helps people find your site with a search engine.",
  "siteCheck.badge.must": "Must fix",
  "siteCheck.badge.should": "Should fix",
  "siteCheck.badge.tip": "Tip",
  "siteCheck.rule.searchHidden": "Search engines",
  "siteCheck.rule.searchHidden.pass": "Search engines may list your site",
  "siteCheck.rule.searchHidden.fail.one":
    "Your site is hidden from search engines, so people won't find it there",
  "siteCheck.rule.searchHidden.fail.other":
    "Your site is hidden from search engines, so people won't find it there",
  "siteCheck.rule.pageDescriptions": "Page descriptions",
  "siteCheck.rule.pageDescriptions.pass": "Every page has a description",
  "siteCheck.rule.pageDescriptions.fail.one":
    "1 page has no description, so search engines pick words from it for its result",
  "siteCheck.rule.pageDescriptions.fail.other":
    "{count} pages have no description, so search engines pick words from them for their results",
  "siteCheck.rule.sameTitles": "Different titles",
  "siteCheck.rule.sameTitles.pass": "Every page has a title of its own",
  "siteCheck.rule.sameTitles.fail.one":
    "1 page has the same title as another, so search results can't tell them apart",
  "siteCheck.rule.sameTitles.fail.other":
    "{count} pages have the same title as another, so search results can't tell them apart",
  "siteCheck.rule.sameDescriptions": "Different descriptions",
  "siteCheck.rule.sameDescriptions.pass": "Every page has a description of its own",
  "siteCheck.rule.sameDescriptions.fail.one":
    "1 page has the same description as another, so search results can't tell them apart",
  "siteCheck.rule.sameDescriptions.fail.other":
    "{count} pages have the same description as another, so search results can't tell them apart",
  "siteCheck.rule.mainHeading": "Main heading",
  "siteCheck.rule.mainHeading.pass": "Every page has one main heading",
  "siteCheck.rule.mainHeading.fail.one":
    "1 page doesn't have one main heading. Search engines take the first heading as the page's subject",
  "siteCheck.rule.mainHeading.fail.other":
    "{count} pages don't have one main heading. Search engines take the first heading as the page's subject",
  "siteCheck.rule.businessDetails": "Business details",
  "siteCheck.rule.businessDetails.pass":
    "Nothing is missing that search engines show with a business",
  "siteCheck.rule.businessDetails.fail.one":
    "1 detail search engines show with a business is missing from Site Settings",
  "siteCheck.rule.businessDetails.fail.other":
    "{count} details search engines show with a business are missing from Site Settings",
  "siteCheck.rule.businessProfile": "Google Business Profile",
  "siteCheck.rule.businessProfile.pass": "Done",
  "siteCheck.rule.businessProfile.fail.one":
    "Set up or check your Google Business Profile: it's what ranks a local business on Google",
  "siteCheck.rule.businessProfile.fail.other":
    "Set up or check your Google Business Profile: it's what ranks a local business on Google",
  "siteCheck.rule.searchConsole": "Google Search Console",
  "siteCheck.rule.searchConsole.pass": "Done",
  "siteCheck.rule.searchConsole.fail.one":
    "Verify your site in Google Search Console to see how people find it, then paste its code in Site Settings",
  "siteCheck.rule.searchConsole.fail.other":
    "Verify your site in Google Search Console to see how people find it, then paste its code in Site Settings",
  "siteCheck.done": "Done",
  "siteCheck.done.label": "Done: {item}",
  "siteCheck.guide.failed": "Your web browser didn't open. Try again in a moment.",

  // Where each finding is.
  "siteCheck.place.page": "{element} on {page}",
  "siteCheck.place.header": "{element} in the Header",
  "siteCheck.place.footer": "{element} in the Footer",
  "siteCheck.place.shared": "{element} in the shared section {name}",
  "siteCheck.place.menu": "Menu item {name}",
  "siteCheck.place.address": "Site Settings › Web address",
  "siteCheck.place.code.css": "Custom Code › Stylesheet",
  "siteCheck.place.code.js": "Custom Code › Script",
  "siteCheck.place.code.head": "Custom Code › HTML in every page's head",
  "siteCheck.place.code.bodyEnd": "Custom Code › HTML at the end of every page",
  "siteCheck.place.theme": "{foreground} on {background}",
  "siteCheck.place.reversed": "{foreground} on {background}, in reversed sections",
  "siteCheck.place.untitled": "Untitled page ({file})",
  "siteCheck.place.contact.address": "Site Settings › Address",
  "siteCheck.place.contact.phone": "Site Settings › Phone number",
  "siteCheck.place.contact.openingHours": "Site Settings › Opening hours",
  "siteCheck.place.search": "Site Settings › Search engines",
  "siteCheck.place.guide.businessProfile": "Open Google Business Profile",
  "siteCheck.place.guide.searchConsole": "Open Google Search Console",
  "siteCheck.detail.contrast": "{ratio}:1, needs {required}:1",
  "siteCheck.detail.size": "{width} × {height} pixels",
  "siteCheck.detail.noHeading": "No main heading: add a large Heading or a Hero",
  "siteCheck.detail.headings": "{count} main headings: keep one large Heading or Hero",
  "siteCheck.detail.sameAs": "The same as {file}",

  // Fixes, each one undo step.
  "siteCheck.history.renamed": "Renamed the file of {item}",
  "siteCheck.history.titled": "Gave {item} a title",

  // Export stops for what must be fixed (X5).
  "siteCheck.exportBlocked.one": "Fix 1 thing in Site Check before exporting",
  "siteCheck.exportBlocked.other": "Fix {count} things in Site Check before exporting",
} as const;
