import { useCallback, useEffect, useRef, useState } from "react";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import "@arcgis/map-components/components/arcgis-map";
import "@arcgis/map-components/components/arcgis-legend";
import "@arcgis/map-components/components/arcgis-feature-table";
import "@arcgis/map-components/components/arcgis-expand";
import type { ArcgisMapCustomEvent } from "@arcgis/map-components";
import type { ArcgisFeatureTable } from "@arcgis/map-components/components/arcgis-feature-table";
import { applySymbology, applyTableConfig, Configuration, configure, getTableColumns } from "./configuration";
import { AuthUser, fetchCurrentUser } from "./auth/api";
import LoginMenu from "./auth/LoginMenu";
import ConfigurationsMenu from "./configurations/ConfigurationsMenu";
import type { SavedConfiguration } from "./configurations/api";
import SymbologyPanel from "./symbology/SymbologyPanel";

// This is a REST API - you can open this url on the browser to see the available fields in the layer
const FEATURE_LAYER_URL =
  "https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/Landscape_Trees/FeatureServer/0";

// Saved configurations are stored per dataset.
const DATASET_ID = "landscape-trees";

// SAMPLE CONFIG
const CONFIG: Configuration = {
  symbolConfig: {
    color: { field: "Leaf_Area", stops: [{value: 10, color: "#ffffff"}, {value: 40000, color: "#00fd00"}]},
    size: { field: "Leaf_Bmass", stops: [{value: 0, size: 5}, {value: 700, size: 40}]}
  },
  tableConfig: {
    columns: ["Leaf_Area", "Leaf_Bmass"]
  }
};

export default function App() {
  const [layer, setLayer] = useState<FeatureLayer | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [symbolConfig, setSymbolConfig] = useState(CONFIG.symbolConfig);
  // What the symbology panel starts from. It keeps its own draft, so opening a saved configuration
  // hands it a new `initial` and a new `version`, which remounts it.
  const [panelStart, setPanelStart] = useState({ initial: CONFIG.symbolConfig, version: 0 });
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

  // Table + initial symbology, once the layer (and with it the table) exists.
  useEffect(() => {
    if (layer && tableRef.current) configure(layer, tableRef.current, CONFIG);
  }, [layer]);

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
        columns: layer && table ? getTableColumns(layer, table) : CONFIG.tableConfig.columns,
      },
    };
  }, [layer, symbolConfig]);

  const openConfiguration = useCallback(
    ({ config }: SavedConfiguration) => {
      if (!layer || !tableRef.current) return;
      applyTableConfig(layer, tableRef.current, config.tableConfig);
      setSymbolConfig(config.symbolConfig);
      setPanelStart((p) => ({ initial: config.symbolConfig, version: p.version + 1 }));
    },
    [layer],
  );

  const handleReady = useCallback((event: ArcgisMapCustomEvent<void>) => {
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

    view?.map?.add(layer);
    layer.when(() => {
      if (layer.fullExtent) view?.goTo(layer.fullExtent).catch(() => {});
      setLayer(layer);
    });
  }, []);

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
