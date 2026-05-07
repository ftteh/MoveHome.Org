# movehome.org

A free, not-for-profit property listing aggregator. Reference open-source consumer of the [RAIA Protocol](https://github.com/estateaigents/raia-protocol).

## What this repo is

- The Next.js app that powers [movehome.org](https://movehome.org).
- A reference implementation showing how any organisation can build a RAIA Protocol consumer.
- Read-only. Anonymous. No PII. No proprietary logic.

## What this repo is **not**

- Not the RAIA platform itself — that's a separate private commercial codebase.
- Not where listings are created or edited — listings flow in from the `raia-public` Supabase mirror, which is populated by the RAIA platform from agencies who federate via the Protocol.
- Not where credentials, AI, or business logic live.

## How it works

```
   ┌───────────────────────┐         ┌───────────────────────────┐
   │  RAIA platform        │ syncs   │  raia-public Supabase     │
   │  (private)            ├────────▶│  mirror (anon-readable)   │
   │  + federated agencies │         └───────────┬───────────────┘
   └───────────────────────┘                     │ anon key
                                                 │
                                ┌────────────────▼───────────────┐
                                │  movehome.org (this repo)      │
                                │  Next.js + Supabase client     │
                                └────────────────────────────────┘
```

## Run locally

```bash
cp .env.local.example .env.local
# Fill in the values for the raia-public Supabase project + Google Maps key
npm install
npm run dev
```

Open `http://localhost:3000`. With an empty mirror you'll see no listings — that's expected.

## Fork it

The whole point. Fork this repo, point it at any Supabase project that exposes a `tbl_listings` matching the RAIA Protocol [`schemas/listing.json`](https://github.com/estateaigents/raia-protocol/blob/main/schemas/listing.json), customise the UI, and you have your own RAIA aggregator. A council surfacing affordable housing, a charity surfacing supported living, a relocation firm — all valid consumers.

## License

[MIT](LICENSE).

## Maintainer

admin@movehome.org · [estateaigents](https://github.com/estateaigents)
