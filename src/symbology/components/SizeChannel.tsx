import type FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import type { ChannelDraft, FieldOption, SizeAttrs } from "../types";
import { validateSizes } from "../utils/validation";
import ChannelSection from "./ChannelSection";
import NumberInput from "./NumberInput";

/** Keeps the preview dots a sensible size even while a value is mid-edit. */
const clampPx = (size: number) =>
  Math.min(Math.max(Number.isFinite(size) ? size : 1, 1), 40);

interface SizeChannelProps {
  layer: FeatureLayer;
  fields: FieldOption[];
  value: ChannelDraft<SizeAttrs>;
  onChange: (next: ChannelDraft<SizeAttrs>) => void;
}

/** Size ramp: a pixel size for the smallest and the largest value, previewed as dots. */
export default function SizeChannel({ layer, fields, value, onChange }: SizeChannelProps) {
  return (
    <ChannelSection<SizeAttrs>
      title="Size"
      layer={layer}
      fields={fields}
      value={value}
      onChange={onChange}
      defaultAttrs={() => [{ size: 5 }, { size: 30 }]}
      fixedStops
      validate={validateSizes}
      renderControl={(attrs, patch, label) => (
        <NumberInput
          label={`${label} size in pixels`}
          min={1}
          value={attrs.size}
          onChange={(newSize) => patch({ size: newSize })}
        />
      )}
      renderPreview={(attrs) => (
        <div className="symbology__dots" aria-hidden="true">
          {attrs.map((stopAttrs, index) => (
            <span
              key={index}
              className="symbology__dot"
              style={{ width: clampPx(stopAttrs.size), height: clampPx(stopAttrs.size) }}
            />
          ))}
        </div>
      )}
    />
  );
}
