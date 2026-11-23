# Configurable Trees

A web mapping application that visualizes the open Landscape Trees data on ArcGIS Online's Living Atlas ([feature service](https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/Landscape_Trees/FeatureServer/0), open the link to explore its fields). Users can configure how the trees are drawn and which columns the attribute table shows, and signed-in users can save those configurations under a name and reopen them later.

## Contents

- [Solution overview](#solution-overview)
- [Architecture](#architecture)
- [Local setup](#local-setup)
- [API documentation](#api-documentation)
- [Assumptions and trade-offs](#assumptions-and-trade-offs)
- [Known limitations](#known-limitations)
- [Further improvements](#further-improvements)
- [AI usage disclosure](#ai-usage-disclosure)

## Solution overview

The map is rendered with the [ArcGIS Maps SDK for JavaScript](https://developers.arcgis.com/javascript/latest/) (`@arcgis/core` and the `@arcgis/map-components` web components). The page shows the map with a legend, and the layer's attribute table below it. Three buttons sit at the top right:

| Button                        | What it does                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------- |
| Account                       | Sign in or out.                                                                   |
| Symbology (palette)           | Edit how the points are drawn: color and/or size, each driven by a numeric field. |
| Saved configurations (folder) | Save the current configuration under a name, and open a saved one.                |

**Configuration.** A configuration is the _symbology_ (a color ramp and/or a size ramp, each tied to a field) plus the _table column list_ (which fields the table shows, in order). It is described by one schema, `src/configSchema.ts`, which the frontend and the backend share. A function to apply a configuration to the layer and table (`configure` in `src/configuration.ts`) and a sample configuration (`App.tsx`) came with the starter code. The sample configuration is now the default configuration, stored in the database (see below).

**Default configuration.** Each dataset has one predefined (`system`) configuration marked as its default. The app asks the API for it when it starts, before anyone signs in, and applies it to the map, legend, symbology panel and table. The layer is styled before it is added to the map, so the points are not drawn in the service's own style first. If there is no default or it cannot be fetched, the app still opens, with plain symbology and the table's own columns. The default also appears in the saved-configurations list, so a user can return to it.

**Symbology.** In the symbology panel the user turns color and size on or off, picks a numeric field for each, and chooses a color (any number of stops) or a size (smallest and largest) for the stops. The stops are spaced evenly across the field's data range, read from the layer, so the user never types stop values. Changes are applied to the map live, and Reset returns to the configuration the panel started from.

**Table columns.** Besides the configured columns, the table's own column menu can reveal every other selectable field of the layer, and reorder or hide columns.

**Saved configurations.** A signed-in user types a name and saves what is on screen. The configuration is stored through the backend API (see below) and appears in that user's list, from which it can be reopened at any time, including after a reload or on another browser. Opening one applies both parts: the symbology goes to the map, legend and symbology panel, and the column list goes to the table. The symbology comes from the app's current symbology state, and the columns are read from the live table at save time, so changes made in the table's column menu are included. Updating and deleting saved configurations is not part of the solution.

**Accounts.** There is no registration. Three demo users are created by the seed script, and each user only sees their own saved configurations, plus the predefined ones.

### Changes to the starter code

**Legend** (`configuration.ts`): the starter rendered the points with a `UniqueValueRenderer` that had no unique values. Its legend showed a meaningless "others" entry and never showed the size ramp, so it did not say which field drives color and which drives size. The renderer is now a `SimpleRenderer`, and each visual variable has a `legendOptions.title` (`Color: <field>` / `Size: <field>`), so the legend shows both ramps and what each represents. The visual variables themselves are unchanged.

**Attribute table columns** (`configuration.ts`, `fields.ts`): the starter built one `FieldColumnTemplate` per entry in `tableConfig.columns`, so the table's column menu could only ever offer those columns. The table configuration now also adds a hidden column for every other field of the layer (`getTableFieldNames` in `fields.ts`: all fields except system fields such as object id and global id, and editor-tracking fields). The columns shown on load and their order are unchanged: `tableConfig.columns` is still the initial visible set, in order.

Supporting edits, needed so that a configuration can be changed and reopened live:

- `configuration.ts`: `applySymbology(layer, symbolConfig)` and `applyTableConfig(layer, table, tableConfig)` were split out of `configure`, which still does both and keeps its signature. `getTableColumns` reads the columns the table currently shows.
- `App.tsx`: `configure` used to run inside the table's `ref` callback on every render, which would overwrite edits with the sample config. The hardcoded sample configuration is gone: the app now loads the default configuration from the API, applies its symbology when the layer is created, and its table columns in an effect. (`configure` is still exported with its signature unchanged, but the app no longer calls it.) The signed-in user also lives here (passed to `LoginMenu`), so the configurations menu can react to sign-in and sign-out.

## Architecture

```
Browser (React 19 + Vite)               Server (Hono on Node)             SQLite (drizzle-orm)
┌─────────────────────────────────┐    ┌───────────────────────────┐    ┌────────────────┐
│ App.tsx (owns user, symbology)  │    │ app.ts                    │    │ users          │
│  ├─ LoginMenu                   │    │  ├─ loadSession           │    │ sessions       │
│  ├─ SymbologyPanel              │───►│  ├─ /api/auth             │───►│ configurations │
│  ├─ ConfigurationsMenu          │    │  └─ /api/configurations   │    └────────────────┘
│  ├─ <arcgis-map> + legend       │    └───────────────────────────┘
│  └─ <arcgis-feature-table>      │         /api/* with session cookie
└─────────────────────────────────┘
        src/configSchema.ts is shared by both sides (types only)
```

**Frontend** (`src/`)

- `App.tsx` creates the feature layer, holds the signed-in user and the current symbology, and connects the pieces.
- `configuration.ts` turns a `Configuration` into an ArcGIS renderer and table template. It is the only place that knows how to apply one.
- `symbology/SymbologyPanel.tsx` is the editor. It keeps its own draft and reports a configuration only when it is valid, so the map never receives a half-edited one.
- `configurations/` holds the API client and the menu for saved configurations. `auth/` holds the equivalent for sign-in.
- UI controls are [Calcite](https://developers.arcgis.com/calcite-design-system/) components, matching the ArcGIS look.

**Backend** (`server/`), organised by feature module

- `app.ts` composes the app: the session middleware first, then one router per module under `/api`, then the generated API documentation. Adding a feature means adding `server/modules/<feature>/` and mounting its routes there.
- `modules/auth/` handles sign-in, sessions and password hashing. Passwords are hashed with scrypt. A session is a random token in an HttpOnly, `SameSite=Lax` cookie (`Secure` in production); only the token's SHA-256 hash is stored, and sessions last 7 days.
- `modules/configurations/` holds the configuration routes and their request and response schemas.
- `shared/openapi.ts` holds what every module uses to declare its routes: the router factory, the shared error response and the JSON-only guard.
- `shared/db/` holds the drizzle schema, migrations, the client and the seed script.

**Data model.** The `configurations` table stores the configuration as a JSON column next to its owner, dataset id, name and `visibility` (`system`, `private` or `public`). Constraints keep the combinations consistent, so the database cannot hold these states: a default that is not a `system` configuration, a `system` configuration with an owner (or an owned one without `system`), or two defaults for the same dataset (a partial unique index). `system` rows come from the seed script and `private` rows from the API; `public` is in the schema for the improvements listed below.

**Shared schema.** `src/configSchema.ts` defines a configuration once, as a [zod](https://zod.dev/) schema, and the `Configuration` type is derived from it. The server uses the schema to validate requests and to generate the API documentation. The frontend imports only the type, so zod is not part of the browser bundle, and the file has no ArcGIS imports, so the server never loads the SDK.

**Generated API documentation.** Each route is declared with `createRoute` ([`@hono/zod-openapi`](https://github.com/honojs/middleware/tree/main/packages/zod-openapi)): its method, path, request schemas and the responses it can give. That one declaration validates the request, types the handler, and produces the OpenAPI document, so the docs cannot drift from the code.

**Start, save and open flow.**

0. Start: `App` requests `GET /api/configurations/default` as soon as it mounts, in parallel with the map becoming ready. Once the layer has loaded and the default has arrived (or failed), the layer is styled with the default's symbology and only then added to the map; the symbology panel and the table are given the rest.
1. Save: the menu asks `App` for the current configuration (symbology state plus the table's visible columns), then `POST /api/configurations`. The server validates it, stores it as a private row owned by the session's user, and returns it.
2. Open: the menu lists `GET /api/configurations` once the user signs in. Picking one applies its table part to the table, and its symbology to the layer and, by remounting it with the new starting point, to the symbology panel.

## Local setup

Requirements: [Node.js](https://nodejs.org/) (developed on Node 26) and [pnpm](https://pnpm.io/). Only the map data needs internet access; the backend uses a local SQLite file.

```sh
> pnpm install
> pnpm run db:seed       # creates ./data/app.db, the demo users and the default configuration
> pnpm run dev:server    # API on http://localhost:3001
```

In a second terminal:

```sh
> pnpm run dev           # web app on http://localhost:5173
```

Open the URL Vite prints. The API documentation is at <http://localhost:3001/api/docs>. `pnpm run dev` proxies `/api` to the API server on port 3001, so the session cookie stays same-origin.

Demo users: `alice` / `alice-demo`, `bob` / `bob-demo`, `carol` / `carol-demo`. Re-running the seed resets their passwords but keeps their saved configurations. It also leaves an existing default configuration as it is, so edits made to it in the database survive; to restore the seeded one, delete its row (`id = 'default-landscape-trees'`) and seed again. An app started without the seed has no default and opens with plain symbology.

| Script                 | Purpose                                                                        |
| ---------------------- | ------------------------------------------------------------------------------ |
| `pnpm run dev`         | Vite dev server for the web app.                                               |
| `pnpm run dev:server`  | API server with auto-reload. Applies pending migrations on start.              |
| `pnpm run db:seed`     | Applies migrations, creates or resets the demo users, adds the default.        |
| `pnpm run db:generate` | Generates a migration after changing the schema in `server/shared/db/schema/`. |
| `pnpm run db:studio`   | Opens drizzle studio to browse the database.                                   |
| `pnpm run build`       | Typechecks the web app and builds it into `dist/`.                             |

Environment variables (all optional): `PORT` (default `3001`), `DB_PATH` (default `./data/app.db`), and `NODE_ENV=production`, which marks the session cookie `Secure`. To start from a clean database, delete the `data/` folder and seed again.

## API documentation

The API documentation is generated from the code, so it is always current. With the API server running (`pnpm run dev:server`):

- **Swagger UI:** <http://localhost:3001/api/docs>. Browse the endpoints and schemas, and try requests. Call `POST /api/auth/login` first; the browser then keeps the session cookie and the other requests are sent with it. (The Authorize button is not needed, because browsers do not let a page set a cookie by hand.)
- **OpenAPI document:** <http://localhost:3001/api/openapi.json>, for generating a client or importing into Postman.

At a glance (the generated documentation has the full schemas and every response):

| Endpoint                             | Purpose                                                               | Needs sign-in |
| ------------------------------------ | --------------------------------------------------------------------- | ------------- |
| `GET /api/auth/me`                   | The signed-in user.                                                   | yes           |
| `POST /api/auth/login`               | Sign in with `{ username, password }`; sets the session cookie.       | no            |
| `POST /api/auth/logout`              | Sign out; clears the cookie.                                          | no            |
| `GET /api/configurations/default?datasetId=` | The dataset's default configuration (`404` if it has none). | no            |
| `GET /api/configurations?datasetId=` | The configurations of a dataset that the user may open, newest first. | yes           |
| `POST /api/configurations`           | Save a new private configuration `{ datasetId, name, config }`.       | yes           |

Conventions that hold for every endpoint: JSON in and out; errors are `{ "error": "<message>" }`, where a request that fails validation gets `400` and a message naming the first problem (for example `config.symbolConfig.color.stops.0.color: Expected a #rrggbb color`); a body that is not JSON gets `415`; no session gets `401` (except on the endpoints marked "no" above).

### Adding an endpoint

1. Put it in the feature's module (`server/modules/<feature>/`), or create one and mount it in `app.ts`.
2. Describe the request and response bodies as zod schemas (import `z` from `@hono/zod-openapi`, and give reusable ones a name with `.openapi("Name")`).
3. Declare the route with `createRoute`, listing every response it can return. Add `security: [{ [COOKIE_AUTH]: [] }]` if it needs a session, and `middleware: [requireJson]` if it takes a body.
4. Register it on a router from `createRouter()` with `router.openapi(route, handler)`. The handler gets typed, already-validated input from `c.req.valid(...)`, and TypeScript checks that it only returns responses the route declares. In `configurations.routes.ts`, `requireAuth` is applied to every route registered after it, so a route is protected unless it is deliberately placed above that line (as the public default endpoint is).

It then appears in Swagger UI with no further documentation work.

## Assumptions and trade-offs

- **A configuration is only symbology and table columns.** That is what was asked for. Basemap, map extent, sorting, filters and column widths are not captured.
- **Server-side validation checks shape, not meaning.** The server does not know the layer's fields, so it cannot tell whether a saved field exists. The client copes with that when it opens one: unknown table columns are skipped. A saved symbology field that no longer exists is not handled the same way, so the symbology panel and renderer would still reference it.
- **zod and OpenAPI generation instead of hand-written validation and docs.** More endpoints are planned, and a hand-written spec drifts from the code. Declaring each route once gives validation, types and documentation from the same place. The cost is three dependencies (`zod`, `@hono/zod-openapi`, `@hono/swagger-ui`) and a stricter way of writing routes.
- **Evenly spaced stops.** Users pick colors and sizes, and the stop values are derived from the field's range. This makes editing simple and hard to get wrong. Users cannot place a stop at a chosen value. Size is limited to two stops.
- **Numeric fields only for symbology.** A continuous ramp only makes sense for numbers. The table can show any field.
- **SQLite and server-side sessions.** Easy to run locally with no external services, and sessions can be revoked. This ties the API to a single node. Cookie sessions fit a same-origin app; `SameSite=Lax` plus the JSON-only content type protect state-changing requests from cross-site forms, without a separate CSRF token.
- **No registration.** Accounts are seeded, to keep the focus on configurations.
- **One dataset.** Configurations are stored per dataset id, and the app uses a fixed `landscape-trees` id. The schema supports more.
- **The schema is ahead of the feature.** `visibility`, `isDefault` and `publishedAt` were in the table before there was a feature behind them, so that system defaults and sharing could be added without migrating saved data. The default configuration now uses `system` and `isDefault`; `public` and `publishedAt` are still unused.
- **Duplicate names are allowed.** Nothing was specified, and a unique name per user would have added an error path.
- **"1 default configuration" means one per dataset.** The requirement does not say whether the default is global or per dataset. Per dataset matches the unique index already in the schema (`ux_configurations_default`), and a configuration names fields of one particular layer, so a single global default could not fit two datasets.
- **The default is data, not code.** It is a `system` configuration with `isDefault = true`, created by the seed script, rather than a constant in the frontend. Changing it is a data change, a second dataset gets its own default without touching the frontend, and it appears in the saved-configurations list like any other system configuration. The cost is that the default depends on the seed having run: without it, the app uses the fallback below. The seed does not overwrite an existing default, so changes made in the database are kept; the price is that editing the default in `seed.ts` has no effect on a database that already has one.
- **The default must load before anyone signs in.** The first load is usually anonymous, so the endpoint that returns the default is public, and it only ever returns `system` rows. Everything else under `/api/configurations` still needs a session.
- **"Loaded when first started" means every fresh page load.** The app does not remember which configuration a user last had open, so a reload returns to the default. Remembering the last used configuration would be a separate feature.
- **The content of the default is our choice.** The task does not say what it contains, so it is the starter's sample configuration (color by `Leaf_Area`, size by `Leaf_Bmass`, and those two table columns). It is meant as a reasonable first view of the data, not as a recommendation.
- **If the default cannot be fetched, the app still works.** The layer is shown with plain symbology and the table's default columns, and the user can still configure it. The alternative, a hardcoded copy of the default as a safety net, would bring back the duplication this design removes.
- **Users cannot edit or delete the default.** It has no owner, there is no update or delete endpoint, and there is no admin UI. Changing it means changing the database (or the seed).
- **The map waits for the default.** The default has to arrive from the API before it can be applied, and the layer is added to the map only after it has. The alternative, adding the layer at once and restyling it when the default arrives, would draw the points in the service's own style for a moment. Waiting means the points appear a little later, by the time of one API request; the request gives up after 5 seconds, so a hung API delays the map by at most that long before the fallback is used. A hardcoded constant had no such delay.
- **Impossible states are ruled out by the database; a missing default is not.** The constraints on the table make it impossible to store a private default, or two defaults for one dataset (see "Data model"). SQL cannot require that a dataset *has* a default, so zero defaults is a state the app has to handle. It does: the endpoint answers `404`, and the frontend treats that, a server error and an unreachable server alike, by opening with the fallback above.
- **A stored default is checked before it is served.** The database stores the configuration as JSON it does not look inside, and a row that is seeded or edited by hand never went through the API's validation. The default endpoint therefore checks the stored JSON against the configuration schema and answers `500` (and logs it) if it does not fit, which the frontend again handles with the fallback. The check is on the server, not in the browser, so zod stays out of the frontend bundle. It checks shape only: a default that names a field the layer does not have passes (see "Server-side validation checks shape, not meaning").

## Known limitations

- Saved configurations cannot be renamed, updated or deleted, and the only configuration opened automatically on load is the dataset's default, not the user's last one.
- Duplicate names are allowed, so a user can create several entries that look the same in the list.
- The list is not paginated or searchable.
- Configurations cannot be shared: there is no UI to publish one. The default configuration can only be changed in the database or the seed; there is no admin UI.
- In development, React's strict mode mounts `App` twice, so the default is requested twice. This does not happen in a production build.
- Table column state is read from the live table when saving. Only visible columns and their order are saved, so column widths and sort order are not.
- There are no automated tests. The feature was checked by hand and with a throwaway browser script (see AI usage disclosure), neither of which is in the repository.
- `pnpm run build` produces a static build, but the API server does not serve it, so there is no single-process production deployment. The two have to be hosted together behind a proxy.
- The API documentation is served to everyone, signed in or not, and Swagger UI loads its scripts and styles from a public CDN, so it needs internet access. It is meant for development; in production it would be turned off or put behind sign-in.
- No rate limiting or lockout on sign-in, and sessions are not listed or revoked on password change.
- The legend and the symbology panel assume a point layer with numeric fields.
- While a symbology edit is invalid (for example an empty size), the panel shows an error and the map keeps the last valid symbology. Saving at that moment saves that last valid symbology, not the half-finished edit.

## Further improvements

- Rename, update and delete for a user's own configurations, with a unique name per user and dataset.
- An option to publish a private configuration (`visibility` and `publishedAt` are already in the schema), and a way to manage the default and other system configurations without editing the database.
- Open the user's last used configuration on load, instead of always the default.
- Save more of the view: sort order, column widths, filters, basemap and extent.
- Validate saved fields against the layer when opening, and tell the user which parts could not be applied.
- Automated tests: unit tests for the configuration schema and the stop and draft helpers, API tests against an in-memory database (`createDb(":memory:")` already supports this), and a browser test for the save and open flow.
- Generate a typed API client for the frontend from the OpenAPI document, replacing the hand-written `fetch` calls in `src/auth/api.ts` and `src/configurations/api.ts`.
- Serve the built frontend from the API server, add a container image, and move to a managed database if more than one server is needed.
- Sign-in hardening: rate limiting, and invalidating other sessions on password change.

## AI usage disclosure

AI coding assistants were used on this project. This section describes the **saved configurations feature**: the backend module (`server/modules/configurations/`), the client (`src/configurations/`), the supporting changes in `App.tsx`, `LoginMenu.tsx` and `configuration.ts`, the move of the auth and configuration routes to generated OpenAPI documentation (`server/shared/openapi.ts`, the route and schema files, `src/configSchema.ts`), and this README were written by Claude Code (Claude Sonnet 5.5) from the task description, working in the existing codebase. It was checked by typechecking both the client and the server, by calling the API directly (unauthenticated, cross-user visibility, invalid names, colors, sizes and duplicate columns, a non-JSON body and malformed JSON, again after the move to generated documentation), by driving the real app in a headless browser (save, reload, reopen, and switching between configurations; that run was made before the documentation change), and by loading the generated Swagger UI in a headless browser. The throwaway scripts used for that were kept outside the repository.

The **default configuration** (the seed, the public `GET /api/configurations/default` endpoint, and loading it in `App.tsx`) was added the same way, after a design discussion that settled the assumptions listed above. It was checked by typechecking both sides, by seeding twice (the second run keeps the row), by calling the endpoint with and without a session and with a missing or unknown dataset, by trying to insert the states the constraints should reject (all rejected) and a default for a second dataset (allowed), by corrupting the stored default (the endpoint answered `500`), and by loading the app in headless Edge twice: once with the default available (the layer already had its size and color ramps when it joined the map, and the table showed exactly the two configured columns) and once with the request blocked (plain symbology and the table's own columns). The throwaway scripts were kept outside the repository.

AI output is a draft, not a source of truth: the code and the behavior described here should be reviewed like any other contribution.
