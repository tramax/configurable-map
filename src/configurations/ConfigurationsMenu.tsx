import { FormEvent, useEffect, useState } from "react";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-input-text";
import "@esri/calcite-components/components/calcite-list";
import "@esri/calcite-components/components/calcite-list-item";
import "@esri/calcite-components/components/calcite-notice";
import "@esri/calcite-components/components/calcite-popover";
import type { AuthUser } from "../auth/api";
import type { Configuration } from "../configSchema";
import { listConfigurations, saveConfiguration, SavedConfiguration } from "./api";
import "./ConfigurationsMenu.css";

export interface ConfigurationsMenuProps {
  /** Saved configurations belong to a user, so the menu is only usable when signed in. */
  user: AuthUser | null;
  /** The dataset the configurations are for. */
  datasetId: string;
  /** Reads the configuration on screen right now (symbology and table columns). */
  getCurrent: () => Configuration;
  /** Called when the user picks a saved configuration to open. */
  onOpen: (saved: SavedConfiguration) => void;
}

const MAX_NAME_LENGTH = 100;

/**
 * Fixed top-right button (left of the symbology button). Opens a popover where a signed-in user
 * can save what is on screen under a name and reopen any of their saved configurations.
 */
export default function ConfigurationsMenu({ user, datasetId, getCurrent, onOpen }: ConfigurationsMenuProps) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<SavedConfiguration[]>([]);
  const [name, setName] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // The popover anchors to (and is toggled by) this button; kept in state so the popover re-renders once it exists.
  const [button, setButton] = useState<HTMLElement | null>(null);

  // Load the user's configurations on sign-in; forget them on sign-out.
  const userId = user?.id;
  useEffect(() => {
    setSaved([]);
    setActiveId(null);
    setLoadError(null);
    if (!userId) return;
    let cancelled = false;
    listConfigurations(datasetId).then(
      (rows) => !cancelled && setSaved(rows),
      (err) => !cancelled && setLoadError(err instanceof Error ? err.message : "Couldn't load your configurations."),
    );
    return () => {
      cancelled = true;
    };
  }, [userId, datasetId]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (saving || !trimmed) return;
    setSaving(true);
    setSaveError(null);
    try {
      const created = await saveConfiguration(datasetId, trimmed, getCurrent());
      setSaved((rows) => [created, ...rows]);
      setActiveId(created.id);
      setName("");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save the configuration.");
    } finally {
      setSaving(false);
    }
  }

  function handleOpen(item: SavedConfiguration) {
    setActiveId(item.id);
    onOpen(item);
    setOpen(false);
  }

  return (
    <div className="configurations">
      <calcite-button
        ref={setButton}
        round
        icon-start="folder-open"
        kind={open ? "brand" : "neutral"}
        label="Saved configurations"
        title="Saved configurations"
      />

      <calcite-popover
        referenceElement={button ?? ""}
        open={open}
        autoClose
        placement="bottom-end"
        overlayPositioning="fixed"
        label="Saved configurations"
        oncalcitePopoverOpen={() => setOpen(true)}
        oncalcitePopoverClose={() => setOpen(false)}
      >
        <div className="configurations__panel">
          <h2 className="configurations__title">Configurations</h2>

          {!user ? (
            <calcite-notice open kind="neutral" scale="s" width="full" icon>
              <div slot="message">Sign in to save and open your configurations.</div>
            </calcite-notice>
          ) : (
            <>
              <form className="configurations__save" onSubmit={handleSave}>
                <calcite-input-text
                  label-text="Save current map and table as"
                  placeholder="Configuration name"
                  maxLength={MAX_NAME_LENGTH}
                  required
                  value={name}
                  oncalciteInputTextInput={(e) => setName(e.target.value)}
                />
                <calcite-button
                  type="submit"
                  width="full"
                  loading={saving}
                  disabled={saving || name.trim() === ""}
                >
                  {saving ? "Saving…" : "Save configuration"}
                </calcite-button>
                {saveError && (
                  <calcite-notice open kind="danger" scale="s" width="full" icon role="alert">
                    <div slot="message">{saveError}</div>
                  </calcite-notice>
                )}
              </form>

              {loadError && (
                <calcite-notice open kind="danger" scale="s" width="full" icon role="alert">
                  <div slot="message">{loadError}</div>
                </calcite-notice>
              )}
              {saved.length === 0 && !loadError ? (
                <calcite-notice open kind="neutral" scale="s" width="full">
                  <div slot="message">You haven't saved any configurations yet.</div>
                </calcite-notice>
              ) : (
                <calcite-list label="Your saved configurations" selection-mode="none">
                  {saved.map((item) => (
                    <calcite-list-item
                      key={item.id}
                      label={item.name}
                      description={`Saved ${new Date(item.createdAt).toLocaleString()}`}
                      icon-start={item.id === activeId ? "check" : undefined}
                      oncalciteListItemSelect={() => handleOpen(item)}
                    />
                  ))}
                </calcite-list>
              )}
            </>
          )}
        </div>
      </calcite-popover>
    </div>
  );
}
