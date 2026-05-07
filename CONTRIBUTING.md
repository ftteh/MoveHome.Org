# Contributing

movehome.org is the reference open-source consumer of the RAIA Protocol. Pull requests welcome.

## Scope

This repo is intentionally small. It only contains:

- Next.js consumer-facing UI
- Read-only Supabase queries (anon key, no auth, no writes)
- Type definitions matching the RAIA Protocol `listing.json` schema

If your change introduces auth, write paths, secret keys, or business logic — it's in the wrong repo.

## Local development

```bash
cp .env.local.example .env.local
npm install
npm run dev
npm run typecheck
```

## Pull requests

- One concern per PR
- Run `npm run typecheck` before pushing
- Reference the RAIA Protocol schema version your change targets

## Reporting issues

GitHub issues for bugs and feature requests. For protocol-level concerns (changes to the listing schema), open an issue on [estateaigents/raia-protocol](https://github.com/estateaigents/raia-protocol).
