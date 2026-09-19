"use client";

import { useEffect, useMemo, useState } from "react";
import { useSkin } from "@/hooks/useSkin";
import type { SkinColors, SkinDefinition, UpdateSkinInput } from "@/lib/skin-types";
import styles from "./SkinConfig.module.css";

const EDITABLE_COLORS: Array<{ key: keyof SkinColors; label: string }> = [
  { key: "bg", label: "Canvas" },
  { key: "panel", label: "Sidebar" },
  { key: "elevated", label: "Elevated surface" },
  { key: "hover", label: "Hover surface" },
  { key: "selected", label: "Selected surface" },
  { key: "border", label: "Borders" },
  { key: "text", label: "Primary text" },
  { key: "muted", label: "Secondary text" },
  { key: "dim", label: "Muted text" },
  { key: "accent", label: "Accent" },
  { key: "accentHover", label: "Accent hover" },
  { key: "userBubble", label: "User message" },
  { key: "toolSurface", label: "Tool surface" },
];

function copyDraft(skin: SkinDefinition): UpdateSkinInput {
  return {
    id: skin.id,
    name: skin.name,
    description: skin.description,
    family: skin.family,
    light: { ...skin.light },
    dark: { ...skin.dark },
    appearance: { ...skin.appearance },
  };
}

function SkinPreview({ skin }: { skin: SkinDefinition }) {
  const colors = skin.light;
  return (
    <div className={styles.preview} style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}>
      <div className={styles.previewSidebar} style={{ background: colors.panel, borderColor: colors.border }}>
        <span style={{ background: colors.accent }} />
        <span style={{ background: colors.muted }} />
        <span style={{ background: colors.dim }} />
      </div>
      <div className={styles.previewChat}>
        <div className={styles.previewAnswer}><i style={{ background: colors.text }} /><i style={{ background: colors.muted }} /></div>
        <div className={styles.previewBubble} style={{ background: colors.userBubble }} />
        <div className={styles.previewComposer} style={{ background: colors.elevated, borderColor: colors.border, borderRadius: skin.appearance.composerRadius / 2 }}>
          <span style={{ background: colors.dim }} />
          <b style={{ background: colors.accent }} />
        </div>
      </div>
    </div>
  );
}

export function SkinConfig() {
  const { skins, activeSkinId, createSkin, updateSkin, deleteSkin, applySkin } = useSkin();
  const [selectedId, setSelectedId] = useState<string>(activeSkinId);
  const [draft, setDraft] = useState<UpdateSkinInput | null>(null);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => skins.find((skin) => skin.id === selectedId) ?? skins.find((skin) => skin.id === activeSkinId) ?? skins[0] ?? null,
    [activeSkinId, selectedId, skins],
  );

  useEffect(() => {
    if (selected) {
      setSelectedId(selected.id);
      setDraft(copyDraft(selected));
    }
  }, [selected]);

  const run = async (label: string, operation: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await operation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  };

  const duplicate = () => {
    if (!selected) return;
    void run("create", async () => {
      const state = await createSkin({
        name: `${selected.name} Copy`.slice(0, 48),
        description: `Custom skin based on ${selected.name}.`,
        sourceId: selected.id,
      });
      const created = state.skins.find((skin) => !skins.some((previous) => previous.id === skin.id));
      if (created) setSelectedId(created.id);
    });
  };

  const save = () => {
    if (!draft || selected?.builtin) return;
    void run("save", async () => {
      await updateSkin(draft);
    });
  };

  const remove = () => {
    if (!selected || selected.builtin) return;
    if (!window.confirm(`Delete skin “${selected.name}”? This cannot be undone.`)) return;
    void run("delete", async () => {
      await deleteSkin(selected.id);
      setSelectedId(activeSkinId === selected.id ? "classic" : activeSkinId);
    });
  };

  if (!selected || !draft) {
    return <div className={styles.loading}>Loading skins…</div>;
  }

  const colors = draft[mode];
  const updateColor = (key: keyof SkinColors, value: string) => {
    setDraft((current) => current ? { ...current, [mode]: { ...current[mode], [key]: value } } : current);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Interface skins</div>
          <h2>Skins</h2>
          <p>Switch the complete visual language without reloading. Built-ins stay immutable; duplicate either one to create an editable skin.</p>
        </div>
        <button className={styles.newButton} type="button" onClick={duplicate} disabled={Boolean(busy)}>+ Duplicate selected</button>
      </header>

      {error && <div className={styles.error} role="alert">{error}</div>}

      <div className={styles.layout}>
        <aside className={styles.gallery} aria-label="Available skins">
          {skins.map((skin) => (
            <button
              key={skin.id}
              type="button"
              className={styles.skinCard}
              data-selected={skin.id === selected.id}
              data-active={skin.id === activeSkinId}
              onClick={() => setSelectedId(skin.id)}
            >
              <SkinPreview skin={skin} />
              <span className={styles.cardText}>
                <strong>{skin.name}</strong>
                <small>{skin.builtin ? "Built-in" : "Custom"} · {skin.family === "dsh" ? "DSH foundation" : "Classic foundation"}</small>
              </span>
              {skin.id === activeSkinId && <span className={styles.activeBadge}>Active</span>}
            </button>
          ))}
        </aside>

        <section className={styles.editor}>
          <div className={styles.editorHeader}>
            <div>
              <span className={styles.statusDot} data-active={selected.id === activeSkinId} />
              <span>{selected.id === activeSkinId ? "Currently applied" : "Ready to apply"}</span>
            </div>
            <button
              type="button"
              className={styles.applyButton}
              disabled={selected.id === activeSkinId || Boolean(busy)}
              onClick={() => void run("apply", () => applySkin(selected.id))}
            >
              {busy === "apply" ? "Applying…" : selected.id === activeSkinId ? "Applied" : "Apply skin"}
            </button>
          </div>

          <SkinPreview skin={{ ...selected, ...draft, builtin: selected.builtin, paletteMode: selected.paletteMode }} />

          <div className={styles.formGrid}>
            <label>
              <span>Name</span>
              <input value={draft.name} readOnly={selected.builtin} maxLength={48} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </label>
            <label>
              <span>Foundation</span>
              <select value={draft.family} disabled={selected.builtin} onChange={(event) => setDraft({ ...draft, family: event.target.value as UpdateSkinInput["family"] })}>
                <option value="classic">OMP Classic</option>
                <option value="dsh">DSH</option>
              </select>
            </label>
            <label className={styles.fullWidth}>
              <span>Description</span>
              <input value={draft.description} readOnly={selected.builtin} maxLength={180} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
            </label>
          </div>

          <div className={styles.sectionHeader}>
            <div><strong>Color system</strong><span>Six-digit hex values only</span></div>
            <div className={styles.modeToggle}>
              <button type="button" data-active={mode === "light"} onClick={() => setMode("light")}>Light</button>
              <button type="button" data-active={mode === "dark"} onClick={() => setMode("dark")}>Dark</button>
            </div>
          </div>
          <div className={styles.colorGrid}>
            {EDITABLE_COLORS.map(({ key, label }) => (
              <label className={styles.colorField} key={key}>
                <span>{label}</span>
                <div>
                  <input type="color" value={colors[key]} disabled={selected.builtin} onChange={(event) => updateColor(key, event.target.value)} />
                  <input value={colors[key]} readOnly={selected.builtin} maxLength={7} onChange={(event) => updateColor(key, event.target.value)} />
                </div>
              </label>
            ))}
          </div>

          <div className={styles.sectionHeader}><div><strong>Shape and elevation</strong><span>Foundation-aware component geometry</span></div></div>
          <div className={styles.rangeGrid}>
            {([
              ["controlRadius", "Controls", 0, 32],
              ["panelRadius", "Panels", 0, 40],
              ["bubbleRadius", "Messages", 0, 40],
              ["composerRadius", "Composer", 0, 40],
            ] as const).map(([key, label, min, max]) => (
              <label key={key}><span>{label}<b>{draft.appearance[key]}px</b></span><input type="range" min={min} max={max} value={draft.appearance[key]} disabled={selected.builtin} onChange={(event) => setDraft({ ...draft, appearance: { ...draft.appearance, [key]: Number(event.target.value) } })} /></label>
            ))}
            <label><span>Shadow<b>{Math.round(draft.appearance.shadowStrength * 100)}%</b></span><input type="range" min="0" max="1" step="0.05" value={draft.appearance.shadowStrength} disabled={selected.builtin} onChange={(event) => setDraft({ ...draft, appearance: { ...draft.appearance, shadowStrength: Number(event.target.value) } })} /></label>
            <label><span>Density<b>{Math.round(draft.appearance.density * 100)}%</b></span><input type="range" min="0.8" max="1.2" step="0.05" value={draft.appearance.density} disabled={selected.builtin} onChange={(event) => setDraft({ ...draft, appearance: { ...draft.appearance, density: Number(event.target.value) } })} /></label>
          </div>

          <footer className={styles.actions}>
            {selected.builtin ? <span>Built-in skins are protected. Duplicate to customize.</span> : <button type="button" className={styles.deleteButton} disabled={Boolean(busy)} onClick={remove}>Delete skin</button>}
            {!selected.builtin && <button type="button" className={styles.saveButton} disabled={Boolean(busy) || !draft.name.trim()} onClick={save}>{busy === "save" ? "Saving…" : "Save changes"}</button>}
          </footer>
        </section>
      </div>
    </div>
  );
}
