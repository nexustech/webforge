---
id: elements
title: Elements
summary: Every element you can put inside a section, what it's for and what you can change.
components: [Heading, Text, List, ListItem, Image, Carousel, CarouselSlide, EmbedVideo, Button, Spacer, Divider, Icon, SocialLinks, Columns, Column, Tabs, Tab, EmbedMap, Form, FormField, BuyButton]
related: [sections, add-panel, edit-panel, media, links, forms, custom-code]
updated: 2026-11-06
---

# Elements

An **element** is anything inside a section: a heading, some text, a picture, a button. Open the **Add** panel's **Elements** tab and click one to add it to the selected section, or drag it into a section. A page needs a section before it can hold elements.

The Elements tab groups them as below. Every element but the Spacer has a **Margin**, most have an **Entrance animation**, and all of them have the **Appearance** group in the Style tab (see [Styling](styling.md)).

## Text

### Heading
A title. **Size** is *Large*, *Medium* or *Small*. The size also tells search engines and screen readers how important the heading is, so give each page one Large heading (or a Hero).

### Text
Formatted text: paragraphs, bold, italic, links and lists. Click it on the page and type. See [Editing on the page](editing-on-the-page.md).

### List
A list of short items. **Style** is *Bullets*, *Numbers* or *No markers*. Choose an **Icon instead of markers** to show the same icon before every item; Style is then turned off.

## Images and media

### Image
A picture from [Media](media.md).
- **Width:** *Small*, *Medium*, *Large* or *Full width*.
- **Shape:** *Original*, *Square*, *Landscape (4:3)*, *Wide (16:9)*, *Portrait (3:4)* or *Set height*. Every shape but Original cuts the picture to fit, keeping its focal point in view. It never stretches the picture.
- **Height** (with *Set height*), **Caption**, **Alignment** and **Rounded corners**.
- **Open larger when clicked:** on your site, a click shows the whole picture larger. In the editor a click still selects it.
- **Alt text here:** a description for this one place. Leave it empty to use the image's own alt text from Media.

### Carousel
Slides that visitors move through, one at a time.
- **Layouts:** *Images*, *Testimonials* or *Logos*. Each **Slide** has an image, a text and a name.
- **Play automatically**, with **Next slide after** *5*, *7* or *10 seconds*. The slides pause while a visitor points at or moves into them. They never play by themselves for visitors whose device asks for less motion.
- **Name for screen readers:** what the carousel shows, such as "Our work".
- In the editor the slides are shown one under another, so you can edit each.

### Embed video
The [Video](sections.md#video) section's player as an element, to place beside other elements. Paste a YouTube or Vimeo address. Nothing loads until a visitor clicks to play, or accepts all in the cookie banner.

## Basic

### Button
A link that looks like a button.
- **Button text**, **Button link** (see [Links](links.md)) and an optional **Icon**.
- **Style:** *Theme's style* (follows your theme's buttons), *Filled*, *Second colour* or *Outline*. A style you choose yourself stays when you change the theme.
- **Size:** *Small*, *Medium* or *Large*.
- **When hovered:** what it does under the pointer (see [Styling](styling.md#hover-effects)).

### Booking button
A Button that reads "Book now". Paste the link to your booking page, from whichever booking service you use, into **Button link**. It's added by clicking it in the Add panel.

### Spacer
Empty room between elements. **Height** is *Small* to *Extra large*, and can differ on each device.

### Divider
A line between elements, with optional **Text on the line**, such as "or".

### Icon
One icon. Choose it with **Choose an icon…**, then set its **Size**, **Colour** and **Alignment**. If the icon means something on its own, such as a phone icon used as a link, describe it in **Name for screen readers**. If it's only decoration, leave that empty.

### Social links
Icons linking to your social profiles. Add the profiles once, in [Site Settings › Social & sharing](site-settings.md#social--sharing); every Social links element shows them. Set **Size**, **Colour** and **Alignment** here.

## Layout

### Columns
Places elements side by side, in 1 to 4 **Columns**. Select it to see the **Add column** and **Remove last column** buttons. *Remove last column* removes the last column and everything in it.
- **Column widths:** *Equal*, *First one wider*, *Last one wider*, *Middle one wider* or *One under another*. Set it per device: *One under another* on Mobile is usually what you want.
- **Space between columns:** *Small*, *Medium* or *Large*.

### Tabs
Panels under labels, one shown at a time on your site. Each **Tab** has a **Label** and holds any elements. Visitors can use the arrow keys to move between tabs.

In the editor, and for visitors whose browser has scripts turned off, every panel is shown in turn under its label.

## Contact

### Embed map
The [Map](sections.md#map) section's map as an element. Type an address or use the one from Site Settings. It loads only when a visitor clicks it, or accepts all in the cookie banner.

### Form
A form you build yourself. It starts with name, email and message fields. Each **Form field** asks for one of these:
- *A line of text*
- *An email address*
- *A phone number*
- *A message*
- *A tick box*
- *A choice from a list*

Give each field a **Label**, and say whether it's **Required**. **What the form is for** names the form for screen readers.

The form sends to the form service in Site Settings, like the Contact form. See [Forms](forms.md).

## Shop

### Buy button
Sells one thing: a picture, a price and a button to a payment page you've set up elsewhere.
- **Price:** type it as visitors should read it, with its currency: "£12" or "From €40".
- **Payment link:** the `https://` link from Stripe Payment Links, PayPal or your online shop. The payment happens there; {appName} never handles money.
- Without a payment link, the button is turned off in the editor and left out of your site.

## Advanced

### Custom Code
Your own HTML, for things like a booking widget a service gave you. It's only in the Add panel in Advanced mode. See [Custom Code](custom-code.md).
