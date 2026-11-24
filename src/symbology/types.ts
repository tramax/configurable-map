import type { ColorStop, Configuration, SizeStop } from "@contract/configuration.schema";

export type SymbolConfig = Configuration["symbolConfig"];

export type ColorAttrs = Omit<ColorStop, "value">;
export type SizeAttrs = Omit<SizeStop, "value">;

/**
 * What the user edits for one channel. Stop *values* are not edited: the stops are spaced evenly
 * from `min` to `max` (the field's data range), so only each stop's color/size is stored.
 */
export type ChannelDraft<StopAttrs> =
  | { field: string; min: number; max: number; attrs: StopAttrs[] }
  | undefined;

/** Both channels of the panel's editable state. */
export type Draft = { color: ChannelDraft<ColorAttrs>; size: ChannelDraft<SizeAttrs> };

export type ChannelErrors = { color: string | null; size: string | null };

export interface FieldOption {
  name: string;
  label: string;
}
