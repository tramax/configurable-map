import { useCallback, useMemo, useState } from "react";
import type { Draft, SymbolConfig } from "../types";
import { toConfig, toDrafts } from "../utils/stops";

const NO_SYMBOLOGY: SymbolConfig = {};

/**
 * The symbology the user is editing, and the configuration to draw from it.
 *
 * `config` is the configuration as loaded until the first edit, so a saved configuration reaches
 * the map untouched; after that it is derived from the draft, leaving out any channel that can't
 * be drawn yet.
 */
export function useSymbology() {
  const [state, setState] = useState(() => ({
    baseline: NO_SYMBOLOGY,
    draft: toDrafts(NO_SYMBOLOGY),
    edited: false,
    // Bumped whenever the draft is replaced from outside, so pending field requests are dropped.
    version: 0,
  }));

  const config = useMemo(
    () => (state.edited ? toConfig(state.draft) : state.baseline),
    [state.edited, state.draft, state.baseline],
  );

  /** Starts over from a configuration (the default one, or a saved one the user opened). */
  const load = useCallback((loaded: SymbolConfig) => {
    setState((prev) => ({
      baseline: loaded,
      draft: toDrafts(loaded),
      edited: false,
      version: prev.version + 1,
    }));
  }, []);

  /** Goes back to the configuration last loaded. */
  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      draft: toDrafts(prev.baseline),
      edited: false,
      version: prev.version + 1,
    }));
  }, []);

  const setChannel = useCallback(<Key extends keyof Draft>(key: Key, next: Draft[Key]) => {
    setState((prev) => ({ ...prev, draft: { ...prev.draft, [key]: next }, edited: true }));
  }, []);

  return { draft: state.draft, version: state.version, config, setChannel, load, reset };
}
