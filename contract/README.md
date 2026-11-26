# contract

Code that both the web app (`src/`) and the API (`server/`) depend on: the shapes of what crosses the wire. Import it with the `@contract/*` alias.

## What belongs here

- zod schemas and the types inferred from them
- constants that both sides must agree on (limits, allowed values)

## Rules

1. **Contracts, not behaviour.** No queries, no ArcGIS or React code, nothing that needs a browser or a server to run.
2. **Dependencies point one way.** `src/` and `server/` import from here; this folder imports from neither. Besides `zod`, it should need no other package.
3. **Keep changes backward compatible.** An older cached web app can meet a newer API, and saved rows keep their old shape. Add optional fields; for a breaking change add a `version` (see the notes in `configuration.schema.ts`).
4. **Don't make it a catch-all.** If only one side uses something, it belongs on that side.

The web app imports only types from here, so `zod` is not bundled into the browser.
