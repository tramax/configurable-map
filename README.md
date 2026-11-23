# Configurable Trees

To run the app:

```sh
> pnpm install
> pnpm run dev
```

Sign-in needs the API server and a seeded database (demo users: `alice` / `alice-demo`, `bob` / `bob-demo`, `carol` / `carol-demo`). In a second terminal:

```sh
> pnpm run db:seed
> pnpm run dev:server
```

`pnpm run dev` proxies `/api` to the server on port 3001.

This is a simple web mapping application that visualizes the open Landscape Trees data available on ArcGIS Online's Living Atlas (https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/Landscape_Trees/FeatureServer/0).

You can visit the link above to explore the feature service and its fields.

A function to configure the attribute table and visualization from a fixed data format has been provided in `configuration.ts`, along with the schema. A sample usage is found in `App.tsx`.

The map is rendered using the [ArcGIS Maps SDK for Javascript](https://developers.arcgis.com/javascript/latest/), using the `@arcgis/core` and `@arcgis/map-components` web components.

## Changes to the starter code

**Legend** (`configuration.ts`): the starter rendered the points with a `UniqueValueRenderer` that had no unique values. Its legend showed a meaningless "others" entry and never showed the size ramp, so it did not say which field drives color and which drives size. The renderer is now a `SimpleRenderer`, and each visual variable has a `legendOptions.title` (`Color: <field>` / `Size: <field>`), so the legend shows both ramps and what each represents. The visual variables themselves are unchanged.

Two small supporting edits to the starter files, needed so the symbology can be edited live:

- `configuration.ts`: `applySymbology(layer, symbolConfig)` was split out of `configure`, which still does both and keeps its signature.
- `App.tsx`: `configure` used to run inside the table's `ref` callback on every render, which would overwrite edits with the sample config; it now runs in effects.
