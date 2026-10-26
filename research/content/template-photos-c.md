# Template photos: stream C (Personal / CV, Blank)

**Status:** 🟡 Shortlist for the product owner's review (2.15c, 26 Oct 2026). Nothing is downloaded until it is approved; a small PR then swaps the approved photos in.
**Decision:** Q6, refined 26 Oct 2026 ([spec/04 §9](../../spec/04-implementation-plan.md#9-open-questions), [spec/02 §7](../../spec/02-mvp-spec.md)): templates ship with generated placeholders (CC0, made by `tools/src/template-placeholder.ts`), and each stream shortlists real CC0 or public-domain photos for its templates.

## How these were found
- **Index:** [Openverse](https://openverse.org/), searched through its API with the licence filter set to CC0 (`license=cc0`). Openverse indexes each photo's licence from its source.
- **Sources:** mostly [StockSnap](https://stocksnap.io/license), which releases every photo under CC0, and modern photos rather than archive scans.
- **Not downloaded:** only the search results' metadata (title, author, size, page) was read.
- **Checks before the swap:** the swap PR opens each photo's page and records what it says, in `images.json` (source URL, author, `CC0-1.0`). A photo whose page says otherwise is dropped for its alternate.
- **Choosing photos:**
  - Things, hands and work in progress rather than finished designs: a photo of someone else's real logo or poster would show their work, whatever the photo's licence.
  - Product logos (a laptop's) are cropped out or avoided where an alternate exists.

**People in photos.** CC0 covers the photographer's rights, not the rights of the person shown: there is no model release. A template's portrait becomes an example in every site made from it, until the user replaces it. So the portrait candidates are:
- a person at work, not a headshot;
- a person seen from behind or at a distance, as the safest fallback.

The product owner may prefer to keep the generated portrait (row 1) until a released photo is available.

## Blank
No photos: the product owner's decision of 26 Oct 2026 (Blank is Home, About and Contact skeletons).

## Personal / CV
The template's eight images, each with its current generated placeholder, first choice and alternate. Sizes are the originals' in pixels; the swap crops each to the placeholder's shape and size.

| # | Placeholder (file, use) | Choice | Author | Licence | Alternate |
|---|---|---|---|---|---|
| 1 | `portrait.png` (1:1), Home's Hero: "Alex Morgan" | [Studio Artist](https://stocksnap.io/photo/studio-artist-PSEKRQ0TOP) (3456×5184): an artist at work in a studio | Steve Johnson | CC0 (StockSnap) | [Studio Woman](https://stocksnap.io/photo/studio-woman-ZAJ8B3VGGD) (1920×1080), Burst |
| 2 | `studio-desk.png` (4:3), About me: TextImage | [Office Desk](https://stocksnap.io/photo/office-desk-CEXWHUSWIC) (5782×3855) | Design by Matt | CC0 (StockSnap) | [Office Work](https://stocksnap.io/photo/office-work-I9INCIK831) (3778×2519), Châu Thông Phan |
| 3 | `work-1.png` (4:3), Work: "A logo and shop sign for a family bakery" | [Designer Logo](https://stocksnap.io/photo/designer-logo-GW7VC9EJ0X) (4928×3264): a logo being sketched | Messala Ciulla | CC0 (StockSnap) | [Writing Drawing](https://stocksnap.io/photo/writing-drawing-V7OT5ZODQE) (4460×2973), Shopify (Burst) |
| 4 | `work-2.png` (4:3), Work: "Posters for a summer music festival" | [Color Swatches](https://stocksnap.io/photo/color-swatches-VYSZEM4UWE) (3751×2504) | Tim Sullivan | CC0 (StockSnap) | [Colors Colours](https://stocksnap.io/photo/colors-colours-KLIK5Q5KX2) (3000×2000), Martin Vorel |
| 5 | `work-3.png` (4:3), Work: "A website for a local architect" | [Keyboard Typing](https://stocksnap.io/photo/keyboard-typing-WTGTEOHQ8X) (4928×3264) | Messala Ciulla | CC0 (StockSnap) | [Office Work](https://stocksnap.io/photo/office-work-DB8D7GBTJH) (3840×2160), Monoar Rahman |
| 6 | `work-4.png` (4:3), Work: "Illustrations for a children's book" | [Watercolor Paint](https://stocksnap.io/photo/watercolor-paint-2RY71UDSXO) (6016×4000) | Miguel Á. Padriñán | CC0 (StockSnap) | [Watercolor Paint](https://stocksnap.io/photo/watercolor-paint-FH2GACQETE) (2928×2928), Copper and Wild |
| 7 | `work-5.png` (4:3), Work: "Packaging for a small tea company" | [Notebook Mockups](https://stocksnap.io/photo/notebook-mockups-6JNEZ2JEO0) (4608×3456): plain stationery to brand | Jeffrey Betts | CC0 (StockSnap) | [Design Mockups](https://stocksnap.io/photo/design-mockups-P6HXICOTZ5) (4608×3456), Jeffrey Betts |
| 8 | `work-6.png` (4:3), Work: "A menu and branding for a neighbourhood café" | [Paint Brushes](https://stocksnap.io/photo/paint-brushes-265GAALCWG) (5472×3648) | Negative Space | CC0 (StockSnap) | [Paint Supplies](https://stocksnap.io/photo/paint-supplies-TCHBOFXNQ1) (4460×2973), Burst |

**Captions and alt text follow the photos.** The Work page's captions name a client's project. With these photos (work in progress, not finished pieces) the swap PR rewords each caption to fit its photo, and writes each image's alt text from the photo itself:

| Photo | Reworded caption |
|---|---|
| Designer Logo | "Sketching a logo for a family bakery" |
| Color Swatches | "Choosing colours for a festival's posters" |
| Keyboard Typing | "Building a website for a local architect" |
| Watercolor Paint | "Watercolours for a children's book" |
| Notebook Mockups | "Stationery for a small tea company" |
| Paint Brushes | "Hand-painted lettering for a café" |

## For the product owner
1. **Approve:** the eight choices, or name an alternate per row.
2. **The portrait:** a photo of a person (row 1), or keep the generated portrait until one with a model release is found.
3. **The captions:** reworded as above when the photos come in.
