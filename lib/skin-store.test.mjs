import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  applySkin,
  createSkin,
  deleteSkin,
  readSkinState,
  updateSkin,
} from "./skin-store.ts";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "omp-web-skins-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test("ships classic and DSH skins and defaults to classic", (t) => {
  const agentDir = fixture(t);
  const state = readSkinState(agentDir);
  assert.equal(state.activeSkinId, "classic");
  assert.deepEqual(state.skins.map((skin) => skin.id), ["classic", "dsh"]);
  assert.equal(state.skins.find((skin) => skin.id === "dsh")?.family, "dsh");
});

test("creates, edits, applies, and deletes a durable custom skin", (t) => {
  const agentDir = fixture(t);
  let state = createSkin({ name: "Ocean", description: "Cool tones", sourceId: "dsh" }, agentDir);
  const created = state.skins.find((skin) => skin.name === "Ocean");
  assert.ok(created);
  assert.equal(created.builtin, false);
  assert.equal(created.family, "dsh");

  state = updateSkin({
    ...created,
    name: "Ocean Night",
    description: "Edited",
    dark: { ...created.dark, accent: "#123456" },
  }, agentDir);
  const edited = state.skins.find((skin) => skin.id === created.id);
  assert.equal(edited?.name, "Ocean Night");
  assert.equal(edited?.dark.accent, "#123456");

  state = applySkin(created.id, agentDir);
  assert.equal(state.activeSkinId, created.id);
  assert.equal(JSON.parse(readFileSync(join(agentDir, "omp-web-skins.json"), "utf8")).activeSkinId, created.id);

  state = deleteSkin(created.id, agentDir);
  assert.equal(state.activeSkinId, "classic");
  assert.equal(state.skins.some((skin) => skin.id === created.id), false);
});

test("protects built-ins and rejects unsafe color values", (t) => {
  const agentDir = fixture(t);
  assert.throws(() => deleteSkin("dsh", agentDir), /Built-in skins cannot be deleted/);
  const created = createSkin({ name: "Custom", sourceId: "dsh" }, agentDir).skins.at(-1);
  assert.ok(created);
  assert.throws(() => updateSkin({
    ...created,
    light: { ...created.light, accent: "url(https://example.com)" },
  }, agentDir), /six-digit hex color/);
});
