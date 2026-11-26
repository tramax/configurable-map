import type { SizeAttrs } from "../types";

/** Message when the sizes can't be drawn, otherwise null. */
export const validateSizes = (attrs: SizeAttrs[]): string | null =>
  attrs.every((stopAttrs) => Number.isInteger(stopAttrs.size) && stopAttrs.size >= 1)
    ? null
    : "Every size must be a whole number of at least 1.";
