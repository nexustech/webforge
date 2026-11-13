---

id: sections
title: Sections
summary: Every section you can add to a page, what it's for and what you can change.
components: [Section, Hero, TextSection, TextImage, CallToAction, Faq, FaqItem, Gallery, GalleryImage, Video, Map, ContactDetails, ContactForm, Newsletter, Features, Feature, Testimonials, Testimonial, Team, TeamMember, Pricing, PricingPlan, Logos, Logo, Stats, Stat]
related: [elements, add-panel, edit-panel, forms, header-and-footer]
updated: 2026-11-13
---

# Sections

A **section** is a full-width band of a page: a Hero at the top, a Gallery, a Contact form and so on. Sections stack one under another. Inside each one are **elements** such as headings, text, images and buttons (see [Elements](elements.md)).

To add a section, open the **Add** panel's **Sections** tab and click one: it goes after the selected section. You can also drag it onto the page, or click the **+** between two sections on the page. See [The Add panel](add-panel.md).

## What every section has

Select a section and open the Edit panel's **Style** tab:

- **Layout:** most sections come in two or more layouts, listed below.
- **Colours:** _Page colours_, or _Reversed_, which swaps the theme's light and dark colours to make a dark band on a light page (or a light band on a dark one).
- **Content width:** _Narrow_, _Medium_, _Wide_ or _Full_. The background always fills the page's width; this sets how wide the content inside is.
- **Padding** and **Margin:** the room inside and around the section.
- **Background image** (in the Content tab, on every section but the Hero, which has _Image behind the text_), with an **Overlay** (_None_ to _Very strong_) and **Overlay colour** that darken or lighten the picture so text stays readable. {appName} warns you when the text would be hard to read. A gradient from **Style This…** is drawn over the picture and under the overlay; its **Gradient opacity** sets how much of the picture shows through (50% unless you change it).
- **Entrance animation:** _Fade in_, _Slide up_, _Slide in from the left_, _Slide in from the right_ or _Zoom in_, with a _Delay_. It plays once, when a visitor scrolls to the section, and never for visitors whose device asks for less motion.
- **Appearance:** text, colour, corners, border, shadow and opacity. See [Styling](styling.md).

Many sections hold a list of items, such as a Gallery's images or an FAQ's questions. Add, remove and reorder them in the Edit panel's **Content** tab. While the section is selected, the Add panel's **Suggested** group offers its kind of item too.

## Hero

The large opening section of a page: a title, a short text, a button and an image.

- **Layouts:** _Image beside the text_, _Centred, image below_, _Image behind the text_, _Text only_.
- **Alignment:** _Centre_ or _Left_.

## Text

A title and formatted text: paragraphs, bold, links and lists.

## Text + Image

Text beside a picture. **Layouts:** _Image on the right_ or _Image on the left_.

## Call to action

Asks visitors to do one thing, with a title, a short text and a button. **Layouts:** _Banner_, centred in the theme's dark colour, or _Button beside the text_.

## Features

What you offer, or the reasons to choose you. Each **Feature** has an icon, a title and a text.

- **Layouts:** _Cards_, _Centred icons_ or _List_.
- **Cards when hovered** sets what the cards do under the pointer (see [Styling](styling.md#hover-effects)).

## Gallery

A set of pictures, each with an optional caption.

- **Layouts:** _Grid_, _Natural shapes_ (each picture keeps its own shape) or _First image large_.
- On your site, clicking a picture opens it larger, with previous and next buttons; visitors can also use the arrow keys or swipe.

## Testimonials

What your customers say: a quote, their name, who they are and an optional photo. **Layouts:** _Cards_, _Large quotes_ or _Photo beside each quote_.

## Team

The people behind the business: a photo, a name, what they do and a short text. **Layouts:** _Cards_, _Round photos_ or _List_.

## Pricing

Your plans or a price list. Each **Plan** has a name, a price, what it's per ("a month", "a session"), what's included and a button.

- **Layouts:** _Cards_ or _Price list_.
- Turn on **Highlight this plan** to show one plan in your brand colour. Only a highlighted plan shows its **Badge** ("Most popular").

## FAQ

Questions and answers. **Layouts:**

- _Questions that open:_ visitors click a question to see its answer. This works even when the visitor's browser has scripts turned off.
- _Two columns._
- _All answers shown._

## Stats

A row of numbers you're proud of ("25 years in business"). Each **Stat** is a number and what it counts. The numbers are shown as you type them.

**Layouts:** _Row_, _Cards_ or _Beside the text_.

## Logos

"As seen in", your customers or your partners: a row of logos, each with an optional link. **Layouts:** _Row_ or _Grid of tiles_.

## Video

A YouTube or Vimeo video with a title and text. **Layouts:** _Text above_ or _Text beside_. Paste the video's address from YouTube or Vimeo into **Video address**; other addresses show no video.

Your site shows a placeholder with a _Play the video_ button first. Nothing loads from YouTube or Vimeo until the visitor clicks it, or accepts all in the cookie banner, which keeps your site fast and private. YouTube videos use its privacy-enhanced player.

## Map

A map of your address. **Layouts:** _Text above_ or _Text beside_. Type the address, or show the one from [Site Settings](site-settings.md#contact-details-and-opening-hours). Like a video, the map loads only when a visitor clicks _Show the map_, or accepts all in the cookie banner. Your site uses Google Maps for an address, or OpenStreetMap when you paste an OpenStreetMap link.

## Opening hours and contact

Your opening hours, address, phone number and email, taken from [Site Settings](site-settings.md#contact-details-and-opening-hours). Change them there, once, and every page that shows them updates.

- Turn **Show opening hours** and **Show contact details** on or off.
- Anything left empty in Site Settings is left out.
- **Layouts:** _Side by side_ or _One above the other_.

## Contact form

A ready-made form asking for a name, an email address, a message and, if you turn on _Ask for a phone number_, a phone number. **Layouts:** _Text above_ or _Text beside_.

Messages are sent to the form service you choose in Site Settings. Until you choose one, the form's button is turned off and the page reminds you. See [Forms](forms.md).

## Newsletter signup

An email signup for a newsletter service you already use. {appName} doesn't include one of its own. Paste the service's form address (starting `https://`) into **Form address**, and the name it expects for the email field into **Email field's name**. Turn on **Ask for a name** if your service takes one.

This section sends sign-ups straight to that service, not to the form service in Site Settings.

## Section

A blank band to fill with any elements you like. **Space between elements** sets how far apart they sit.
