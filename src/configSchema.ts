/**
 * The configuration schema, shared by the frontend and the backend.
 * Keep this file free of browser and ArcGIS imports so the server can import it.
 *
 * It is the single definition of a configuration: the backend validates requests with it and
 * generates the API documentation from it, and the `Configuration` type is derived from it. The
 * frontend only imports the types, so zod itself is never bundled into the browser.
 */
import { z } from "zod";

const MAX_STOPS = 20;
const MAX_COLUMNS = 500;

const fieldName = z.string().min(1).max(200).describe("Name of a field of the layer");

export const sizeStopSchema = z.object({
  value: z.number().describe("Field value this stop applies to"),
  size: z.number().positive().describe("Symbol size in pixels"),
});

export const colorStopSchema = z.object({
  value: z.number().describe("Field value this stop applies to"),
  // The symbology editor only produces #rrggbb, and the panel parses exactly that.
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a #rrggbb color").describe("Hex color, #rrggbb"),
});

/** A visual channel: a field and the stops that map its values to a size or color. */
const channel = <S extends z.ZodType>(stop: S) =>
  z.object({
    field: fieldName,
    stops: z.array(stop).min(2).max(MAX_STOPS),
  });

/*
 * HOW TO EXTEND THE CONFIGURATION
 *  - A new symbology channel (e.g. `rotation`, `opacity`, `outline`): add an optional entry under
 *    `symbolConfig` using `channel(...)` with its own stop schema, then map it to an ArcGIS visual
 *    variable in `applySymbology` (src/configuration.ts) and add a section to the SymbologyPanel.
 *    Existing saved configurations stay valid because the new entry is optional.
 *  - A new table setting (column widths, sort order): add an optional entry under `tableConfig`
 *    and apply it in `applyTableConfig`; read it back where `getTableColumns` is used on save.
 *  - New map-level settings (basemap, extent, filters): add a sibling of `symbolConfig` / `tableConfig`.
 *  - A breaking change to the shape: add a `version` field here and migrate old rows on read
 *    (the database stores the configuration as an opaque JSON column, so no SQL migration is needed
 *    for additive changes).
 */
export const configurationSchema = z
  .object({
    symbolConfig: z.object({
      size: channel(sizeStopSchema).optional().describe("Size of the points by a numeric field"),
      color: channel(colorStopSchema).optional().describe("Color of the points by a numeric field"),
    }),
    tableConfig: z.object({
      columns: z
        .array(fieldName)
        .min(1)
        .max(MAX_COLUMNS)
        .refine((names) => new Set(names).size === names.length, "Columns must be unique")
        .describe("Fields shown in the attribute table, left to right"),
    }),
  })
  .describe("How the points are drawn and which columns the table shows");

export type SizeStop = z.infer<typeof sizeStopSchema>;
export type ColorStop = z.infer<typeof colorStopSchema>;
export type Configuration = z.infer<typeof configurationSchema>;
