# Samz Crafts

Live shop: https://samz-crafts.faizan-awan.workers.dev/
Maker studio: https://samz-crafts.faizan-awan.workers.dev/admin

A mobile-responsive crochet storefront with an email-code protected maker studio. Built without frontend dependencies; runs on Cloudflare Workers + D1. Existing SAKAN Lodge resources are untouched.

## Status

- Deployed publicly to Cloudflare; twelve public Instagram reel images imported as showcase listings.
- Admin access restricted by Cloudflare Access plus server-side signed JWT validation to the two approved email addresses in the private `ADMIN_EMAILS` Worker secret. No passwords needed. The customer storefront does not expose either email address.
- WhatsApp and Messenger are configurable in private shop settings; email enquiry form persists enquiries in admin.
- Maker studio supports camera/gallery upload, automatic JPEG resizing, product title/description/category/price/stock/visibility, archiving/restoring, order status management, enquiries, settings, activity, and email outbox.
- Order requests generate an ID, reserve stock transactionally, compute totals from database prices, and queue email to buyer and both admins. Duplicate retries are idempotent. Cancelling restores stock exactly once.
- **Checkout deliberately closed:** actual prices/stock are unknown and no email sender is configured. No invented prices or stock. Showcase listings support enquiries.
- No card payment integration. Delivery costs and payment instructions are confirmed manually before payment.
- Source repository: https://github.com/FaizanAwan1995/samzcraft (created by the owner).
- Automated tests: 8 passing. Desktop live UI checked; contact form opens and dock hides/restores. Admin path reaches Cloudflare email-code login. Signed-in admin UI and phone viewport remain unverified.

## Finish setup

1. Before redeploying this configurable source, set `ADMIN_EMAILS` to the two approved comma-separated email addresses in Cloudflare Worker secrets. The running deployment already has its admin allowlist; this source avoids publishing personal addresses. Also set Cloudflare Worker secrets `EMAIL_API_KEY` (Resend) and `EMAIL_FROM` (an address on a verified sender domain). Do not use a Gmail address as an unverified sender. Keys must never enter source control. Email replies route to the shop's nominated Gmail.
2. Sign into the maker studio, confirm product photos/details, set real AUD prices and stock, and change those products to For sale.
3. Verify a test email to both admins and an actual controlled buyer address. Open online order requests in Shop settings only after that check.
4. Source is maintained in `FaizanAwan1995/samzcraft`. No credentials are included. Cloudflare currently uses a direct deployment; pushing to GitHub does not automatically deploy.
5. Optional: add a crochet business domain to the Worker and extend Access protection to its /admin path. Do not add an admin route on an unprotected hostname without updating the Access application.

## Build and tests

Node.js 24+:

```
npm run build
npm test
```

`build.mjs` embeds HTML/CSS/JS and the imported image assets into a single deployable Worker (`deploy.mjs`). `worker.mjs` is the source backend. Schema and transactional stock triggers are in `schema.sql`; `seed.json` records showcase imports. Apply the schema to the dedicated D1 database, then import seed rows (insert only; never overwrite admin edits).

`wrangler.jsonc` records the actual Cloudflare D1 ID. No package dependencies required for build/tests. Deploy the built worker with Cloudflare API or a separately installed official Wrangler CLI. Production cron runs every 15 minutes for outbox retries and rate-limit cleanup.

Photos are compressed to JPEG, limited to under 487 KiB binary, and stored in D1 to avoid requiring R2 activation. Large-scale photo catalogues should migrate uploads to R2. Imported photos are reel preview images and can contain preview graphics; replace with original product stills using the studio for a cleaner catalogue. Image rights were authorized by the user for their mother's account.

## Design research

Reviewed Crochet by Brewer, Kimmys Creations (South Australia), and ChezSue Studio. Adopted clear collections, a personal maker story, prominent imagery, and explicit made-to-order/delivery expectations. No competitor photos, text, prices, reviews, or inventory were copied.

- https://www.crochetbybrewer.com.au/
- https://kimmyscreationsau.com/
- https://www.chezsuestore.com/

## Validation notes

Tests exercise admin denial, catalogue privacy, sender-required checkout, database-derived prices, stock reservation, idempotency, transaction rollback, cancellation, CSRF, invalid quantities, and persisted enquiries with deferred email. Tests use only local SQLite and a mocked email provider; no test messages or orders were sent to real people. End-to-end email delivery is pending sender setup.
