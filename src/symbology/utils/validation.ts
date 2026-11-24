import type { SizeAttrs } from "../types";

/** Message when the sizes can't be drawn, otherwise null. */
export const validateSizes = (attrs: SizeAttrs[]): string | null =>
  attrs.every((stopAttrs) => Number.isFinite(stopAttrs.size) && stopAttrs.size > 0)
    ? null
    : "Every size must be a number above 0.";
