import type FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import FieldColumnTemplate from "@arcgis/core/widgets/FeatureTable/support/FieldColumnTemplate";
import { describe, expect, it } from "vitest";
import { applySymbology, applyTableConfig } from "./applyConfiguration";

// A stand-in for the parts of FeatureLayer these functions read. A function, not a constant,
// because applySymbology sets `renderer` on it and each test needs a fresh one.
const layer = () =>
  ({
    fields: [
      { name: "OBJECTID", type: "oid" },
      { name: "Height", type: "double", alias: "Tree Height" },
      { name: "LeafArea", type: "double" },
      { name: "Species", type: "string" },
    ],
    renderer: undefined,
  }) as unknown as FeatureLayer;

const fakeTable = () => ({}) as unknown as HTMLArcgisFeatureTableElement;

/** What applySymbology put on the layer, one summary per visual variable. */
const variablesOf = (featureLayer: FeatureLayer) => {
  if (!(featureLayer.renderer instanceof SimpleRenderer)) throw new Error("expected a SimpleRenderer");
  return (featureLayer.renderer.visualVariables ?? []).map((variable) => ({
    type: variable.type,
    field: variable.field,
    title: variable.legendOptions?.title,
  }));
};

describe("applySymbology", () => {
  const stops = [
    { value: 0, color: "#000000" },
    { value: 1, color: "#ffffff" },
  ];
  const sizeStops = [
    { value: 0, size: 4 },
    { value: 1, size: 12 },
  ];

  it("sets a renderer with one visual variable per configured channel", () => {
    const featureLayer = layer();
    applySymbology(featureLayer, { size: { field: "Height", stops: sizeStops }, color: { field: "LeafArea", stops } });
    expect(variablesOf(featureLayer).map((variable) => [variable.type, variable.field])).toEqual([
      ["size", "Height"],
      ["color", "LeafArea"],
    ]);
  });

  it("titles the legend with the field alias, or the name when there is none", () => {
    const featureLayer = layer();
    applySymbology(featureLayer, { size: { field: "Height", stops: sizeStops }, color: { field: "LeafArea", stops } });
    expect(variablesOf(featureLayer).map((variable) => variable.title)).toEqual(["Size: Tree Height", "Color: LeafArea"]);
  });

  it("adds no visual variable for a channel that is not configured", () => {
    const featureLayer = layer();
    applySymbology(featureLayer, { color: { field: "LeafArea", stops } });
    expect(variablesOf(featureLayer).map((variable) => variable.type)).toEqual(["color"]);
  });

  it("does not check the field exists on the layer (known gap, see README)", () => {
    const featureLayer = layer();
    applySymbology(featureLayer, { color: { field: "Gone", stops } });
    expect(variablesOf(featureLayer)[0].field).toBe("Gone");
  });
});

describe("applyTableConfig", () => {
  const columnsOf = (table: HTMLArcgisFeatureTableElement) =>
    (table.tableTemplate?.columnTemplates ?? []).map((column) => {
      if (!(column instanceof FieldColumnTemplate)) throw new Error("expected a field column");
      return [column.fieldName, column.visible] as const;
    });

  it("shows configured columns first, in order, and hides the other fields", () => {
    const table = fakeTable();
    applyTableConfig(layer(), table, { columns: ["Species", "Height"] });
    expect(columnsOf(table)).toEqual([
      ["Species", true],
      ["Height", true],
      ["LeafArea", false],
    ]);
  });

  it("never offers system fields such as the object id", () => {
    const table = fakeTable();
    applyTableConfig(layer(), table, { columns: ["OBJECTID", "Height"] });
    expect(columnsOf(table).map(([name]) => name)).not.toContain("OBJECTID");
  });

  it("skips columns naming a field the layer no longer has", () => {
    const table = fakeTable();
    applyTableConfig(layer(), table, { columns: ["Gone", "Height"] });
    expect(columnsOf(table)[0]).toEqual(["Height", true]);
    expect(columnsOf(table).map(([name]) => name)).not.toContain("Gone");
  });

  it("clears any fields hidden earlier through the table's own menu", () => {
    const table = fakeTable();
    applyTableConfig(layer(), table, { columns: ["Height"] });
    expect(table.hiddenFields.length).toBe(0);
  });
});
