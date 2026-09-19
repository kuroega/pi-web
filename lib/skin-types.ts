export type SkinFamily = "classic" | "dsh";
export type SkinPaletteMode = "omp" | "fixed";

export interface SkinColors {
  bg: string;
  panel: string;
  elevated: string;
  hover: string;
  selected: string;
  border: string;
  text: string;
  muted: string;
  dim: string;
  accent: string;
  accentHover: string;
  userBubble: string;
  toolSurface: string;
  success: string;
  danger: string;
  warning: string;
}

export interface SkinAppearance {
  fontFamily: string;
  codeFontFamily: string;
  controlRadius: number;
  panelRadius: number;
  bubbleRadius: number;
  composerRadius: number;
  shadowStrength: number;
  density: number;
}

export interface SkinDefinition {
  id: string;
  name: string;
  description: string;
  family: SkinFamily;
  paletteMode: SkinPaletteMode;
  builtin: boolean;
  light: SkinColors;
  dark: SkinColors;
  appearance: SkinAppearance;
}

export interface SkinStateResponse {
  activeSkinId: string;
  skins: SkinDefinition[];
}

export interface CreateSkinInput {
  name: string;
  description?: string;
  sourceId: string;
}

export interface UpdateSkinInput {
  id: string;
  name: string;
  description: string;
  family: SkinFamily;
  light: SkinColors;
  dark: SkinColors;
  appearance: SkinAppearance;
}

export const SKIN_COLOR_KEYS = [
  "bg",
  "panel",
  "elevated",
  "hover",
  "selected",
  "border",
  "text",
  "muted",
  "dim",
  "accent",
  "accentHover",
  "userBubble",
  "toolSurface",
  "success",
  "danger",
  "warning",
] as const satisfies readonly (keyof SkinColors)[];
