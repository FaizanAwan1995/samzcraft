# Production deployment

The `main` branch of `FaizanAwan1995/samzcraft` is connected to the existing Cloudflare Worker `samz-crafts`.

The Cloudflare Workers and Pages GitHub app is authorized for this repository. Its repository selection was saved without removing the existing SAKAN Lodge repository.

Build: `npm run build && npm run check && npm test`

Deploy: `npx --yes wrangler@4.152.0 deploy --keep-vars`

Node.js: 24. Runtime admin addresses and email credentials belong in private Worker secrets. Existing D1 data and settings are preserved by source deployments; seed data is never automatically re-imported.

The cart supports quote requests for unpriced products. Actual price/stock approval and an outbound email provider remain separate launch requirements.
