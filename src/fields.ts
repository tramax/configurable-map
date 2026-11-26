import type FeatureLayer from "@arcgis/core/layers/FeatureLayer";

/** Field types that are plumbing rather than data a user would want to see in the table. */
const SYSTEM_FIELD_TYPES = new Set(["oid", "global-id", "geometry", "blob", "raster", "xml"]);

/**
 * The names of the fields the attribute table may offer: every field except system fields
 * (object id, global id, geometry, ...) and editor-tracking fields. Unlike the symbology panel,
 * which is limited to numeric fields, the table shows text, dates, etc. too.
 */
export function getTableFieldNames(layer: FeatureLayer): string[] {
  const { creatorField, creationDateField, editorField, editDateField } = layer.editFieldsInfo ?? {};
  const tracking = new Set([creatorField, creationDateField, editorField, editDateField]);

  return layer.fields
    .filter((f) => !SYSTEM_FIELD_TYPES.has(f.type) && !tracking.has(f.name))
    .map((f) => f.name);
}
