# Samz Crafts search setup

Primary origin: https://samzcrafts.com

## Implemented

- Server-rendered, live D1 catalogue on the home, collection and individual product pages. Public pages use the same content for visitors and search crawlers.
- Dedicated custom crochet orders, ordering/delivery and crochet care guides. Four linked collection pages target the actual product groups, without duplicate city landing pages.
- Descriptive titles, descriptions, one H1 per page, canonical links, Australian English, social sharing metadata, image text and explicit image dimensions.
- Organization, WebSite, WebPage, CollectionPage, BreadcrumbList, ItemList and custom Service JSON-LD as appropriate. Product/Offer markup is limited to active, priced products when order checkout is enabled with a sender configured. No invented prices, ratings, reviews, delivery charges or promises.
- Live XML sitemap with public listing images; robots.txt advertises the sitemap and excludes admin/API paths. Private responses and missing pages have noindex headers. Archived and draft products are excluded and return 404 on product URLs.
- Public GET/HEAD requests to www and the old workers.dev hostname redirect permanently to the primary domain. Admin sessions and write requests are not redirected. Renamed products redirect by stable listing ID to the latest descriptive URL.
- Product links are real anchors. Search filters remain optional client controls; results are not multiplied into indexable query-string pages.
- Shared cart, enquiry controls and contact dock work on new pages.

## Owner follow-up

1. Add the `samzcrafts.com` domain property in Google Search Console. Account access and the Google-issued DNS verification token are needed; neither is available in this repository. Publish only Google's exact verification token after authorizing that integration.
2. Submit https://samzcrafts.com/sitemap.xml and inspect the home, custom order, collection and sample product URLs. Sitemap availability does not itself mean it has been submitted or indexed.
3. Monitor indexing, real search queries, clicks and Core Web Vitals once enough data exists. Use Google's Rich Results Test for future priced listings; the current unpriced showcase is intentionally not represented as a purchasable Offer.
4. Add clear original product photos, accurate descriptions, dimensions, yarn/material details and confirmed prices through the studio. These fields update public pages and the sitemap automatically. Avoid private addresses, unsupported safety claims or copied competitor text.
5. Link the new domain from the Instagram and Facebook profiles. Consider a Google Business Profile only if the actual business meets Google's eligibility rules; do not invent a shopfront or publish a home address merely for SEO.

Search ranking and indexing are controlled by search engines; this implementation makes the content discoverable and understandable but does not guarantee rankings.

## Validation

`npm run build`, `npm run check`, `node --check deploy.mjs`, and `npm test`.
SEO regressions test initial HTML and links, published-only sitemap/404s, renamed URL redirects, aliases, custom/category content, private noindex, HEAD responses, escaped listing content, and truthful offer eligibility. Existing cart/order/stock/auth tests remain in place.
