import type FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import type { ChannelDraft, ColorAttrs, FieldOption } from "../types";
import { midColor } from "../utils/color";
import ChannelSection from "./ChannelSection";

interface ColorChannelProps {
  layer: FeatureLayer;
  fields: FieldOption[];
  value: ChannelDraft<ColorAttrs>;
  onChange: (next: ChannelDraft<ColorAttrs>) => void;
}

/** Color ramp: one color picker per stop, previewed as a gradient. */
export default function ColorChannel({ layer, fields, value, onChange }: ColorChannelProps) {
  return (
    <ChannelSection<ColorAttrs>
      title="Color"
      layer={layer}
      fields={fields}
      value={value}
      onChange={onChange}
      defaultAttrs={() => [{ color: "#ffffff" }, { color: "#00a600" }]}
      between={(before, after) => ({ color: midColor(before.color, after.color) })}
      renderControl={(attrs, patch, label) => (
        <input
          type="color"
          className="symbology__color"
          aria-label={`${label} color`}
          value={attrs.color}
          onChange={(event) => patch({ color: event.target.value })}
        />
      )}
      renderPreview={(attrs) => (
        <div
          className="symbology__ramp"
          style={{
            background: `linear-gradient(to right, ${attrs.map((stopAttrs) => stopAttrs.color).join(", ")})`,
          }}
        />
      )}
    />
  );
}
