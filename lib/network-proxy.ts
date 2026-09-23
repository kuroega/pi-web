import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "@oh-my-pi/pi-coding-agent";
import { installGlobalProxyFetch, __resetGlobalProxyFetch } from "@oh-my-pi/pi-ai/utils/proxy";
import { writePrivateFileAtomicSync } from "./atomic-file";

const CONFIG_FILE = "omp-web-network.json";
const runtimeGlobal = globalThis as typeof globalThis & {
  __ompWebOriginalFetch?: typeof fetch;
  __ompWebOriginalPiProxy?: string;
  __ompWebOriginalHttpProxy?: string;
  __ompWebOriginalHttpsProxy?: string;
  __ompWebProxyUrl?: string | null;
};

export interface NetworkProxyConfig {
  proxy: string | null;
}

function configPath(): string {
  return join(getAgentDir(), CONFIG_FILE);
}

export function validateProxyUrl(value: unknown): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new Error("Proxy URL must be text");
  const proxy = value.trim();
  if (!proxy) return null;
  let url: URL;
  try {
    url = new URL(proxy);
  } catch {
    throw new Error("Proxy URL must be a valid http:// or https:// URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Proxy URL must use http:// or https://");
  }
  if (url.username || url.password || !url.hostname || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Proxy URL must contain only a host and optional port");
  }
  return url.toString().replace(/\/$/, "");
}

export function readNetworkProxy(): NetworkProxyConfig {
  try {
    const parsed = JSON.parse(readFileSync(configPath(), "utf8")) as { proxy?: unknown };
    return { proxy: validateProxyUrl(parsed.proxy ?? null) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { proxy: null };
    if (error instanceof SyntaxError) throw new Error("Network proxy configuration is invalid");
    throw error;
  }
}

export function writeNetworkProxy(proxy: string | null): NetworkProxyConfig {
  const normalized = validateProxyUrl(proxy);
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writePrivateFileAtomicSync(path, `${JSON.stringify({ proxy: normalized }, null, 2)}\n`);
  return { proxy: normalized };
}

/** Apply the UI-selected proxy to all subsequent SDK/global fetch requests. */
export function applyNetworkProxy(proxy: string | null): void {
  if (runtimeGlobal.__ompWebProxyUrl === proxy) return;
  runtimeGlobal.__ompWebOriginalPiProxy ??= process.env.PI_PROXY;
  runtimeGlobal.__ompWebOriginalHttpProxy ??= process.env.HTTP_PROXY;
  runtimeGlobal.__ompWebOriginalHttpsProxy ??= process.env.HTTPS_PROXY;
  if (typeof Bun === "undefined") {
    if (proxy) {
      process.env.HTTP_PROXY = proxy;
      process.env.HTTPS_PROXY = proxy;
    } else {
      if (runtimeGlobal.__ompWebOriginalHttpProxy) process.env.HTTP_PROXY = runtimeGlobal.__ompWebOriginalHttpProxy;
      else delete process.env.HTTP_PROXY;
      if (runtimeGlobal.__ompWebOriginalHttpsProxy) process.env.HTTPS_PROXY = runtimeGlobal.__ompWebOriginalHttpsProxy;
      else delete process.env.HTTPS_PROXY;
    }
    runtimeGlobal.__ompWebProxyUrl = proxy;
    return;
  }
  runtimeGlobal.__ompWebOriginalFetch ??= globalThis.fetch;
  globalThis.fetch = runtimeGlobal.__ompWebOriginalFetch;
  if (proxy) process.env.PI_PROXY = proxy;
  else if (runtimeGlobal.__ompWebOriginalPiProxy) process.env.PI_PROXY = runtimeGlobal.__ompWebOriginalPiProxy;
  else delete process.env.PI_PROXY;
  __resetGlobalProxyFetch();
  installGlobalProxyFetch();
  runtimeGlobal.__ompWebProxyUrl = proxy;
}

export function loadAndApplyNetworkProxy(): NetworkProxyConfig {
  const config = readNetworkProxy();
  applyNetworkProxy(config.proxy);
  return config;
}
