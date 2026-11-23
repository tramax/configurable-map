import { ReactNode, useEffect, useRef, useState } from "react";
import summaryStatistics from "@arcgis/core/smartMapping/statistics/summaryStatistics";
import type FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-input-number";
import "@esri/calcite-components/components/calcite-label";
import "@esri/calcite-components/components/calcite-loader";
import "@esri/calcite-components/components/calcite-notice";
import "@esri/calcite-components/components/calcite-option";
import "@esri/calcite-components/components/calcite-popover";
import "@esri/calcite-components/components/calcite-select";
import "@esri/calcite-components/components/calcite-switch";
import type { ColorStop, Configuration, SizeStop } from "../configSchema";
import "./SymbologyPanel.css";

type SymbolConfig = Configuration["symbolConfig"];
type ChannelErrors = { color: string | null; size: string | null };

type ColorAttrs = Omit<ColorStop, "value">;
type SizeAttrs = Omit<SizeStop, "value">;

/**
 * What the user edits for one channel. Stop *values* are not edited: the stops are spaced evenly
 * from `min` to `max` (the field's data range), so only each stop's color/size is stored.
 */
type ChannelDraft<A> =
  | { field: string; min: number; max: number; attrs: A[] }
  | undefined;

export interface FieldOption {
  name: string;
  label: string;
}

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
    .filter((f) => NUMERIC_FIELD_TYPES.has(f.type))
    .map((f) => ({ name: f.name, label: f.alias || f.name }));
}

// ---------------------------------------------------------------------------------------------
// Stop helpers
// ---------------------------------------------------------------------------------------------

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = (rgb: number[]) =>
  "#" + rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");

const midColor = (a: string, b: string) => {
  const [ra, rb] = [hexToRgb(a), hexToRgb(b)];
  return rgbToHex(ra.map((c, i) => (c + rb[i]) / 2));
};

const roundNice = (n: number) => Number(n.toPrecision(6));

/** Stop values for `n` stops spaced evenly from min (0%) to max (100%). */
const spreadValues = (min: number, max: number, n: number) =>
  Array.from({ length: n }, (_, i) =>
    roundNice(min + ((max - min) * i) / (n - 1)),
  );

/** Draft -> the stops the renderer uses. */
function toChannel<A>(draft: ChannelDraft<A>) {
  if (!draft) return undefined;
  const values = spreadValues(draft.min, draft.max, draft.attrs.length);
  return {
    field: draft.field,
    stops: draft.attrs.map((a, i) => ({ ...a, value: values[i] })),
  };
}

/** Stops from a saved configuration -> draft; the range is taken from the first and last stop. */
function toDraft<S extends { value: number }>(
  channel: { field: string; stops: S[] } | undefined,
): ChannelDraft<Omit<S, "value">> {
  if (!channel || channel.stops.length < 2) return undefined;
  const stops = [...channel.stops].sort((a, b) => a.value - b.value);
  return {
    field: channel.field,
    min: stops[0].value,
    max: stops[stops.length - 1].value,
    attrs: stops.map(
      ({ value: _value, ...attrs }) => attrs as Omit<S, "value">,
    ),
  };
}

// ---------------------------------------------------------------------------------------------
// Small inputs
// ---------------------------------------------------------------------------------------------

/**
 * Number input that keeps what the user typed ("1.", "-") as text and only reports parsable
 * values, so editing isn't fought by the controlled value. `NaN` is reported for an empty field.
 */
function NumberInput({
  value,
  onChange,
  min,
  label,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  label: string;
  className?: string;
}) {
  const [text, setText] = useState(Number.isFinite(value) ? String(value) : "");
  // Re-sync when the value is changed from outside (field change, reset), not while typing.
  const lastReported = useRef(value);
  useEffect(() => {
    if (!Object.is(value, lastReported.current)) {
      lastReported.current = value;
      setText(Number.isFinite(value) ? String(value) : "");
    }
  }, [value]);

  return (
    <calcite-input-number
      className={className}
      scale="s"
      step="any"
      min={min}
      label={label}
      suffix-text="px"
      value={text}
      oncalciteInputNumberInput={(e) => {
        const raw = e.target.value;
        setText(raw);
        const next = raw.trim() === "" ? NaN : Number(raw);
        lastReported.current = next;
        onChange(next);
      }}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// One channel (color or size): enable toggle, field, stops
// ---------------------------------------------------------------------------------------------

interface ChannelSectionProps<A> {
  title: string;
  layer: FeatureLayer;
  fields: FieldOption[];
  value: ChannelDraft<A>;
  /** Called with the edited draft; `error` is non-null when it can't be applied yet. */
  onChange: (next: ChannelDraft<A>, error: string | null) => void;
  /** Initial stop attributes for a new field, lowest value first. */
  defaultAttrs: () => A[];
  /** Attributes for a stop inserted between two existing ones; not needed with `fixedStops`. */
  between?: (a: A, b: A) => A;
  /** Message when the attributes can't be rendered, otherwise null. */
  validate?: (attrs: A[]) => string | null;
  /** Exactly two stops (min and max): hides adding and removing stops. */
  fixedStops?: boolean;
  /** Editor for one stop's attributes. */
  renderControl: (
    attrs: A,
    patch: (p: Partial<A>) => void,
    label: string,
  ) => ReactNode;
  /** Visual summary of the ramp. */
  renderPreview: (attrs: A[]) => ReactNode;
}

function ChannelSection<A>({
  title,
  layer,
  fields,
  value,
  onChange,
  defaultAttrs,
  between,
  validate,
  fixedStops = false,
  renderControl,
  renderPreview,
}: ChannelSectionProps<A>) {
  const [loading, setLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const request = useRef(0); // ignores stale statistics responses

  const enabled = value !== undefined;
  const error = value && validate ? validate(value.attrs) : null;
  const emit = (next: ChannelDraft<A>) =>
    onChange(next, next && validate ? validate(next.attrs) : null);

  async function selectField(field: string) {
    const current = ++request.current;
    setLoading(true);
    setStatsError(null);
    let min = 0;
    let max = 100;
    try {
      const stats = await summaryStatistics({ layer, field });
      if (current !== request.current) return;
      if (
        Number.isFinite(stats.min) &&
        Number.isFinite(stats.max) &&
        stats.min !== stats.max
      ) {
        min = roundNice(stats.min as number);
        max = roundNice(stats.max as number);
      } else {
        setStatsError(
          "This field has no value range to spread the stops over.",
        );
      }
    } catch {
      if (current !== request.current) return;
      setStatsError("Couldn't read the value range of this field.");
    }
    setLoading(false);
    // Switching field keeps the user's colors/sizes; only the range changes.
    emit({ field, min, max, attrs: value?.attrs ?? defaultAttrs() });
  }

  function toggle(on: boolean) {
    request.current++; // drop any pending statistics
    setLoading(false);
    setStatsError(null);
    if (!on) return emit(undefined);
    if (fields[0]) void selectField(fields[0].name);
  }

  function patchStop(index: number, patch: Partial<A>) {
    if (!value) return;
    emit({
      ...value,
      attrs: value.attrs.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    });
  }

  function addStop() {
    if (!value || !between) return;
    // Insert before the last stop, so the end of the range keeps its look.
    const { attrs } = value;
    const next = between(attrs[attrs.length - 2], attrs[attrs.length - 1]);
    emit({
      ...value,
      attrs: [...attrs.slice(0, -1), next, attrs[attrs.length - 1]],
    });
  }

  function removeStop(index: number) {
    if (!value) return;
    emit({ ...value, attrs: value.attrs.filter((_, i) => i !== index) });
  }

  const values = value
    ? spreadValues(value.min, value.max, value.attrs.length)
    : [];

  return (
    <section className="symbology__section">
      <calcite-label layout="inline">
        <calcite-switch
          checked={enabled}
          disabled={fields.length === 0}
          oncalciteSwitchChange={(e) => toggle(e.target.checked)}
        />
        {title}
      </calcite-label>

      {enabled && value && (
        <div aria-busy={loading}>
          <calcite-label>
            Field
            <calcite-select
              label="Field"
              value={value.field}
              disabled={loading}
              oncalciteSelectChange={(e) => void selectField(e.target.value)}
            >
              {!fields.some((f) => f.name === value.field) && (
                <calcite-option value={value.field}>{value.field}</calcite-option>
              )}
              {fields.map((f) => (
                <calcite-option key={f.name} value={f.name}>
                  {f.label}
                </calcite-option>
              ))}
            </calcite-select>
          </calcite-label>

          {loading ? (
            <calcite-loader inline label="Reading value range" text="Reading value range…" />
          ) : (
            <>
              <div className="symbology__preview">
                {renderPreview(value.attrs)}
              </div>

              <ul className="symbology__stops">
                {value.attrs.map((attrs, i) => {
                  const pct = Number(
                    ((100 * i) / (value.attrs.length - 1)).toFixed(1),
                  );
                  return (
                    <li
                      key={i}
                      className={`symbology__stop${fixedStops ? " symbology__stop--fixed" : ""}`}
                    >
                      {renderControl(
                        attrs,
                        (p) => patchStop(i, p),
                        `${title} stop ${i + 1}`,
                      )}
                      <span
                        className="symbology__percent"
                        title={`Value: ${values[i]}`}
                      >
                        {pct}%
                      </span>
                      {!fixedStops && (
                        <calcite-button
                          appearance="transparent"
                          kind="neutral"
                          scale="s"
                          icon-start="x"
                          label={`Remove ${title.toLowerCase()} stop ${i + 1}`}
                          disabled={value.attrs.length <= 2}
                          onClick={() => removeStop(i)}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
              {!fixedStops && (
                <calcite-button
                  appearance="transparent"
                  scale="s"
                  icon-start="plus"
                  onClick={addStop}
                >
                  Add stop
                </calcite-button>
              )}
            </>
          )}

          {statsError && (
            <calcite-notice open kind="warning" scale="s" width="full" icon>
              <div slot="message">{statsError}</div>
            </calcite-notice>
          )}
          {error && (
            <calcite-notice open kind="danger" scale="s" width="full" icon role="alert">
              <div slot="message">
                {error} Changes aren't applied to the map until this is fixed.
              </div>
            </calcite-notice>
          )}
        </div>
      )}
      {fields.length === 0 && (
        <calcite-notice open kind="neutral" scale="s" width="full">
          <div slot="message">No numeric fields available.</div>
        </calcite-notice>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------------------------

type Draft = { color: ChannelDraft<ColorAttrs>; size: ChannelDraft<SizeAttrs> };
const toDrafts = (config: SymbolConfig): Draft => {
  const size = toDraft(config.size);
  return {
    color: toDraft(config.color),
    // Size is a two-stop ramp (smallest to largest); keep just the ends of a longer saved one.
    size: size && {
      ...size,
      attrs: [size.attrs[0], size.attrs[size.attrs.length - 1]],
    },
  };
};

export interface SymbologyPanelProps {
  layer: FeatureLayer;
  /** Configuration the panel starts from, and what "Reset" returns to. */
  initialConfig: SymbolConfig;
  /** Called with a valid configuration every time the user edits it. */
  onChange: (config: SymbolConfig) => void;
}

/**
 * Fixed top-right button (left of the account button) opening a popover to configure how the
 * points are drawn: color and/or size, each driven by a numeric field. Stops are spaced evenly
 * across the field's data range - the user only picks a color or size for each.
 */
export default function SymbologyPanel({
  layer,
  initialConfig,
  onChange,
}: SymbologyPanelProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDrafts(initialConfig));
  // Mirrors the state so async updates (field statistics arriving late) never write back a stale draft.
  const latest = useRef({
    draft,
    errors: { color: null, size: null } as ChannelErrors,
  });
  // Bumped on reset so the stop inputs remount and show the restored values.
  const [resetKey, setResetKey] = useState(0);

  const fields = getNumericFields(layer);
  // The popover anchors to (and is toggled by) this button; kept in state so the popover re-renders once it exists.
  const [button, setButton] = useState<HTMLElement | null>(null);

  /** Updates one channel; pushes to the map only when both channels are currently valid. */
  function update<K extends keyof Draft>(
    key: K,
    next: Draft[K],
    error: string | null,
  ) {
    const nextDraft = { ...latest.current.draft, [key]: next };
    const nextErrors = { ...latest.current.errors, [key]: error };
    latest.current = { draft: nextDraft, errors: nextErrors };
    setDraft(nextDraft);
    if (nextErrors.color || nextErrors.size) return;
    onChange({
      color: toChannel(nextDraft.color),
      size: toChannel(nextDraft.size),
    });
  }

  function reset() {
    const restored = toDrafts(initialConfig);
    latest.current = { draft: restored, errors: { color: null, size: null } };
    setDraft(restored);
    setResetKey((k) => k + 1);
    onChange(initialConfig);
  }

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
            <calcite-button appearance="transparent" scale="s" onClick={reset}>
              Reset
            </calcite-button>
          </div>

          <ChannelSection<ColorAttrs>
            key={`color-${resetKey}`}
            title="Color"
            layer={layer}
            fields={fields}
            value={draft.color}
            onChange={(next, err) => update("color", next, err)}
            defaultAttrs={() => [{ color: "#ffffff" }, { color: "#00a600" }]}
            between={(a, b) => ({ color: midColor(a.color, b.color) })}
            renderControl={(attrs, patch, label) => (
              <input
                type="color"
                className="symbology__color"
                aria-label={`${label} color`}
                value={attrs.color}
                onChange={(e) => patch({ color: e.target.value })}
              />
            )}
            renderPreview={(attrs) => (
              <div
                className="symbology__ramp"
                style={{
                  background: `linear-gradient(to right, ${attrs.map((a) => a.color).join(", ")})`,
                }}
              />
            )}
          />

          <ChannelSection<SizeAttrs>
            key={`size-${resetKey}`}
            title="Size"
            layer={layer}
            fields={fields}
            value={draft.size}
            onChange={(next, err) => update("size", next, err)}
            defaultAttrs={() => [{ size: 5 }, { size: 30 }]}
            fixedStops
            validate={(attrs) =>
              attrs.every((a) => Number.isFinite(a.size) && a.size > 0)
                ? null
                : "Every size must be a number above 0."
            }
            renderControl={(attrs, patch, label) => (
              <NumberInput
                label={`${label} size in pixels`}
                min={1}
                value={attrs.size}
                onChange={(v) => patch({ size: v })}
              />
            )}
            renderPreview={(attrs) => (
              <div className="symbology__dots" aria-hidden="true">
                {attrs.map((a, i) => (
                  <span
                    key={i}
                    className="symbology__dot"
                    style={{ width: clampPx(a.size), height: clampPx(a.size) }}
                  />
                ))}
              </div>
            )}
          />
        </div>
      </calcite-popover>
    </div>
  );
}

/** Keeps the preview dots a sensible size even while a value is mid-edit. */
const clampPx = (n: number) =>
  Math.min(Math.max(Number.isFinite(n) ? n : 1, 1), 40);
