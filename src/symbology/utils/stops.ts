import type { ChannelDraft, Draft, SymbolConfig } from "../types";
import { validateSizes } from "./validation";

export const roundNice = (value: number) => Number(value.toPrecision(6));

/** Stop values for `count` stops spaced evenly from min (0%) to max (100%). */
export const spreadValues = (min: number, max: number, count: number) =>
  Array.from({ length: count }, (_, index) =>
    roundNice(min + ((max - min) * index) / (count - 1)),
  );

/** Draft -> the stops the renderer uses. */
export function toChannel<StopAttrs>(draft: ChannelDraft<StopAttrs>) {
  if (!draft) return undefined;
  const values = spreadValues(draft.min, draft.max, draft.attrs.length);
  return {
    field: draft.field,
    stops: draft.attrs.map((stopAttrs, index) => ({ ...stopAttrs, value: values[index] })),
  };
}

/** Stops from a saved configuration -> draft; the range is taken from the first and last stop. */
function toDraft<Stop extends { value: number }>(
  channel: { field: string; stops: Stop[] } | undefined,
): ChannelDraft<Omit<Stop, "value">> {
  if (!channel || channel.stops.length < 2) return undefined;
  const stops = [...channel.stops].sort((first, second) => first.value - second.value);
  return {
    field: channel.field,
    min: stops[0].value,
    max: stops[stops.length - 1].value,
    attrs: stops.map(
      ({ value: _value, ...attrs }) => attrs as Omit<Stop, "value">,
    ),
  };
}

/**
 * Draft -> the configuration for the map. A channel that can't be drawn yet (e.g. an empty size
 * field) is left out, so it is simply off on the map until the user fixes it.
 */
export const toConfig = (draft: Draft): SymbolConfig => ({
  color: toChannel(draft.color),
  size: draft.size && !validateSizes(draft.size.attrs) ? toChannel(draft.size) : undefined,
});

/** Saved configuration -> the panel's editable state. */
export const toDrafts = (config: SymbolConfig): Draft => {
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
