import type { Configuration } from "@contract/configuration.schema";

/** A configuration as stored by the server. */
export interface SavedConfiguration {
  id: string;
  datasetId: string;
  name: string;
  visibility: "system" | "private" | "public";
  isDefault: boolean;
  /** Username of the owner; null for predefined configurations. */
  author: string | null;
  /** Whether the signed-in user owns it, and so may publish or unpublish it. */
  mine: boolean;
  createdAt: string;
  config: Configuration;
}

/**
 * Client for the configuration endpoints.
 *
 *   GET  /api/configurations/default?datasetId=... -> 200 SavedConfiguration, or 404 if there is none (no sign-in needed)
 *   GET  /api/configurations?datasetId=...         -> 200 SavedConfiguration[] (newest first)    (signed in)
 *   POST /api/configurations                       -> 201 SavedConfiguration   body: { datasetId, name, config }   (signed in)
 *   POST /api/configurations/:id/publish           -> 200 SavedConfiguration (now public)    (signed in, own configurations)
 *   POST /api/configurations/:id/unpublish         -> 200 SavedConfiguration (now private)   (signed in, own configurations)
 */

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * The configuration the dataset opens with, or `null` if it has none. Works before sign-in.
 * Throws if the server can't be reached or answers with an error, so callers can tell "no default"
 * from "couldn't ask".
 */
export async function fetchDefaultConfiguration(datasetId: string): Promise<SavedConfiguration | null> {
  // The map waits for this, so a hung server must not hold it back for long.
  const res = await fetch(`/api/configurations/default?datasetId=${encodeURIComponent(datasetId)}`, {
    credentials: "same-origin",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await errorMessage(res, "Couldn't load the default configuration."));
  return (await res.json()) as SavedConfiguration;
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  if (res.status === 401) return "Sign in to use saved configurations.";
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}

export async function listConfigurations(datasetId: string): Promise<SavedConfiguration[]> {
  let res: Response;
  try {
    res = await fetch(`/api/configurations?datasetId=${encodeURIComponent(datasetId)}`, {
      credentials: "same-origin",
    });
  } catch {
    throw new Error("Unable to reach the server. Please try again.");
  }
  if (!res.ok) throw new Error(await errorMessage(res, "Couldn't load your configurations."));
  return (await res.json()) as SavedConfiguration[];
}

export async function saveConfiguration(
  datasetId: string,
  name: string,
  config: Configuration,
): Promise<SavedConfiguration> {
  let res: Response;
  try {
    res = await fetch("/api/configurations", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datasetId, name, config }),
    });
  } catch {
    throw new Error("Unable to reach the server. Please try again.");
  }
  if (!res.ok) throw new Error(await errorMessage(res, "Couldn't save the configuration."));
  return (await res.json()) as SavedConfiguration;
}

/** Shares (`true`) or stops sharing (`false`) one of the user's own configurations. */
export async function setPublished(id: string, published: boolean): Promise<SavedConfiguration> {
  let res: Response;
  try {
    res = await fetch(`/api/configurations/${encodeURIComponent(id)}/${published ? "publish" : "unpublish"}`, {
      method: "POST",
      credentials: "same-origin",
    });
  } catch {
    throw new Error("Unable to reach the server. Please try again.");
  }
  if (!res.ok) {
    throw new Error(
      await errorMessage(res, published ? "Couldn't publish the configuration." : "Couldn't stop sharing the configuration."),
    );
  }
  return (await res.json()) as SavedConfiguration;
}
