import type { Configuration } from "@src/configSchema";

const MAX_STOPS = 20;
const MAX_COLUMNS = 500;
const MAX_NAME_LENGTH = 100;
const MAX_ID_LENGTH = 100;
// The symbology editor only produces #rrggbb, and the panel parses exactly that.
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isFieldName = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 200;
const isFiniteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Parses `{ field, stops }`, checking each stop with `parseStop`. Returns only the known keys. */
function parseChannel<S>(
  raw: unknown,
  label: string,
  parseStop: (stop: Record<string, unknown>) => S | null,
): Result<{ field: string; stops: S[] }> {
  if (!isRecord(raw)) return fail(`${label} must be an object`);
  if (!isFieldName(raw.field)) return fail(`${label}.field must be a field name`);
  if (!Array.isArray(raw.stops) || raw.stops.length < 2 || raw.stops.length > MAX_STOPS) {
    return fail(`${label}.stops must have between 2 and ${MAX_STOPS} stops`);
  }
  const stops: S[] = [];
  for (const rawStop of raw.stops) {
    const stop = isRecord(rawStop) ? parseStop(rawStop) : null;
    if (!stop) return fail(`${label}.stops contains an invalid stop`);
    stops.push(stop);
  }
  return { ok: true, value: { field: raw.field, stops } };
}

/** Validates an untrusted value against the Configuration schema and returns a clean copy. */
export function parseConfiguration(raw: unknown): Result<Configuration> {
  if (!isRecord(raw)) return fail("config must be an object");
  const { symbolConfig, tableConfig } = raw;

  if (!isRecord(symbolConfig)) return fail("config.symbolConfig must be an object");
  const symbols: Configuration["symbolConfig"] = {};

  if (symbolConfig.size !== undefined) {
    const size = parseChannel(symbolConfig.size, "symbolConfig.size", (s) =>
      isFiniteNumber(s.value) && isFiniteNumber(s.size) && s.size > 0
        ? { value: s.value, size: s.size }
        : null,
    );
    if (!size.ok) return size;
    symbols.size = size.value;
  }
  if (symbolConfig.color !== undefined) {
    const color = parseChannel(symbolConfig.color, "symbolConfig.color", (s) =>
      isFiniteNumber(s.value) && typeof s.color === "string" && HEX_COLOR.test(s.color)
        ? { value: s.value, color: s.color }
        : null,
    );
    if (!color.ok) return color;
    symbols.color = color.value;
  }

  if (!isRecord(tableConfig)) return fail("config.tableConfig must be an object");
  const { columns } = tableConfig;
  if (!Array.isArray(columns) || columns.length === 0 || columns.length > MAX_COLUMNS) {
    return fail("tableConfig.columns must be a non-empty list of field names");
  }
  if (!columns.every(isFieldName) || new Set(columns).size !== columns.length) {
    return fail("tableConfig.columns must be unique field names");
  }

  return { ok: true, value: { symbolConfig: symbols, tableConfig: { columns } } };
}

export function parseName(raw: unknown): Result<string> {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
    return fail(`name must be 1 to ${MAX_NAME_LENGTH} characters`);
  }
  return { ok: true, value: name };
}

export function parseDatasetId(raw: unknown): Result<string> {
  if (typeof raw !== "string" || raw.length < 1 || raw.length > MAX_ID_LENGTH) {
    return fail("datasetId is required");
  }
  return { ok: true, value: raw };
}
