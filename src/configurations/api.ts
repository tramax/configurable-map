import type { Configuration } from "../configSchema";

/** A configuration as stored by the server. */
export interface SavedConfiguration {
  id: string;
  datasetId: string;
  name: string;
  visibility: "system" | "private" | "public";
  createdAt: string;
  config: Configuration;
}

/**
 * Client for the configuration endpoints (all require a signed-in user).
 *
 *   GET  /api/configurations?datasetId=...  -> 200 SavedConfiguration[] (newest first)
 *   POST /api/configurations                -> 201 SavedConfiguration   body: { datasetId, name, config }
 */

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
