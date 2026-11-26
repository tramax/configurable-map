import { ReactNode, useEffect, useRef, useState } from "react";
import summaryStatistics from "@arcgis/core/smartMapping/statistics/summaryStatistics";
import type FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-label";
import "@esri/calcite-components/components/calcite-loader";
import "@esri/calcite-components/components/calcite-notice";
import "@esri/calcite-components/components/calcite-option";
import "@esri/calcite-components/components/calcite-select";
import "@esri/calcite-components/components/calcite-switch";
import type { ChannelDraft, FieldOption } from "../types";
import { roundNice, spreadValues } from "../utils/stops";
import "./SymbologyPanel.css";

export interface ChannelSectionProps<StopAttrs> {
  title: string;
  layer: FeatureLayer;
  fields: FieldOption[];
  value: ChannelDraft<StopAttrs>;
  onChange: (next: ChannelDraft<StopAttrs>) => void;
  /** Initial stop attributes for a new field, lowest value first. */
  defaultAttrs: () => StopAttrs[];
  /** Attributes for a stop inserted between two existing ones; not needed with `fixedStops`. */
  between?: (before: StopAttrs, after: StopAttrs) => StopAttrs;
  /** Message when the attributes can't be drawn, otherwise null. Only shown; the map ignores the channel meanwhile. */
  validate?: (attrs: StopAttrs[]) => string | null;
  /** Exactly two stops (min and max): hides adding and removing stops. */
  fixedStops?: boolean;
  /** Editor for one stop's attributes. */
  renderControl: (
    attrs: StopAttrs,
    patch: (changes: Partial<StopAttrs>) => void,
    label: string,
  ) => ReactNode;
  /** Visual summary of the ramp. */
  renderPreview: (attrs: StopAttrs[]) => ReactNode;
}

/** One channel (color or size): enable toggle, field select, stops. */
export default function ChannelSection<StopAttrs>({
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
}: ChannelSectionProps<StopAttrs>) {
  const [loading, setLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const request = useRef(0); // ignores stale statistics responses

  // Unmounting (e.g. the panel's `version` changed) invalidates any request still in flight.
  useEffect(() => {
    const requestCounter = request;
    return () => {
      requestCounter.current++;
    };
  }, []);

  const enabled = value !== undefined;
  const error = value && validate ? validate(value.attrs) : null;

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
    onChange({ field, min, max, attrs: value?.attrs ?? defaultAttrs() });
  }

  function toggle(on: boolean) {
    request.current++; // drop any pending statistics
    setLoading(false);
    setStatsError(null);
    if (!on) return onChange(undefined);
    if (fields[0]) void selectField(fields[0].name);
  }

  function patchStop(index: number, patch: Partial<StopAttrs>) {
    if (!value) return;
    onChange({
      ...value,
      attrs: value.attrs.map((stopAttrs, stopIndex) => (stopIndex === index ? { ...stopAttrs, ...patch } : stopAttrs)),
    });
  }

  function addStop() {
    if (!value || !between) return;
    // Insert before the last stop, so the end of the range keeps its look.
    const { attrs } = value;
    const next = between(attrs[attrs.length - 2], attrs[attrs.length - 1]);
    onChange({
      ...value,
      attrs: [...attrs.slice(0, -1), next, attrs[attrs.length - 1]],
    });
  }

  function removeStop(index: number) {
    if (!value) return;
    onChange({ ...value, attrs: value.attrs.filter((_, stopIndex) => stopIndex !== index) });
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
          oncalciteSwitchChange={(event) => toggle(event.target.checked)}
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
              oncalciteSelectChange={(event) => void selectField(event.target.value)}
            >
              {!fields.some((field) => field.name === value.field) && (
                <calcite-option value={value.field}>{value.field}</calcite-option>
              )}
              {fields.map((field) => (
                <calcite-option key={field.name} value={field.name}>
                  {field.label}
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
                {value.attrs.map((attrs, index) => {
                  const pct = Number(
                    ((100 * index) / (value.attrs.length - 1)).toFixed(1),
                  );
                  return (
                    <li
                      key={index}
                      className={`symbology__stop${fixedStops ? " symbology__stop--fixed" : ""}`}
                    >
                      {renderControl(
                        attrs,
                        (changes) => patchStop(index, changes),
                        `${title} stop ${index + 1}`,
                      )}
                      <span
                        className="symbology__percent"
                        title={`Value: ${values[index]}`}
                      >
                        {pct}%
                      </span>
                      {!fixedStops && (
                        <calcite-button
                          appearance="transparent"
                          kind="neutral"
                          scale="s"
                          icon-start="x"
                          label={`Remove ${title.toLowerCase()} stop ${index + 1}`}
                          disabled={value.attrs.length <= 2}
                          onClick={() => removeStop(index)}
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
                {error} This channel is off on the map until this is fixed.
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
