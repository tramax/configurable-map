# Configurable Trees

A map of the open [Landscape Trees](https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/Landscape_Trees/FeatureServer/0) dataset where the way it is displayed is a **saved configuration** served by a backend API: how the points are drawn on the map, and which columns the attribute table shows, in which order. Users start from a default, make their own, save them, reopen them later and share them with other users.

**Stack:** React 19 + Vite + ArcGIS Maps SDK (frontend), Hono + zod + OpenAPI (backend), SQLite via drizzle (storage).

## Solution overview

| Requirement              | How it is met                                                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Symbology                | A panel sets point **colour and/or size** from a numeric field. Stops are spread evenly over the field's range, and changes show on the map immediately.                         |
| Attribute display        | The configuration holds the **ordered list of visible columns**. The table's own column menu shows, hides and reorders; what is on screen is what gets saved.                    |
| Predefined configuration | One **default** configuration per dataset is stored in the database and applied on first load, before sign-in. If it cannot be fetched the app still opens with plain symbology. |
| Custom configurations    | A signed-in user names and saves what is on screen (`POST /api/configurations`) and reopens it from the folder menu. Update/delete are out of scope.                             |
| Sharing                  | The owner flips a **Public** switch (`publish` / `unpublish`). Published configurations appear for every signed-in user under "Shared by others", with the author's name.        |

Accounts are seeded demo users (no registration).

## Architecture

**[System architecture diagram](docs/architecture.md)**: web app, REST API, SQLite and the ArcGIS feature service, with every interaction labelled.

- **One shared schema.** `contract/configuration.schema.ts` (zod) defines a configuration once. The server validates requests with it and generates the API docs from it; the frontend imports only its types. The `contract/` folder is the one place for code both sides depend on; its [README](contract/README.md) says what may go in it.
- **Backend by feature module** (`server/modules/auth`, `server/modules/configurations`). Each route is declared once with `@hono/zod-openapi`, which gives validation, typed handlers and the OpenAPI document, so the docs cannot drift from the code. Every module has the same layout: `*.schemas.ts` (what the API accepts and returns), `*.openapi.ts` (route declarations), `*.service.ts` (logic and queries, no HTTP types) and `*.routes.ts` (thin handlers).
- **Auth.** Passwords are hashed with scrypt. A session is a random token in an HttpOnly, `SameSite=Lax` cookie; only its SHA-256 is stored.
- **Data model.** One `configurations` table: owner, dataset id, name, `visibility` (`system` / `private` / `public`) and the configuration as a JSON column. Database constraints rule out impossible states (a private default, two defaults for one dataset, a public row without a publish date).
- **Sharing is safe by construction.** Publish and unpublish are a single `UPDATE ... WHERE id = ? AND owner_id = ?`, and someone else's id answers `404`, so private ids cannot be probed.

### Changes to the starter code

- `configuration.ts` is renamed `applyConfiguration.ts`: it applies a configuration to the map and table, and the old name was easy to confuse with the `configurations/` folder (saved configurations). It no longer re-exports the `Configuration`, `SizeStop` and `ColorStop` types; import them from `@contract/configuration.schema`. In the same file, the renderer is now a `SimpleRenderer` so the legend shows the colour and size ramps and the field behind each. `applySymbology` and `applyTableConfig` were split out of `configure` (which keeps its signature). The table also gets a hidden column for every other field, so the column menu can reveal them.
- `configSchema.ts` moved from `src/` to `contract/configuration.schema.ts`, because the server uses it too and should not import from the frontend's folder. The `@contract` path alias is set in `tsconfig.json`, `server/tsconfig.json`, `vite.config.ts` and `vitest.config.ts`.
- `App.tsx`: the hardcoded sample configuration is gone. The app loads the default from the API and applies it before the layer joins the map, so the points are never drawn in the service's own style first.

## Local setup

Requires Node.js and [pnpm](https://pnpm.io/); only the map data needs internet.

```sh
pnpm install
pnpm run db:seed       # creates ./data/app.db, demo users and the default configuration
pnpm run dev:server    # API on http://localhost:3001
pnpm run dev           # in a second terminal: web app on http://localhost:5173
```

Demo users: `alice` / `alice-demo`, `bob` / `bob-demo`, `carol` / `carol-demo`. Without the seed there is no default, and the app opens with plain symbology.

Tests (backend, plus unit tests of the map logic; no server or seed needed): `pnpm test`.

## API documentation

Generated from the code. With the API running: **Swagger UI** at <http://localhost:3001/api/docs> (call `POST /api/auth/login` first; the browser keeps the cookie) and the **OpenAPI JSON** at <http://localhost:3001/api/openapi.json>.

| Endpoint                                              | Purpose                                 | Sign-in |
| ----------------------------------------------------- | --------------------------------------- | ------- |
| `POST /api/auth/login`, `POST /api/auth/logout`       | Start / end a session                   | no      |
| `GET /api/auth/me`                                    | The signed-in user                      | yes     |
| `GET /api/configurations/default?datasetId=`          | The dataset's default configuration     | no      |
| `GET /api/configurations?datasetId=`                  | Everything the user may open            | yes     |
| `POST /api/configurations`                            | Save a new private configuration        | yes     |
| `POST /api/configurations/{id}/publish` / `unpublish` | Share / stop sharing the user's own one | yes     |

Errors are `{ "error": "<message>" }`: `400` invalid input, `401` not signed in, `404` not found or not yours, `415` body not JSON.

## Assumptions and trade-offs

- **Sharing = publish to all signed-in users.** Chosen over per-link or per-user sharing: it fits the schema, needs no user picker (there is no user directory), and makes shared items easy to find. Cost: it is all-or-nothing, and there is no moderation.
- **A configuration is only symbology and table columns.** Basemap, extent, sort and filters are not captured.
- **One default per dataset, stored as data, not code.** Changing it is a data change and a second dataset needs no frontend change. Cost: it depends on the seed having run, hence the fallback to plain symbology.
- **Server validation checks shape, not meaning.** The server does not know the layer's fields. Unknown table columns are skipped on open; an unknown symbology field is not handled yet.
- **SQLite and cookie sessions.** Zero setup, and sessions can be revoked. Cost: a single API node. `SameSite=Lax` plus JSON-only bodies protect against cross-site forms without a CSRF token.
- **Numeric fields only for symbology, two size stops, evenly spaced stops.** Simple and hard to get wrong; users cannot place a stop at a chosen value.
- **One dataset.** The id is a constant (`DATASET_ID` in `App.tsx`); the schema and API already support more.
- **Duplicate names are allowed and every page load starts from the default**, not the user's last configuration.

## Known limitations

- Saved configurations cannot be renamed, updated or deleted; the shared list has no search or pagination.
- The default can only be changed in the database or the seed (no admin UI).
- Column widths and sort order are not saved.
- Automated tests cover the configuration schema, the API, and `applySymbology` / `applyTableConfig` (against a stubbed layer and table). The rest of the frontend (map, table, panels, menus) has no automated tests and was checked by hand.
- The API does not serve the built frontend, so there is no single-process production deployment. Swagger UI loads from a CDN and is open to everyone.
- No rate limiting on sign-in.
- In development, React strict mode requests the default twice.

## Further improvements

- Rename, update and delete, with unique names per user.
- Finer sharing (named users, groups, links) and a way to manage predefined configurations.
- Open the user's last configuration on load; save more of the view (sort, widths, filters, basemap, extent).
- Tell the user when the current configuration differs from the last saved one (unsaved changes), so they know they can save it.
- Check saved fields against the layer when opening and tell the user what could not be applied.
- More tests: a browser test of save and open.

Extension points are also noted in comments in `contract/configuration.schema.ts`, `server/shared/db/schema/configurations.ts` and `server/modules/configurations/configurations.routes.ts`.

## AI usage disclosure

- **Tool:** Claude Code (Claude Sonnet 5.5).
- **Used for:** writing most of the saved-configurations feature (backend module, API client, menu, OpenAPI setup), the default configuration, sharing, the architecture diagram, the code comments and this README, working in the existing codebase from the task description. The menu layout and behaviour (grouping, the "Public" switch) were shaped by my instructions over several sessions.
- **Accepted:** SQLite instead of Postgres. It needs no external service, and nothing in scope needs Postgres's scalability.
- **Rejected / changed:** the assistant suggested each browser generate a UUID to own its configurations. I decided the requirements (a user's saved configurations, reopened later and published to others) need real users, so there is a `users` table, sessions and sign-in.
- **Verification:**
  - **Automated tests, written by the assistant (`pnpm test`, Vitest):** 20 tests run the real Hono app against an in-memory SQLite database with the real migrations. They cover the schema's accept/reject rules, the public default (including 404 and a corrupt stored default giving 500), sign-in required, saving and listing, validation errors (400/415), and sharing: private configurations stay hidden, a published one shows its author to others and disappears on unpublish, another user's id gets 404 and nothing changes. A further 8 unit tests (`src/applyConfiguration.test.ts`) run `applySymbology` and `applyTableConfig` against a stubbed layer and table: the visual variables and legend titles, column order and visibility, system fields never offered, and columns for fields the layer no longer has being skipped.
  - **Mutation check, run by the assistant:** it temporarily removed the owner check from the publish `UPDATE` and confirmed the sharing tests fail, then restored it. This shows the tests can catch a broken ownership rule.
  - **Manual testing of the frontend, done by me:** the map, table and panels have no automated tests (only the apply functions above do), so I checked every user flow in the browser against the requirements: the default loading on first start, changing point colour and size, showing, hiding and reordering table columns, signing in, saving a named configuration and reopening it, publishing, and opening a shared configuration as another user.
