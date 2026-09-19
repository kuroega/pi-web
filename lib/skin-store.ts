import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { resolveAgentDir } from "@/bin/web-auth-store.js";
import { writePrivateFileAtomicSync } from "@/lib/atomic-file";
import type {
  CreateSkinInput,
  SkinAppearance,
  SkinColors,
  SkinDefinition,
  SkinFamily,
  SkinStateResponse,
  UpdateSkinInput,
} from "@/lib/skin-types";
import { SKIN_COLOR_KEYS } from "@/lib/skin-types";

const SKIN_FILE = "omp-web-skins.json";
const SKIN_DOCUMENT_VERSION = 1;
const MAX_SKIN_FILE_BYTES = 256 * 1024;
const MAX_CUSTOM_SKINS = 64;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

interface SkinDocument {
  version: typeof SKIN_DOCUMENT_VERSION;
  activeSkinId: string;
  skins: SkinDefinition[];
}

const CLASSIC_LIGHT: SkinColors = {
  bg: "#ffffff",
  panel: "#f8f8f8",
  elevated: "#ffffff",
  hover: "#eeeeee",
  selected: "#d0d0e0",
  border: "#d8dbe0",
  text: "#1a1d23",
  muted: "#6c6c6c",
  dim: "#949aa4",
  accent: "#0082b3",
  accentHover: "#00b4ff",
  userBubble: "#eef2f6",
  toolSurface: "#f4f6f8",
  success: "#1f8b4c",
  danger: "#aa5555",
  warning: "#9a7326",
};

const CLASSIC_DARK: SkinColors = {
  bg: "#151820",
  panel: "#0f1216",
  elevated: "#1f252d",
  hover: "#1f252d",
  selected: "#1c2b38",
  border: "#2a3038",
  text: "#e8ecf4",
  muted: "#9ca3b0",
  dim: "#6b7280",
  accent: "#00b4ff",
  accentHover: "#4fcdff",
  userBubble: "#0f1216",
  toolSurface: "#0f1216",
  success: "#00ff88",
  danger: "#ff4757",
  warning: "#ffb347",
};

const DSH_LIGHT: SkinColors = {
  bg: "#ffffff",
  panel: "#f9fafb",
  elevated: "#ffffff",
  hover: "#f1f3f5",
  selected: "#ebf0fa",
  border: "#e1e5ee",
  text: "#0f1115",
  muted: "#61666b",
  dim: "#81858c",
  accent: "#4176e6",
  accentHover: "#5686fe",
  userBubble: "#edf3fe",
  toolSurface: "#f9fafb",
  success: "#22c55e",
  danger: "#ec1313",
  warning: "#dd8629",
};

const DSH_DARK: SkinColors = {
  bg: "#151517",
  panel: "#1b1b1c",
  elevated: "#2c2c2e",
  hover: "#232324",
  selected: "#353638",
  border: "#43454a",
  text: "#f9fafb",
  muted: "#cfd3d6",
  dim: "#adb2b8",
  accent: "#679efe",
  accentHover: "#4176e6",
  userBubble: "#2c2c2e",
  toolSurface: "#232324",
  success: "#22c55e",
  danger: "#f25a5a",
  warning: "#f7ad31",
};

const SYSTEM_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const CODE_FONT = "'SF Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, 'Liberation Mono', Menlo, 'PingFang SC', 'Microsoft YaHei', monospace";

const BUILTIN_SKINS: readonly SkinDefinition[] = [
  {
    id: "classic",
    name: "OMP Classic",
    description: "The original omp-web interface, using omp's configured light and dark palettes.",
    family: "classic",
    paletteMode: "omp",
    builtin: true,
    light: CLASSIC_LIGHT,
    dark: CLASSIC_DARK,
    appearance: {
      fontFamily: SYSTEM_FONT,
      codeFontFamily: CODE_FONT,
      controlRadius: 7,
      panelRadius: 10,
      bubbleRadius: 12,
      composerRadius: 14,
      shadowStrength: 0.55,
      density: 1,
    },
  },
  {
    id: "dsh",
    name: "DSH",
    description: "A deep port of the DeepSeek Harness Web UI: bluish neutrals, capsule composer, soft elevation, and fluid motion.",
    family: "dsh",
    paletteMode: "fixed",
    builtin: true,
    light: DSH_LIGHT,
    dark: DSH_DARK,
    appearance: {
      fontFamily: SYSTEM_FONT,
      codeFontFamily: CODE_FONT,
      controlRadius: 12,
      panelRadius: 20,
      bubbleRadius: 22,
      composerRadius: 22,
      shadowStrength: 0.38,
      density: 1,
    },
  },
];

function skinFilePath(agentDir: string): string {
  return join(agentDir, SKIN_FILE);
}

function cloneSkin(skin: SkinDefinition): SkinDefinition {
  return {
    ...skin,
    light: { ...skin.light },
    dark: { ...skin.dark },
    appearance: { ...skin.appearance },
  };
}

function requireText(value: unknown, label: string, maxLength: number, allowEmpty = false): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const normalized = value.trim();
  if (!allowEmpty && !normalized) throw new Error(`${label} is required`);
  if (normalized.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer`);
  return normalized;
}

function requireFamily(value: unknown): SkinFamily {
  if (value !== "classic" && value !== "dsh") throw new Error("Unknown skin family");
  return value;
}

function requireColors(value: unknown, label: string): SkinColors {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} colors are required`);
  const record = value as Record<string, unknown>;
  const result = {} as SkinColors;
  for (const key of SKIN_COLOR_KEYS) {
    const color = record[key];
    if (typeof color !== "string" || !HEX_COLOR.test(color)) {
      throw new Error(`${label}.${key} must be a six-digit hex color`);
    }
    result[key] = color.toLowerCase();
  }
  return result;
}

function requireNumber(value: unknown, label: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}`);
  }
  return Math.round(value * 100) / 100;
}

function requireAppearance(value: unknown): SkinAppearance {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Skin appearance is required");
  const record = value as Record<string, unknown>;
  return {
    fontFamily: requireText(record.fontFamily, "Font family", 300),
    codeFontFamily: requireText(record.codeFontFamily, "Code font family", 300),
    controlRadius: requireNumber(record.controlRadius, "Control radius", 0, 32),
    panelRadius: requireNumber(record.panelRadius, "Panel radius", 0, 40),
    bubbleRadius: requireNumber(record.bubbleRadius, "Bubble radius", 0, 40),
    composerRadius: requireNumber(record.composerRadius, "Composer radius", 0, 40),
    shadowStrength: requireNumber(record.shadowStrength, "Shadow strength", 0, 1),
    density: requireNumber(record.density, "Density", 0.8, 1.2),
  };
}

function normalizeCustomSkin(value: unknown): SkinDefinition {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Skin must be an object");
  const record = value as Record<string, unknown>;
  const id = requireText(record.id, "Skin id", 80);
  if (!/^custom-[0-9a-f-]{36}$/i.test(id)) throw new Error("Custom skin id is invalid");
  return {
    id,
    name: requireText(record.name, "Skin name", 48),
    description: requireText(record.description, "Description", 180, true),
    family: requireFamily(record.family),
    paletteMode: "fixed",
    builtin: false,
    light: requireColors(record.light, "Light"),
    dark: requireColors(record.dark, "Dark"),
    appearance: requireAppearance(record.appearance),
  };
}

function defaultDocument(): SkinDocument {
  return { version: SKIN_DOCUMENT_VERSION, activeSkinId: "classic", skins: [] };
}

function readDocument(agentDir: string): SkinDocument {
  const path = skinFilePath(agentDir);
  if (!existsSync(path)) return defaultDocument();
  if (statSync(path).size > MAX_SKIN_FILE_BYTES) throw new Error("Skin repository is too large");
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  if (parsed.version !== SKIN_DOCUMENT_VERSION) throw new Error("Unsupported skin repository version");
  const skins = Array.isArray(parsed.skins) ? parsed.skins.map(normalizeCustomSkin) : [];
  if (skins.length > MAX_CUSTOM_SKINS) throw new Error(`Skin repository supports at most ${MAX_CUSTOM_SKINS} custom skins`);
  const activeSkinId = typeof parsed.activeSkinId === "string" ? parsed.activeSkinId : "classic";
  const known = BUILTIN_SKINS.some((skin) => skin.id === activeSkinId) || skins.some((skin) => skin.id === activeSkinId);
  return { version: SKIN_DOCUMENT_VERSION, activeSkinId: known ? activeSkinId : "classic", skins };
}

function writeDocument(agentDir: string, document: SkinDocument): void {
  mkdirSync(agentDir, { recursive: true });
  writePrivateFileAtomicSync(skinFilePath(agentDir), `${JSON.stringify(document, null, 2)}\n`);
}

function stateFromDocument(document: SkinDocument): SkinStateResponse {
  return {
    activeSkinId: document.activeSkinId,
    skins: [...BUILTIN_SKINS.map(cloneSkin), ...document.skins.map(cloneSkin)],
  };
}

export function readSkinState(agentDir = resolveAgentDir()): SkinStateResponse {
  return stateFromDocument(readDocument(agentDir));
}

export function createSkin(input: CreateSkinInput, agentDir = resolveAgentDir()): SkinStateResponse {
  const document = readDocument(agentDir);
  if (document.skins.length >= MAX_CUSTOM_SKINS) throw new Error(`Skin repository supports at most ${MAX_CUSTOM_SKINS} custom skins`);
  const source = stateFromDocument(document).skins.find((skin) => skin.id === input.sourceId);
  if (!source) throw new Error("Source skin not found");
  const skin: SkinDefinition = {
    ...cloneSkin(source),
    id: `custom-${randomUUID()}`,
    name: requireText(input.name, "Skin name", 48),
    description: requireText(input.description ?? "", "Description", 180, true),
    paletteMode: "fixed",
    builtin: false,
  };
  document.skins.push(skin);
  writeDocument(agentDir, document);
  return stateFromDocument(document);
}

export function updateSkin(input: UpdateSkinInput, agentDir = resolveAgentDir()): SkinStateResponse {
  const document = readDocument(agentDir);
  const index = document.skins.findIndex((skin) => skin.id === input.id);
  if (index < 0) {
    if (BUILTIN_SKINS.some((skin) => skin.id === input.id)) throw new Error("Built-in skins are read-only");
    throw new Error("Skin not found");
  }
  document.skins[index] = normalizeCustomSkin({ ...input, paletteMode: "fixed", builtin: false });
  writeDocument(agentDir, document);
  return stateFromDocument(document);
}

export function deleteSkin(id: string, agentDir = resolveAgentDir()): SkinStateResponse {
  if (BUILTIN_SKINS.some((skin) => skin.id === id)) throw new Error("Built-in skins cannot be deleted");
  const document = readDocument(agentDir);
  const next = document.skins.filter((skin) => skin.id !== id);
  if (next.length === document.skins.length) throw new Error("Skin not found");
  document.skins = next;
  if (document.activeSkinId === id) document.activeSkinId = "classic";
  writeDocument(agentDir, document);
  return stateFromDocument(document);
}

export function applySkin(id: string, agentDir = resolveAgentDir()): SkinStateResponse {
  const document = readDocument(agentDir);
  const state = stateFromDocument(document);
  if (!state.skins.some((skin) => skin.id === id)) throw new Error("Skin not found");
  document.activeSkinId = id;
  writeDocument(agentDir, document);
  return stateFromDocument(document);
}
