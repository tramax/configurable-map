import { SubmitEvent, useEffect, useState } from "react";
import "@esri/calcite-components/components/calcite-button";
import "@esri/calcite-components/components/calcite-input-text";
import "@esri/calcite-components/components/calcite-list";
import "@esri/calcite-components/components/calcite-list-item";
import "@esri/calcite-components/components/calcite-notice";
import "@esri/calcite-components/components/calcite-popover";
import "@esri/calcite-components/components/calcite-switch";
import type { AuthUser } from "../auth/api";
import type { Configuration } from "@contract/configuration.schema";
import { listConfigurations, saveConfiguration, SavedConfiguration, setPublished } from "./api";
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

/** The list is shown in these sections, in this order; every configuration falls in exactly one. */
const GROUPS: Array<{ title: string; include: (configuration: SavedConfiguration) => boolean }> = [
  { title: "My configurations", include: (configuration) => configuration.mine },
  { title: "Shared by others", include: (configuration) => !configuration.mine && configuration.visibility === "public" },
  { title: "Predefined", include: (configuration) => configuration.visibility === "system" },
];

function describe(item: SavedConfiguration): string {
  if (item.visibility === "system") return item.isDefault ? "Default configuration" : "Predefined configuration";
  if (!item.mine) return `By ${item.author} · created ${new Date(item.createdAt).toLocaleDateString()}`;
  const saved = `Saved ${new Date(item.createdAt).toLocaleString()}`;
  return item.visibility === "public" ? `${saved} · public` : saved;
}

/**
 * Fixed top-right button (left of the symbology button). Opens a popover where a signed-in user
 * can save what is on screen under a name and open any configuration they may see: their own,
 * ones shared by others, and the predefined ones.
 */
export default function ConfigurationsMenu({ user, datasetId, getCurrent, onOpen }: ConfigurationsMenuProps) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<SavedConfiguration[]>([]);
  const [name, setName] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // The popover anchors to (and is toggled by) this button; kept in state so the popover re-renders once it exists.
  const [button, setButton] = useState<HTMLElement | null>(null);

  // Load the user's configurations on sign-in; forget them on sign-out.
  const userId = user?.id;
  useEffect(() => {
    setSaved([]);
    setActiveId(null);
    setLoadError(null);
    setShareError(null);
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

  async function handleSave(e: SubmitEvent) {
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

  async function handleTogglePublished(item: SavedConfiguration, toggle: HTMLCalciteSwitchElement) {
    if (sharingId) return;
    setSharingId(item.id);
    setShareError(null);
    try {
      const updated = await setPublished(item.id, toggle.checked);
      setSaved((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      // The switch has already flipped itself; put it back, since nothing changed on the server.
      toggle.checked = item.visibility === "public";
      setShareError(err instanceof Error ? err.message : "Couldn't change whether it is public.");
    } finally {
      setSharingId(null);
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
              {shareError && (
                <calcite-notice open kind="danger" scale="s" width="full" icon role="alert">
                  <div slot="message">{shareError}</div>
                </calcite-notice>
              )}
              {saved.length === 0 && !loadError ? (
                <calcite-notice open kind="neutral" scale="s" width="full">
                  <div slot="message">You haven't saved any configurations yet.</div>
                </calcite-notice>
              ) : (
                GROUPS.map(({ title, include }) => {
                  const items = saved.filter(include);
                  if (items.length === 0) return null;
                  return (
                    <section key={title} className="configurations__group">
                      <h3 className="configurations__group-title">{title}</h3>
                      <div role="list" aria-label={title} className="configurations__rows">
                        {items.map((item) => (
                          // Two separate hover zones per row: the item (click to open) and, for the user's own
                          // configurations, the "Public" switch beside it. They are siblings, not nested, so
                          // hovering the switch does not highlight the item, and the other way round.
                          <div key={item.id} role="listitem" className="configurations__row">
                            <calcite-list selection-mode="none" label={item.name} className="configurations__open">
                              <calcite-list-item
                                label={item.name}
                                description={describe(item)}
                                icon-start={item.id === activeId ? "check" : undefined}
                                oncalciteListItemSelect={() => handleOpen(item)}
                              />
                            </calcite-list>
                            {item.mine && (
                              <label
                                className="configurations__public"
                                title="Public configurations can be opened by every signed-in user"
                              >
                                Public
                                <calcite-switch
                                  scale="s"
                                  label={`Make "${item.name}" public`}
                                  checked={item.visibility === "public"}
                                  disabled={sharingId !== null}
                                  oncalciteSwitchChange={(e) => handleTogglePublished(item, e.target)}
                                />
                              </label>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })
              )}
            </>
          )}
        </div>
      </calcite-popover>
    </div>
  );
}
