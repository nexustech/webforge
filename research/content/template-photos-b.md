# Template photos: 2.15b (Consultant, Photographer/Portfolio, Shop)

**Status:** 🟡 Shortlist for the product owner's review (2.15b, 26 Oct 2026). Nothing is downloaded until it is approved; a small PR then swaps the approved photos in.
**Decision:** Q6, refined 26 Oct 2026 ([spec/04 §9](../../spec/04-implementation-plan.md#9-open-questions), [spec/02 §7](../../spec/02-mvp-spec.md)): templates ship with generated placeholders (CC0, made by `tools/src/template-placeholder.ts`), and each batch shortlists real CC0 or public-domain photos.

## How these were found
The same way as [stream C's shortlist](template-photos-c.md):
- **Index:** [Openverse](https://openverse.org/)'s API with the licence filter set to CC0.
- **Source:** [StockSnap](https://stocksnap.io/license), which releases every photo under CC0.
- **Not downloaded:** only the results' metadata (title, author, size, page) was read.
- **Checks before the swap:** the swap PR opens each photo's page and records what it says in `images.json` (source URL, author, `CC0-1.0`). A photo whose page says otherwise is dropped for its alternate.

**People in photos.** CC0 covers the photographer's rights, not the rights of the person shown, so there is no model release. So:
- the makers' photos are hands at work, not faces;
- the consultant's and photographer's portraits come with an alternate, and the product owner may keep the generated ones until a photo with a release is found.

**Photographer's placeholders are marked as placeholders.** A photographer's site is their work, so its generated pictures say "Placeholder:" in their alt text, until the swap or until the owner replaces them with their own photos.

## Consultant (Meridian)
| # | Placeholder (file, use) | Choice | Author | Licence | Alternate |
|---|---|---|---|---|---|
| 1 | `portrait.png` (1:1), Home's Hero: "Jo Hartley" | [Woman Portrait](https://stocksnap.io/photo/woman-portrait-EJ3DVIGPDX) (5504×8256) | Matt Moloney | CC0 (StockSnap) | [Business Man](https://stocksnap.io/photo/business-man-IVZBYWKEFM) (6720×4480), Direct Media |
| 2 | `office.png` (4:3), About: TextImage | [Office Work](https://stocksnap.io/photo/office-work-I9INCIK831) (3778×2519) | Châu Thông Phan | CC0 (StockSnap) | [Business Office](https://stocksnap.io/photo/business-office-NFQXL48U22) (4866×3168), Olu Eletu |

## Photographer/Portfolio (Darkroom)
| # | Placeholder (file, use) | Choice | Author | Licence | Alternate |
|---|---|---|---|---|---|
| 1 | `hero.png` (9:5), Home's full-width Hero | [Coast Sunset](https://stocksnap.io/photo/coast-sunset-WNVFXOQHM4) (5472×3648) | JJ Skys the Limit | CC0 (StockSnap) | [Beach Shore](https://stocksnap.io/photo/beach-shore-ISJPOX8JCR) (5361×3574), Nick Karvounis |
| 2 | `work-1.png`: "Dawn over the bay" | [Sunrise Beach](https://stocksnap.io/photo/sunrise-beach-YGV6SF4MZU) (2732×1536) | Vikram Mudaliar | CC0 (StockSnap) | [Nature Beach](https://stocksnap.io/photo/nature-beach-DI64TAJTIS) (4928×3280), frank mckenna |
| 3 | `work-2.png`: "The harbour wall at high tide" | [Boats Ships](https://stocksnap.io/photo/boats-ships-Q0HFATEZMQ) (5582×3140) | Nick Karvounis | CC0 (StockSnap) | [Boats Ships](https://stocksnap.io/photo/boats-ships-27D9PQ26RJ) (4305×2815), Markus Spiske |
| 4 | `work-3.png`: "Heather on the moor in August" | [Heather Flowers](https://stocksnap.io/photo/heather-flowers-9SIQ6VJJ1X) (5184×3888) | The World is a Stage | CC0 (StockSnap) | [Heather Flowers](https://stocksnap.io/photo/heather-flowers-XK7YONNE4A) (5184×3888), same author |
| 5 | `work-4.png`: "Last light on the headland" | [Sunset Mountains](https://stocksnap.io/photo/sunset-mountains-Z16VKDBQ4J) (5760×3840) | Jordan McQueen | CC0 (StockSnap) | [Ocean Sea](https://stocksnap.io/photo/ocean-sea-8P8FMRCOSZ) (5738×3825), Aaron Kato |
| 6 | `work-5.png`: "First snow on the fells" | [Snow Mountain](https://stocksnap.io/photo/snow-mountain-6DC0ERNTN3) (3999×2837) | Tyler Lastovich | CC0 (StockSnap) | [Snow Mountain](https://stocksnap.io/photo/snow-mountain-KWMYJNGPAH) (3000×1893), Bernard Spragg |
| 7 | `work-6.png`: "Stars over the old lighthouse" | [Lighthouse Dark](https://stocksnap.io/photo/lighthouse-dark-EAHXQ07CNR) (5760×3840) | Oliver Ivanov | CC0 (StockSnap) | [Structure Lighthouse](https://stocksnap.io/photo/structure-lighthouse-QIMXXHTIQG) (1440×2152), Joshua Hibbert |
| 8 | `portrait-1.png`: "A family on the beach" | [People Family](https://stocksnap.io/photo/people-family-Z59RZ5SREK) (3861×2574) | Natalya Zaritskaya | CC0 (StockSnap) | [Father Son](https://stocksnap.io/photo/father-son-6EUED59RML) (3365×2241), Studio 7042 |
| 9 | `portrait-2.png`: "A fisherman on the quay" | [Fishing Fisherman](https://stocksnap.io/photo/fishing-fisherman-UQE01YNPX0) (4608×3456) | Ian Prince | CC0 (StockSnap) | [Fisherman Silhouette](https://stocksnap.io/photo/fisherman-silhouette-UADULRRHEK) (5101×2549), Wyncliffe |
| 10 | `rowan.png` (1:1), About: "Rowan Hale with a camera" | [Photographer Camera](https://stocksnap.io/photo/photographer-camera-LWKE5NGA77) (5760×3840) | Leeroy | CC0 (StockSnap) | [Photographer Camera](https://stocksnap.io/photo/photographer-camera-L0D9N4OE1F) (3539×2359), Burst |

## Shop (Market)
| # | Placeholder (file, use) | Choice | Author | Licence | Alternate |
|---|---|---|---|---|---|
| 1 | `hero.png` (1:1), Home's Hero: a planter | [Plant Pot](https://stocksnap.io/photo/plant-pot-KMGC56X3AO) (5184×3456) | Tran Mau Tri Tam | CC0 (StockSnap) | [Plant Pot](https://stocksnap.io/photo/plant-pot-380B8E608B) (4896×3264), Julien Sister |
| 2 | `product-1.png`: Speckled planter | [Potted Plant](https://stocksnap.io/photo/potted-plant-03RGWASUK1) (5760×3840) | Kristin Hardwick | CC0 (StockSnap) | [Potted Plants](https://stocksnap.io/photo/potted-plants-JOHHVIOMIW) (4460×2973), Burst |
| 3 | `product-2.png`: Tea mug | [Teacup Ceramic](https://stocksnap.io/photo/teacup-ceramic-ZBI29DFT5Y) (6000×4000) | Bruze Walker | CC0 (StockSnap) | [Coffee Mug](https://stocksnap.io/photo/coffee-mug-JCEKFWH9O7) (8078×5388), Matt Bango |
| 4 | `product-3.png`: Seedling set | [Potted Plants](https://stocksnap.io/photo/potted-plants-NPPTA6CQTM) (8192×5464) | Matt Bango | CC0 (StockSnap) | [Plants Pot](https://stocksnap.io/photo/plants-pot-MBP7GJDWJJ) (3200×2022), Daria Nepriakhina |
| 5 | `product-4.png`: Hanging pot | [Wall Plant](https://stocksnap.io/photo/wall-plant-3OJ8PWHM4D) (5862×3913) | Joe deSousa | CC0 (StockSnap) | [House Plant](https://stocksnap.io/photo/house-plant-IWYD3EMQ6O) (8192×5464), Matt Bango |
| 6 | `product-5.png`: Coffee cup | [Espresso Cup](https://stocksnap.io/photo/espresso-cup-N4NTC0KII6) (5760×3840) | Kristin Hardwick | CC0 (StockSnap) | [Coffee Latte](https://stocksnap.io/photo/coffee-latte-WDJES619M1) (2816×2112), David Bares |
| 7 | `product-6.png`: Gift box | [Gift Box](https://stocksnap.io/photo/gift-box-MVXFOGU8DF) (5472×3648) | Negative Space | CC0 (StockSnap) | [Gift Box](https://stocksnap.io/photo/gift-box-KBGJKIUPDH) (5616×3744), George Dolgikh |
| 8 | `studio.png` (4:3), About: TextImage | [Ceramics Pottery](https://stocksnap.io/photo/ceramics-pottery-SWDR6XR7YS) (5000×3333) | Barn Images | CC0 (StockSnap) | [Art Clay](https://stocksnap.io/photo/art-clay-5AGZX1ZSDQ) (2952×1968), Quino Al |
| 9 | `maker-1.png` (1:1), Team: "Mia, who throws the pots" | [Hand Ceramic](https://stocksnap.io/photo/hand-ceramic-YO5LLLKAUO) (3000×2000), hands only | Cala | CC0 (StockSnap) | [Crafts Hobby](https://stocksnap.io/photo/crafts-hobby-UO4VC2M9HP) (5532×3688), Quino Al |
| 10 | `maker-2.png` (1:1), Team: "Tom, who mixes the glazes" | [Art Craft](https://stocksnap.io/photo/art-craft-FRRB2WV88A) (3922×2615) | Linh Pham | CC0 (StockSnap) | [Ceramic Teapot](https://stocksnap.io/photo/ceramic-teapot-5811FEC469) (2509×1673), Nashad Abdu |

**The products don't have to match exactly.** A shop owner replaces every product photo with their own. These only need to read as "a pot", "a mug" or "a gift box" in the right place, and the product names can change to fit the photos chosen.

## For the product owner
1. **Approve:** the 22 choices, or name an alternate per row.
2. **The portraits:** use photos of people (Consultant row 1; Photographer rows 8–10), or keep the generated ones until there are photos with model releases.
