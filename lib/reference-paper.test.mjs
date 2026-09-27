import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { referencePaperSyntax } from "./reference-paper-syntax.ts";
import { THEME_OPTIONS, isDarkTheme, isThemePreference } from "./theme.ts";

const reference = JSON.parse(await readFile(new URL("./fixtures/reference-paper.json", import.meta.url), "utf8"));
const css = await readFile(new URL("../app/reference-paper.css", import.meta.url), "utf8");
const resolve = (role) => reference.vars[reference.colors[role]] ?? reference.colors[role];

test("Reference Paper is a selectable light palette with all locale labels", async () => {
  assert.ok(isThemePreference("reference-paper"));
  assert.equal(isDarkTheme("reference-paper"), false);
  const option = THEME_OPTIONS.find(({ id }) => id === "reference-paper");
  for (const locale of ["en", "zh-CN", "zh-TW"]) {
    const source = await readFile(new URL(`./i18n/messages/${locale}.ts`, import.meta.url), "utf8");
    assert.ok(source.includes(`"${option.label}"`));
  }
});

test("web surfaces and semantic roles retain the original exact palette", () => {
  const tokens = Object.fromEntries([...css.matchAll(/--([\w-]+): (#[\da-f]{6});/g)].map((m) => [m[1], m[2]]));
  const roles = {
    text: "text", "text-muted": "muted", "text-dim": "dim", accent: "accent", border: "border",
    "bg-selected": "selectedBg", "user-bg": "userMessageBg", "tool-bg": "toolPendingBg",
    "status-success": "success", "status-error": "error", "status-warning": "warning",
    "tool-title": "toolTitle", "tool-output": "toolOutput",
    "diff-added": "toolDiffAdded", "diff-removed": "toolDiffRemoved", "diff-context": "toolDiffContext",
    "thinking-active": "thinkingText", "custom-message-bg": "customMessageBg", "custom-message-label": "customMessageLabel",
  };
  for (const [token, role] of Object.entries(roles)) assert.equal(tokens[token], resolve(role), role);
  assert.equal(tokens.bg, reference.export.pageBg);
  assert.equal(tokens["assistant-bg"], reference.export.cardBg);
  assert.equal(tokens["bg-panel"], reference.export.infoBg);
  for (const value of Object.values(tokens)) assert.ok(Object.values(reference.vars).includes(value));
});

test("Prism syntax categories match the reference instead of the colored VS theme", () => {
  for (const [token, role] of Object.entries({
    comment: "syntaxComment", keyword: "syntaxKeyword", function: "syntaxFunction",
    variable: "syntaxVariable", string: "syntaxString", number: "syntaxNumber",
    "class-name": "syntaxType", operator: "syntaxOperator", punctuation: "syntaxPunctuation",
    inserted: "toolDiffAdded", deleted: "toolDiffRemoved",
  })) assert.equal(referencePaperSyntax[token].color, resolve(role));
  for (const style of Object.values(referencePaperSyntax)) {
    if (style.color) assert.ok(Object.values(reference.vars).includes(style.color));
  }
});
