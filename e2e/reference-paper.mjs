// Run against an existing dev server: node e2e/reference-paper.mjs
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30141";
await mkdir("test-results/reference-paper", { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "en-US", colorScheme: "dark", reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route(/\/api\/sessions(?:\?.*)?$/, (route) => route.fulfill({ json: { sessions: [] } }));
    await page.goto(base);
    await page.getByText("No sessions found", { exact: true }).waitFor({ state: "attached" });
    const openSettings = async () => {
      const sidebar = page.getByRole("button", { name: "Show sidebar", exact: true });
      if (await sidebar.isVisible()) await sidebar.click();
      await page.getByRole("button", { name: "Settings", exact: true }).click();
    };
    await openSettings();
    const paper = page.getByRole("radio", { name: "Reference Paper", exact: true });
    await paper.locator("..").click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === "reference-paper");
    assert.equal(await paper.isChecked(), true);
    assert.deepEqual(await page.evaluate(() => {
      const root = document.documentElement;
      const style = getComputedStyle(root);
      return {
        stored: localStorage.getItem("pi-theme"), dark: root.classList.contains("dark"), scheme: style.colorScheme,
        colors: Object.fromEntries(["bg", "bg-panel", "text", "text-muted", "text-dim", "accent", "border", "user-bg", "tool-bg"].map((key) => [key, style.getPropertyValue(`--${key}`).trim().replace(/^#([\da-f])([\da-f])([\da-f])$/, "#$1$1$2$2$3$3")])),
      };
    }), {
      stored: "reference-paper", dark: false, scheme: "light",
      colors: { bg: "#ffffff", "bg-panel": "#fafafa", text: "#262626", "text-muted": "#737373", "text-dim": "#a3a3a3", accent: "#171717", border: "#d4d4d4", "user-bg": "#ffffff", "tool-bg": "#ffffff" },
    });
    assert.equal(await paper.locator("..").evaluate((option) => option.scrollWidth <= option.clientWidth), true);
    await page.screenshot({ path: `test-results/reference-paper/settings-${width}.png` });
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.theme === "reference-paper");
    await openSettings();
    assert.equal(await paper.isChecked(), true);
    await page.emulateMedia({ colorScheme: "light" });
    assert.equal(await page.locator("html").getAttribute("data-theme"), "reference-paper");
    // Check real stylesheet selectors, independent of any user's chat history.
    const sample = await page.evaluate(() => {
      const el = document.createElement("div");
      el.className = "markdown-body";
      el.innerHTML = '<h3>Heading</h3><a>Link</a><code class="markdown-inline-code">code</code><blockquote>Quote</blockquote><hr><mark>Search</mark>';
      document.body.append(el);
      const styles = [...el.children].map((child) => { const s = getComputedStyle(child); return [s.color, s.backgroundColor, s.borderLeftColor]; });
      el.remove();
      return styles;
    });
    assert.equal(sample[0][0], "rgb(23, 23, 23)");
    assert.equal(sample[1][0], "rgb(38, 38, 38)");
    assert.equal(sample[2][0], "rgb(23, 23, 23)");
    assert.equal(sample[3][0], "rgb(115, 115, 115)");
    assert.equal(sample[3][2], "rgb(212, 212, 212)");
    assert.equal(sample[4][1], "rgb(229, 229, 229)");
    assert.equal(sample[5][1], "rgb(212, 212, 212)");
    await page.getByRole("radio", { name: "Light", exact: true }).locator("..").click();
    assert.equal(await page.locator("html").evaluate((root) => getComputedStyle(root).getPropertyValue("--tool-title").trim()), "", "Paper-only tokens must not leak into other palettes");
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px: exact palette, selection, persistence, system independence, Markdown, no token leaks`);
    await context.close();
  }
} finally {
  await browser.close();
}
