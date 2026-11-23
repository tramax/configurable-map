import Collection from "@arcgis/core/core/Collection";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import type { ColorVariableProperties } from "@arcgis/core/renderers/visualVariables/ColorVariable";
import type { SizeVariableProperties } from "@arcgis/core/renderers/visualVariables/SizeVariable";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import FieldColumnTemplate from "@arcgis/core/widgets/FeatureTable/support/FieldColumnTemplate";
import TableTemplate from "@arcgis/core/widgets/FeatureTable/support/TableTemplate";

import type { Configuration } from "./configSchema";
import { getTableFieldNames } from "./fields";

// The schema lives in configSchema.ts so the backend can share it; re-exported for existing imports.
export type { Configuration, SizeStop, ColorStop } from "./configSchema";

/** Applies only the symbology part of a configuration, leaving the table untouched. */
export const applySymbology = (
  layer: FeatureLayer,
  symbolConfig: Configuration["symbolConfig"],
) => {
  // The legend titles say which visual channel each field drives, e.g. "Color: Leaf Area".
  const fieldLabel = (name: string) => layer.fields?.find((f) => f.name === name)?.alias || name;

  const visualVariables: Array<
    (SizeVariableProperties & { type: "size" }) | (ColorVariableProperties & { type: "color" })
  > = [];
  if (symbolConfig.size) {
    visualVariables.push({
      type: "size",
      field: symbolConfig.size.field,
      stops: symbolConfig.size.stops,
      legendOptions: { title: `Size: ${fieldLabel(symbolConfig.size.field)}` },
    });
  }
  if (symbolConfig.color) {
    visualVariables.push({
      type: "color",
      field: symbolConfig.color.field,
      stops: symbolConfig.color.stops,
      legendOptions: { title: `Color: ${fieldLabel(symbolConfig.color.field)}` },
    });
  }

  // A SimpleRenderer: every tree shares one base symbol and the visual variables vary it. (A
  // UniqueValueRenderer with no values added a meaningless "others" entry to the legend.)
  const renderer = new SimpleRenderer({
    symbol: new SimpleMarkerSymbol({
      color: "#2b8a3e",
      size: 6,
      outline: { color: "white", width: 0.5 },
    }),
    visualVariables,
  });
  layer.renderer = renderer;
};

/**
 * Applies only the table part of a configuration. The configured columns come first, in config
 * order, and are visible; every other selectable field gets a hidden column so the table's own
 * column menu can still reveal it. Columns naming a field the layer no longer has are skipped.
 */
export const applyTableConfig = (
  layer: FeatureLayer,
  table: HTMLArcgisFeatureTableElement,
  tableConfig: Configuration["tableConfig"],
) => {
  const available = getTableFieldNames(layer);
  const columns = tableConfig.columns.filter((name) => available.includes(name));
  const shown = new Set(columns);
  const hiddenColumns = available.filter((name) => !shown.has(name));
  table.tableTemplate = new TableTemplate({
    columnTemplates: [
      ...columns.map((fieldName) => new FieldColumnTemplate({ fieldName, visible: true })),
      ...hiddenColumns.map((fieldName) => new FieldColumnTemplate({ fieldName, visible: false })),
    ],
  });
  table.hiddenFields = new Collection<string>();
};

/** The fields the table currently shows, left to right - including edits made in its column menu. */
export const getTableColumns = (
  layer: FeatureLayer,
  table: HTMLArcgisFeatureTableElement,
): string[] => {
  const available = new Set(getTableFieldNames(layer));
  return table.visibleColumns.map((c) => c.fieldName).filter((name) => available.has(name));
};

export const configure = (
  layer: FeatureLayer,
  table: HTMLArcgisFeatureTableElement,
  config: Configuration,
) => {
  applySymbology(layer, config.symbolConfig);
  applyTableConfig(layer, table, config.tableConfig);
};
