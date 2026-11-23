import { useCallback, useEffect, useRef, useState } from "react";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-legend";
import "@arcgis/map-components/components/arcgis-feature-table";
import "@arcgis/map-components/components/arcgis-expand";
import type { ArcgisMapCustomEvent } from "@arcgis/map-components";
import type { ArcgisFeatureTable } from "@arcgis/map-components/components/arcgis-feature-table";
import { applySymbology, applyTableConfig, Configuration, getTableColumns } from "./configuration";
import { AuthUser, fetchCurrentUser } from "./auth/api";
import LoginMenu from "./auth/LoginMenu";
import ConfigurationsMenu from "./configurations/ConfigurationsMenu";
import { fetchDefaultConfiguration, type SavedConfiguration } from "./configurations/api";
import SymbologyPanel from "./symbology/SymbologyPanel";

// This is a REST API - you can open this url on the browser to see the available fields in the layer
const FEATURE_LAYER_URL =
  "https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/Landscape_Trees/FeatureServer/0";

// Saved configurations are stored per dataset.
const DATASET_ID = "landscape-trees";

type SymbolConfig = Configuration["symbolConfig"];
type TableConfig = Configuration["tableConfig"];

// With no default configuration (none stored, or the server could not be reached) the points get
// this plain symbology and the table keeps its own default columns.
const NO_SYMBOLOGY: SymbolConfig = {};

export default function App() {
  const [layer, setLayer] = useState<FeatureLayer | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  // The default configuration of the dataset, asked for once when the app starts. Resolves to
  // `null` instead of failing, so the app still opens without one.
  const [defaultRequest] = useState(() =>
    fetchDefaultConfiguration(DATASET_ID).then(
      (saved) => saved?.config ?? null,
      (err) => {
        console.warn("Couldn't load the default configuration; starting without one.", err);
        return null;
      },
    ),
  );
  const [defaultTable, setDefaultTable] = useState<TableConfig | null>(null);
  const [symbolConfig, setSymbolConfig] = useState(NO_SYMBOLOGY);
  // What the symbology panel starts from. It keeps its own draft, so opening a saved configuration
  // hands it a new `initial` and a new `version`, which remounts it.
  const [panelStart, setPanelStart] = useState({ initial: NO_SYMBOLOGY, version: 0 });
  const tableRef = useRef<ArcgisFeatureTable | null>(null);

  // Restore an existing session on load.
  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser().then((u) => {
      if (!cancelled) setUser(u);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The default's table columns, once the layer (and with it the table) exists. Its symbology is
  // already on the layer by then (see handleReady) and in the state above.
  useEffect(() => {
    if (layer && tableRef.current && defaultTable) applyTableConfig(layer, tableRef.current, defaultTable);
  }, [layer, defaultTable]);

  // Symbology edits from the settings panel.
  useEffect(() => {
    if (layer) applySymbology(layer, symbolConfig);
  }, [layer, symbolConfig]);

  /** The configuration on screen: the symbology as edited, and the table columns as currently shown. */
  const getCurrentConfig = useCallback((): Configuration => {
    const table = tableRef.current;
    return {
      symbolConfig,
      tableConfig: {
        columns: layer && table ? getTableColumns(layer, table) : (defaultTable?.columns ?? []),
      },
    };
  }, [layer, symbolConfig, defaultTable]);

  const openConfiguration = useCallback(
    ({ config }: SavedConfiguration) => {
      if (!layer || !tableRef.current) return;
      applyTableConfig(layer, tableRef.current, config.tableConfig);
      setSymbolConfig(config.symbolConfig);
      setPanelStart((p) => ({ initial: config.symbolConfig, version: p.version + 1 }));
    },
    [layer],
  );

  const handleReady = useCallback(async (event: ArcgisMapCustomEvent<void>) => {
    const view = event.target.view;

    const layer = new FeatureLayer({
      url: FEATURE_LAYER_URL,
      outFields: ["*"],
      popupTemplate: {
        title: "{Cmn_Name} (Tree {Tree_ID})",
        content: [
          {
            type: "fields",
            fieldInfos: [
              { fieldName: "Sci_Name", label: "Scientific name" },
              { fieldName: "Status", label: "Status" },
              { fieldName: "Condition", label: "Condition" },
              { fieldName: "Height", label: "Height (ft)" },
              { fieldName: "Native", label: "Native" },
              { fieldName: "Land_Use", label: "Land use" },
            ],
          },
        ],
      },
    });

    // Wait for the layer and the default, and style the layer before it joins the map, so the
    // points are never drawn in the service's own style first.
    const [defaultConfig] = await Promise.all([defaultRequest, layer.load()]);
    if (defaultConfig) applySymbology(layer, defaultConfig.symbolConfig);

    view?.map?.add(layer);
    if (layer.fullExtent) view?.goTo(layer.fullExtent).catch(() => {});

    // One batch: the panel and the table are rendered once the layer is set, already knowing their start.
    setSymbolConfig(defaultConfig?.symbolConfig ?? NO_SYMBOLOGY);
    setPanelStart((p) => ({ initial: defaultConfig?.symbolConfig ?? NO_SYMBOLOGY, version: p.version + 1 }));
    setDefaultTable(defaultConfig?.tableConfig ?? null);
    setLayer(layer);
  }, [defaultRequest]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
      }}
    >
      {layer && (
        <ConfigurationsMenu
          user={user}
          datasetId={DATASET_ID}
          getCurrent={getCurrentConfig}
          onOpen={openConfiguration}
        />
      )}
      {layer && (
        <SymbologyPanel
          key={panelStart.version}
          layer={layer}
          initialConfig={panelStart.initial}
          onChange={setSymbolConfig}
        />
      )}
      <LoginMenu user={user} onUserChange={setUser} />
      <arcgis-map
        id="map"
        basemap="topo-vector"
        onarcgisViewReadyChange={handleReady}
        style={{ flex: 1, minHeight: 0 }}
      >
        <arcgis-expand slot="bottom-left" expanded>
          <arcgis-legend />
        </arcgis-expand>
      </arcgis-map>
      {layer && (
        <arcgis-feature-table
          ref={tableRef}
          referenceElement="map"
          layer={layer}
          style={{ height: "40vh" }}
        />
      )}
    </div>
  );
}
