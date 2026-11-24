import type FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import type { FieldOption } from "../types";

const NUMERIC_FIELD_TYPES = new Set([
  "small-integer",
  "integer",
  "long",
  "single",
  "double",
]);

/** Numeric, non-ID fields of a layer - the only ones a continuous color/size ramp makes sense for. */
export function getNumericFields(layer: FeatureLayer): FieldOption[] {
  return layer.fields
    .filter((field) => NUMERIC_FIELD_TYPES.has(field.type))
    .map((field) => ({ name: field.name, label: field.alias || field.name }));
}
