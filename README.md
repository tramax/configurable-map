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

| Button | What it does |
| --- | --- |
| Account | Sign in or out. |
| Symbology (palette) | Edit how the points are drawn: color and/or size, each driven by a numeric field. |
| Saved configurations (folder) | Save the current configuration under a name, and open a saved one. |

**Configuration.** A configuration is the *symbology* (a color ramp and/or a size ramp, each tied to a field) plus the *table column list* (which fields the table shows, in order). It is described by one schema, `src/configSchema.ts`, which the frontend and the backend share. A function to apply a configuration to the layer and table (`configure` in `src/configuration.ts`) and a sample configuration (`App.tsx`) came with the starter code.

**Symbology.** In the symbology panel the user turns color and size on or off, picks a numeric field for each, and chooses a color (any number of stops) or a size (smallest and largest) for the stops. The stops are spaced evenly across the field's data range, read from the layer, so the user never types stop values. Changes are applied to the map live, and Reset returns to the configuration the panel started from.

**Table columns.** Besides the configured columns, the table's own column menu can reveal every other selectable field of the layer, and reorder or hide columns.

**Saved configurations.** A signed-in user types a name and saves what is on screen. The configuration is stored through the backend API (see below) and appears in that user's list, from which it can be reopened at any time, including after a reload or on another browser. Opening one applies both parts: the symbology goes to the map, legend and symbology panel, and the column list goes to the table. The symbology comes from the app's current symbology state, and the columns are read from the live table at save time, so changes made in the table's column menu are included. Updating and deleting saved configurations is not part of the solution.

**Accounts.** There is no registration. Three demo users are created by the seed script, and each user only sees their own saved configurations.

### Changes to the starter code

**Legend** (`configuration.ts`): the starter rendered the points with a `UniqueValueRenderer` that had no unique values. Its legend showed a meaningless "others" entry and never showed the size ramp, so it did not say which field drives color and which drives size. The renderer is now a `SimpleRenderer`, and each visual variable has a `legendOptions.title` (`Color: <field>` / `Size: <field>`), so the legend shows both ramps and what each represents. The visual variables themselves are unchanged.

**Attribute table columns** (`configuration.ts`, `fields.ts`): the starter built one `FieldColumnTemplate` per entry in `tableConfig.columns`, so the table's column menu could only ever offer those columns. The table configuration now also adds a hidden column for every other field of the layer (`getTableFieldNames` in `fields.ts`: all fields except system fields such as object id and global id, and editor-tracking fields). The columns shown on load and their order are unchanged: `tableConfig.columns` is still the initial visible set, in order.

Supporting edits, needed so that a configuration can be changed and reopened live:

- `configuration.ts`: `applySymbology(layer, symbolConfig)` and `applyTableConfig(layer, table, tableConfig)` were split out of `configure`, which still does both and keeps its signature. `getTableColumns` reads the columns the table currently shows.
- `App.tsx`: `configure` used to run inside the table's `ref` callback on every render, which would overwrite edits with the sample config; it now runs in effects. The signed-in user also lives here (passed to `LoginMenu`), so the configurations menu can react to sign-in and sign-out.

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

- `app.ts` composes the app: the session middleware first, then one router per module under `/api`. Adding a feature means adding `server/modules/<feature>/` and mounting its routes there.
- `modules/auth/` handles sign-in, sessions and password hashing. Passwords are hashed with scrypt. A session is a random token in an HttpOnly, `SameSite=Lax` cookie (`Secure` in production); only the token's SHA-256 hash is stored, and sessions last 7 days.
- `modules/configurations/` holds the configuration routes and `validate.ts`, which checks incoming configurations.
- `shared/db/` holds the drizzle schema, migrations, the client and the seed script.

**Data model.** The `configurations` table stores the configuration as a JSON column next to its owner, dataset id, name and `visibility` (`system`, `private` or `public`). Check constraints keep the combinations consistent (for example, only system configurations have no owner, and only they can be the default). Today only `private` rows are created; the other values are in the schema for the improvements listed below.

**Shared schema.** `src/configSchema.ts` is imported as a type only by the server, so the server never loads the ArcGIS SDK. At runtime the server validates with its own function, not the type.

**Save and open flow.**

1. Save: the menu asks `App` for the current configuration (symbology state plus the table's visible columns), then `POST /api/configurations`. The server validates it, stores it as a private row owned by the session's user, and returns it.
2. Open: the menu lists `GET /api/configurations` once the user signs in. Picking one applies its table part to the table, and its symbology to the layer and, by remounting it with the new starting point, to the symbology panel.

## Local setup

Requirements: [Node.js](https://nodejs.org/) (developed on Node 26) and [pnpm](https://pnpm.io/). Only the map data needs internet access; the backend uses a local SQLite file.

```sh
> pnpm install
> pnpm run db:seed       # creates ./data/app.db and the demo users
> pnpm run dev:server    # API on http://localhost:3001
```

In a second terminal:

```sh
> pnpm run dev           # web app on http://localhost:5173
```

Open the URL Vite prints. `pnpm run dev` proxies `/api` to the API server on port 3001, so the session cookie stays same-origin.

Demo users: `alice` / `alice-demo`, `bob` / `bob-demo`, `carol` / `carol-demo`. Re-running the seed resets their passwords but keeps their saved configurations.

| Script | Purpose |
| --- | --- |
| `pnpm run dev` | Vite dev server for the web app. |
| `pnpm run dev:server` | API server with auto-reload. Applies pending migrations on start. |
| `pnpm run db:seed` | Applies migrations and creates or resets the demo users. |
| `pnpm run db:generate` | Generates a migration after changing the schema in `server/shared/db/schema/`. |
| `pnpm run db:studio` | Opens drizzle studio to browse the database. |
| `pnpm run build` | Typechecks the web app and builds it into `dist/`. |

Environment variables (all optional): `PORT` (default `3001`), `DB_PATH` (default `./data/app.db`), and `NODE_ENV=production`, which marks the session cookie `Secure`. To start from a clean database, delete the `data/` folder and seed again.

## API documentation

All endpoints are under `/api`, send and receive JSON, and report errors as `{ "error": "<message>" }`. Authentication is by the `session` cookie set at login; there is no token to handle in the client. Requests with a body must send `Content-Type: application/json`, otherwise the server answers `415`.

### Auth

| Method and path | Body | Success | Errors |
| --- | --- | --- | --- |
| `GET /api/auth/me` | | `200` `{ id, username }` | `401` not signed in |
| `POST /api/auth/login` | `{ username, password }` | `200` `{ id, username }`, sets the cookie | `400` missing field, `401` wrong credentials, `415` not JSON |
| `POST /api/auth/logout` | | `204`, clears the cookie | |

### Configurations

All configuration endpoints require a session (`401` otherwise).

**`GET /api/configurations?datasetId=<id>`** lists the configurations of a dataset that the user may open: system and published ones, and their own. Newest first. `400` if `datasetId` is missing.

```json
[
  {
    "id": "64f71eac-a087-499b-988d-cdc7162ea9b7",
    "datasetId": "landscape-trees",
    "name": "Tall trees",
    "visibility": "private",
    "isDefault": false,
    "createdAt": "2026-11-23T02:33:50.529Z",
    "config": { "symbolConfig": { }, "tableConfig": { } }
  }
]
```

**`POST /api/configurations`** saves a new private configuration for the signed-in user and returns it with `201`. `400` carries the reason the body was rejected.

```json
{
  "datasetId": "landscape-trees",
  "name": "Tall trees",
  "config": {
    "symbolConfig": {
      "color": { "field": "Height", "stops": [
        { "value": 0, "color": "#ff0000" }, { "value": 100, "color": "#0000ff" } ] },
      "size":  { "field": "Height", "stops": [
        { "value": 0, "size": 8 }, { "value": 100, "size": 30 } ] }
    },
    "tableConfig": { "columns": ["Height", "Leaf_Area", "Sci_Name"] }
  }
}
```

Validation rules (`server/modules/configurations/validate.ts`):

- `name`: 1 to 100 characters after trimming. `datasetId`: 1 to 100 characters.
- `symbolConfig.color` and `symbolConfig.size` are each optional. When present: a `field` name and 2 to 20 stops. Each stop has a finite `value`, plus a `#rrggbb` `color` or a `size` above 0.
- `tableConfig.columns`: 1 to 500 unique, non-empty field names.
- Unknown keys are dropped, not stored.

## Assumptions and trade-offs

- **A configuration is only symbology and table columns.** That is what was asked for. Basemap, map extent, sorting, filters and column widths are not captured.
- **Server-side validation checks shape, not meaning.** The server does not know the layer's fields, so it cannot tell whether a saved field exists. The client copes with that when it opens one: unknown table columns are skipped. A saved symbology field that no longer exists is not handled the same way, so the symbology panel and renderer would still reference it.
- **Hand-written validator instead of a schema library.** The configuration is small, and this avoided a new dependency. The cost is that `configSchema.ts` and `validate.ts` must be kept in step by hand.
- **Evenly spaced stops.** Users pick colors and sizes, and the stop values are derived from the field's range. This makes editing simple and hard to get wrong. Users cannot place a stop at a chosen value. Size is limited to two stops.
- **Numeric fields only for symbology.** A continuous ramp only makes sense for numbers. The table can show any field.
- **SQLite and server-side sessions.** Easy to run locally with no external services, and sessions can be revoked. This ties the API to a single node. Cookie sessions fit a same-origin app; `SameSite=Lax` plus the JSON-only content type protect state-changing requests from cross-site forms, without a separate CSRF token.
- **No registration.** Accounts are seeded, to keep the focus on configurations.
- **One dataset.** Configurations are stored per dataset id, and the app uses a fixed `landscape-trees` id. The schema supports more.
- **The schema is ahead of the feature.** `visibility`, `isDefault` and `publishedAt` already exist in the table so that system defaults and sharing can be added without a migration of the saved data. They are unused for now.
- **Duplicate names are allowed.** Nothing was specified, and a unique name per user would have added an error path.

## Known limitations

- Saved configurations cannot be renamed, updated or deleted, and there is no way to open a configuration automatically on load.
- Duplicate names are allowed, so a user can create several entries that look the same in the list.
- The list is not paginated or searchable.
- Configurations cannot be shared: there is no UI to publish one, and no system default.
- Table column state is read from the live table when saving. Only visible columns and their order are saved, so column widths and sort order are not.
- There are no automated tests. The feature was checked by hand and with a throwaway browser script (see AI usage disclosure), neither of which is in the repository.
- `pnpm run build` produces a static build, but the API server does not serve it, so there is no single-process production deployment. The two have to be hosted together behind a proxy.
- No rate limiting or lockout on sign-in, and sessions are not listed or revoked on password change.
- The legend and the symbology panel assume a point layer with numeric fields.
- While a symbology edit is invalid (for example an empty size), the panel shows an error and the map keeps the last valid symbology. Saving at that moment saves that last valid symbology, not the half-finished edit.

## Further improvements

- Rename, update and delete for a user's own configurations, with a unique name per user and dataset.
- A system default configuration per dataset, opened on load, and an option to publish a private configuration (`visibility` and `publishedAt` are already in the schema).
- Save more of the view: sort order, column widths, filters, basemap and extent.
- Validate saved fields against the layer when opening, and tell the user which parts could not be applied.
- Automated tests: unit tests for `validate.ts` and the stop and draft helpers, API tests against an in-memory database (`createDb(":memory:")` already supports this), and a browser test for the save and open flow.
- Share one validation definition between client and server (for example a schema library that also gives the types), so they cannot drift.
- Serve the built frontend from the API server, add a container image, and move to a managed database if more than one server is needed.
- Sign-in hardening: rate limiting, and invalidating other sessions on password change.

## AI usage disclosure

AI coding assistants were used on this project. This section describes the **saved configurations feature**: the backend module (`server/modules/configurations/`), the client (`src/configurations/`), the supporting changes in `App.tsx`, `LoginMenu.tsx` and `configuration.ts`, and this README were written by Claude Code (Claude Sonnet 5.5) from the task description, working in the existing codebase. It was checked by typechecking both the client and the server, by calling the API directly (unauthenticated, cross-user visibility, invalid names, colors, sizes and duplicate columns, and a non-JSON body), and by driving the real app in a headless browser: save, reload, reopen, and switching between configurations. The throwaway scripts used for that were kept outside the repository.

AI output is a draft, not a source of truth: the code and the behavior described here should be reviewed like any other contribution.
