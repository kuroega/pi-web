"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { CreateSkinInput, SkinDefinition, SkinStateResponse, UpdateSkinInput } from "@/lib/skin-types";
import { SKIN_COLOR_KEYS } from "@/lib/skin-types";

const CACHE_KEY = "omp-ui-skin";
const listeners = new Set<() => void>();
let snapshot: SkinStateResponse = { activeSkinId: "classic", skins: [] };
let loadingPromise: Promise<SkinStateResponse> | null = null;

function emit(): void {
  listeners.forEach((listener) => listener());
}

function cssTokenName(mode: "light" | "dark", key: string): string {
  return `--skin-${mode}-${key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`;
}

export function applySkinToDocument(skin: SkinDefinition): void {
  const root = document.documentElement;
  root.dataset.ompSkin = skin.id;
  root.dataset.ompSkinFamily = skin.family;
  root.dataset.ompSkinPalette = skin.paletteMode;
  for (const mode of ["light", "dark"] as const) {
    for (const key of SKIN_COLOR_KEYS) root.style.setProperty(cssTokenName(mode, key), skin[mode][key]);
  }
  root.style.setProperty("--skin-font-family", skin.appearance.fontFamily);
  root.style.setProperty("--skin-code-font-family", skin.appearance.codeFontFamily);
  root.style.setProperty("--skin-control-radius", `${skin.appearance.controlRadius}px`);
  root.style.setProperty("--skin-panel-radius", `${skin.appearance.panelRadius}px`);
  root.style.setProperty("--skin-bubble-radius", `${skin.appearance.bubbleRadius}px`);
  root.style.setProperty("--skin-composer-radius", `${skin.appearance.composerRadius}px`);
  root.style.setProperty("--skin-shadow-strength", String(skin.appearance.shadowStrength));
  root.style.setProperty("--skin-density", String(skin.appearance.density));
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(skin));
  } catch {
    // The live DOM state still applies when browser storage is unavailable.
  }
}

function applyActiveSkin(state: SkinStateResponse): void {
  const active = state.skins.find((skin) => skin.id === state.activeSkinId);
  if (active) applySkinToDocument(active);
}

function acceptState(state: SkinStateResponse): SkinStateResponse {
  snapshot = state;
  applyActiveSkin(state);
  emit();
  return state;
}

async function requestState(method = "GET", body?: unknown, query = ""): Promise<SkinStateResponse> {
  const response = await fetch(`/api/skins${query}`, {
    method,
    cache: "no-store",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json() as SkinStateResponse & { error?: string };
  if (!response.ok || result.error) throw new Error(result.error ?? `Skin request failed (${response.status})`);
  return acceptState(result);
}

export function refreshSkins(): Promise<SkinStateResponse> {
  loadingPromise ??= requestState().finally(() => { loadingPromise = null; });
  return loadingPromise;
}

export function useSkin() {
  const state = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => snapshot,
    () => snapshot,
  );

  useEffect(() => {
    if (snapshot.skins.length === 0) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as SkinDefinition | null;
        if (cached?.id) applySkinToDocument(cached);
      } catch {
        // The server response below remains authoritative.
      }
    }
    void refreshSkins().catch(() => undefined);
  }, []);

  const create = useCallback((input: CreateSkinInput) => requestState("POST", input), []);
  const update = useCallback((input: UpdateSkinInput) => requestState("PUT", input), []);
  const remove = useCallback((id: string) => requestState("DELETE", undefined, `?id=${encodeURIComponent(id)}`), []);
  const apply = useCallback(async (id: string) => {
    const skin = snapshot.skins.find((candidate) => candidate.id === id);
    if (!skin) throw new Error("Skin not found");
    const previous = snapshot;
    snapshot = { ...snapshot, activeSkinId: id };
    applySkinToDocument(skin);
    emit();
    try {
      return await requestState("PATCH", { id });
    } catch (error) {
      snapshot = previous;
      applyActiveSkin(previous);
      emit();
      throw error;
    }
  }, []);

  return {
    ...state,
    activeSkin: state.skins.find((skin) => skin.id === state.activeSkinId) ?? null,
    createSkin: create,
    updateSkin: update,
    deleteSkin: remove,
    applySkin: apply,
    refreshSkins,
  };
}
