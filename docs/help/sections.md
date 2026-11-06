---
id: sections
title: Sections
summary: Every section you can add to a page, what it's for and what you can change.
components: [Section, Hero, TextSection, TextImage, CallToAction, Faq, FaqItem, Gallery, GalleryImage, Video, Map, ContactDetails, ContactForm, Newsletter, Features, Feature, Testimonials, Testimonial, Team, TeamMember, Pricing, PricingPlan, Logos, Logo, Stats, Stat]
related: [elements, add-panel, edit-panel, forms, header-and-footer]
updated: 2026-11-06
---

# Sections

A **section** is a full-width band of a page: a Hero at the top, a Gallery, a Contact form and so on. Sections stack one under another. Inside each one are **elements** such as headings, text, images and buttons (see [Elements](elements.md)).

To add a section, open the **Add** panel's **Sections** tab and click one: it goes after the selected section. You can also drag it onto the page, or click the **+** between two sections on the page. See [The Add panel](add-panel.md).

## What every section has

Select a section and open the Edit panel's **Style** tab:

- **Layout:** most sections come in two or more layouts, listed below.
- **Colours:** *Page colours*, or *Reversed*, which swaps the theme's light and dark colours to make a dark band on a light page (or a light band on a dark one).
- **Content width:** *Narrow*, *Medium*, *Wide* or *Full*. The background always fills the page's width; this sets how wide the content inside is.
- **Padding** and **Margin:** the room inside and around the section.
- **Background image** (in the Content tab, on every section but the Hero, which has *Image behind the text*), with an **Overlay** (*None* to *Very strong*) and **Overlay colour** that darken or lighten the picture so text stays readable. {appName} warns you when the text would be hard to read.
- **Entrance animation:** *Fade in*, *Slide up*, *Slide in from the left*, *Slide in from the right* or *Zoom in*, with a *Delay*. It plays once, when a visitor scrolls to the section, and never for visitors whose device asks for less motion.
- **Appearance:** text, colour, corners, border, shadow and opacity. See [Styling](styling.md).

Many sections hold a list of items, such as a Gallery's images or an FAQ's questions. Add, remove and reorder them in the Edit panel's **Content** tab. While the section is selected, the Add panel's **Suggested** group offers its kind of item too.

## Hero

The large opening section of a page: a title, a short text, a button and an image.
- **Layouts:** *Image beside the text*, *Centred, image below*, *Image behind the text*, *Text only*.
- **Alignment:** *Centre* or *Left*.

## Text

A title and formatted text: paragraphs, bold, links and lists.

## Text + Image

Text beside a picture. **Layouts:** *Image on the right* or *Image on the left*.

## Call to action

Asks visitors to do one thing, with a title, a short text and a button. **Layouts:** *Banner*, centred in the theme's dark colour, or *Button beside the text*.

## Features

What you offer, or the reasons to choose you. Each **Feature** has an icon, a title and a text.
- **Layouts:** *Cards*, *Centred icons* or *List*.
- **Cards when hovered** sets what the cards do under the pointer (see [Styling](styling.md#hover-effects)).

## Gallery

A set of pictures, each with an optional caption.
- **Layouts:** *Grid*, *Natural shapes* (each picture keeps its own shape) or *First image large*.
- On your site, clicking a picture opens it larger, with previous and next buttons; visitors can also use the arrow keys or swipe.

## Testimonials

What your customers say: a quote, their name, who they are and an optional photo. **Layouts:** *Cards*, *Large quotes* or *Photo beside each quote*.

## Team

The people behind the business: a photo, a name, what they do and a short text. **Layouts:** *Cards*, *Round photos* or *List*.

## Pricing

Your plans or a price list. Each **Plan** has a name, a price, what it's per ("a month", "a session"), what's included and a button.
- **Layouts:** *Cards* or *Price list*.
- Turn on **Highlight this plan** to show one plan in your brand colour. Only a highlighted plan shows its **Badge** ("Most popular").

## FAQ

Questions and answers. **Layouts:**
- *Questions that open:* visitors click a question to see its answer. This works even when the visitor's browser has scripts turned off.
- *Two columns.*
- *All answers shown.*

## Stats

A row of numbers you're proud of ("25 years in business"). Each **Stat** is a number and what it counts. The numbers are shown as you type them.

**Layouts:** *Row*, *Cards* or *Beside the text*.

## Logos

"As seen in", your customers or your partners: a row of logos, each with an optional link. **Layouts:** *Row* or *Grid of tiles*.

## Video

A YouTube or Vimeo video with a title and text. **Layouts:** *Text above* or *Text beside*. Paste the video's address from YouTube or Vimeo into **Video address**; other addresses show no video.

Your site shows a placeholder with a *Play the video* button first. Nothing loads from YouTube or Vimeo until the visitor clicks it, or accepts all in the cookie banner, which keeps your site fast and private. YouTube videos use its privacy-enhanced player.

## Map

A map of your address. **Layouts:** *Text above* or *Text beside*. Type the address, or show the one from [Site Settings](site-settings.md#contact-details-and-opening-hours). Like a video, the map loads only when a visitor clicks *Show the map*, or accepts all in the cookie banner. Your site uses Google Maps for an address, or OpenStreetMap when you paste an OpenStreetMap link.

## Opening hours and contact

Your opening hours, address, phone number and email, taken from [Site Settings](site-settings.md#contact-details-and-opening-hours). Change them there, once, and every page that shows them updates.
- Turn **Show opening hours** and **Show contact details** on or off.
- Anything left empty in Site Settings is left out.
- **Layouts:** *Side by side* or *One above the other*.

## Contact form

A ready-made form asking for a name, an email address, a message and, if you turn on *Ask for a phone number*, a phone number. **Layouts:** *Text above* or *Text beside*.

Messages are sent to the form service you choose in Site Settings. Until you choose one, the form's button is turned off and the page reminds you. See [Forms](forms.md).

## Newsletter signup

An email signup for a newsletter service you already use. {appName} doesn't include one of its own. Paste the service's form address (starting `https://`) into **Form address**, and the name it expects for the email field into **Email field's name**. Turn on **Ask for a name** if your service takes one.

This section sends sign-ups straight to that service, not to the form service in Site Settings.

## Section

A blank band to fill with any elements you like. **Space between elements** sets how far apart they sit.
