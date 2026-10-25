# Storefront review

## Fixed

- All public showcase items can be added to the cart, including unpriced items.
- Product cards and product details show prominent Add to cart buttons.
- Quote checkout saves customer details and server-validated item names/quantities with a unique SAMZ-Q reference.
- Quote checkout does not imply stock availability, a payment, or a confirmed order.
- Priced products retain transactional stock reservation and order checkout when configured.
- Unpriced items never produce a misleading $0 total. Mixed carts display only the priced subtotal.
- Quantity controls, removal and device-local cart persistence are supported.
- Cart loading does not falsely label saved selections as removed products.
- Duplicate request retries return the original reference.
- Cart buttons and filters have larger touch targets; skip navigation and consent information are accessible.
- Admin emails are stored privately in the Worker secret; production deployments preserve dashboard variables.
- Node 24 and a pinned Wrangler deploy command are configured for Cloudflare builds.

## Verification

- 13 automated tests pass locally, including cart presentation and quote API validation.
- Cloudflare fetched the repository, built the Worker, ran the initial 12-test suite and deployed successfully.
- Live desktop browser: Add to cart, cart display, quantity controls, cart persistence and removal checked.
- Cloudflare Access protects the admin link and API; missing and forged identity tokens are denied in tests.
- Re-fetched the 12 matching Instagram captions; none contains an explicit currency price.

## Remaining launch work

- Confirm real product prices, quantities, materials, dimensions and lead times with the maker. Admins can edit all these details; do not invent them.
- Configure and verify an outbound email sender. Requests are saved and notifications queued, but email delivery is not active.
- Complete signed-in admin photo-upload/edit checks and an actual mobile-device visual pass.
- Replace reel preview graphics with original product stills where possible.
- Card payments are outside the current order-request workflow.
- Confirm automatic push-event deployments separately from the successful manually initiated Git build.

No existing product values or stock counts were overwritten by this review.

## Yarn styling revision

- Shared storefront and studio styles use woven textures, running stitches and decorative vector yarn illustrations. No remote fonts or new dependencies.
- Primary button text: 7.50:1 contrast; body text: 11.27:1; secondary text: 5.64:1; placeholder text: 5.19:1. All exceed the WCAG 2.2 AA 4.5:1 text threshold for these tested pairs.
- Form borders: 3.76:1; focus outline: 7.09:1 against the light surface.
- Primary and icon controls have at least 44px touch targets. Reduced-motion and forced-colour preferences have explicit styles.
- Mobile navigation remains accessible; inputs use 16px text; dialogs have programmatic accessible names; decorative SVGs are hidden from assistive technology.
- These focused checks are not a full WCAG certification. Signed-in admin and actual phone visual checks remain necessary.

## Product photo preparation and framing

- Product cards now establish a 4:5 frame and absolutely position a contained image inside it. Intrinsic HTML image dimensions cannot force tall mobile grid tracks; full photos remain visible.
- Camera/gallery selections prepare a 1200×1500 cream-framed JPEG locally. Gentle tonal correction can be disabled and the photo rotated; no AI-generated details, subject cutout or background replacement is performed.
- Saving uploads the prepared photo plus an unenhanced copy at web resolution in one transaction. Uploading alone does not change a listing. A separate image_sources mapping retains the original for later preparation without repeatedly applying correction.
- Existing uploaded files remain untouched. Their cards benefit immediately from corrected framing. Use “Prepare saved photo” when editing an existing listing to preview and save the same treatment.
- D1 migration: additive CREATE TABLE IF NOT EXISTS image_sources. Existing listings, images and orders are preserved.
- Automated coverage includes portrait/landscape/rotated fit geometry, bounded tonal lift, compression limits, authenticated upload/source retrieval, atomic source retention and no publication before listing save. Full signed-in physical-phone camera testing remains an owner check.

## Free browser AI photo editor

- U²-Net-P (Apache-2.0) ONNX model from rembg, served through a pinned mirror with SHA-256 verified against the original release, plus ONNX Runtime Web 1.22.0. The larger BiRefNet model failed during inference in the test browser and was replaced. No billable inference API, API key, GPU hosting or image upload to an AI provider.
- Model and runtime files download from Hugging Face/jsDelivr when editing starts, not when customers browse. Initial model download is approximately 5 MB, plus runtime files. Inference runs through single-threaded WASM. Cache availability depends on the browser.
- Inference uses a dedicated module worker. Only its response permits remote dependency downloads and WebAssembly compilation; storefront/admin document CSP stays unchanged. No unsafe-eval or paid fallback.
- Main thread keeps the source product pixels, applies the returned alpha mask, trims empty margins and uses the existing cream-frame/compression workflow. Preview toggle restores the original background. Original web-resolution photo retention remains in place.
- Cancel terminates the inference worker; timeout/failure retains the normal prepared photo. Mask coverage checks reject empty or implausibly full masks. Public /photo-studio/ is a noindex local-only test/download tool and cannot publish listings.
- Open-source model/library credits: /photo-credits/.
