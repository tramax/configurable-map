import { useState } from "react";
import type FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-popover";
import type { Draft } from "../types";
import { getNumericFields } from "../utils/fields";
import ColorChannel from "./ColorChannel";
import SizeChannel from "./SizeChannel";
import "./SymbologyPanel.css";

export interface SymbologyPanelProps {
  layer: FeatureLayer;
  /** What is being edited (see `useSymbology`). */
  draft: Draft;
  /** Changes whenever the draft is replaced from outside; drops requests still in flight. */
  version: number;
  onChange: <Key extends keyof Draft>(key: Key, next: Draft[Key]) => void;
  onReset: () => void;
}

/**
 * Fixed top-right button (left of the account button) opening a popover to configure how the
 * points are drawn: color and/or size, each driven by a numeric field. Stops are spaced evenly
 * across the field's data range - the user only picks a color or size for each.
 */
export default function SymbologyPanel({
  layer,
  draft,
  version,
  onChange,
  onReset,
}: SymbologyPanelProps) {
  const [open, setOpen] = useState(false);

  const fields = getNumericFields(layer);
  // The popover anchors to (and is toggled by) this button; kept in state so the popover re-renders once it exists.
  const [button, setButton] = useState<HTMLElement | null>(null);

  return (
    <div className="symbology">
      <calcite-button
        ref={setButton}
        round
        icon-start="palette"
        kind={open ? "brand" : "neutral"}
        label="Symbology settings"
        title="Symbology settings"
      />

      <calcite-popover
        referenceElement={button ?? ""}
        open={open}
        autoClose
        placement="bottom-end"
        overlayPositioning="fixed"
        label="Symbology settings"
        oncalcitePopoverOpen={() => setOpen(true)}
        oncalcitePopoverClose={() => setOpen(false)}
      >
        <div className="symbology__panel">
          <div className="symbology__header">
            <h2 className="symbology__title">Symbology</h2>
            <calcite-button appearance="transparent" scale="s" onClick={onReset}>
              Reset
            </calcite-button>
          </div>

          <ColorChannel
            key={`color-${version}`}
            layer={layer}
            fields={fields}
            value={draft.color}
            onChange={(next) => onChange("color", next)}
          />

          <SizeChannel
            key={`size-${version}`}
            layer={layer}
            fields={fields}
            value={draft.size}
            onChange={(next) => onChange("size", next)}
          />
        </div>
      </calcite-popover>
    </div>
  );
}
