import type { configureHttpDispatcher as ConfigureHttpDispatcher } from "@/lib/http-dispatcher";

type DispatcherModule = { configureHttpDispatcher: typeof ConfigureHttpDispatcher };
type NetworkProxyModule = { loadAndApplyNetworkProxy: () => unknown };

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const importRuntimeModule = Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<DispatcherModule>;
  const encodedCwd = encodeURI(process.cwd().replaceAll("\\", "/"));
  const filePrefix = encodedCwd.startsWith("/") ? "file://" : "file:///";
  const moduleUrl = `${filePrefix}${encodedCwd}/lib/http-dispatcher.ts`;
  const { configureHttpDispatcher } = await importRuntimeModule(moduleUrl);
  const networkUrl = `${filePrefix}${encodedCwd}/lib/network-proxy.ts`;
  const { loadAndApplyNetworkProxy } = await importRuntimeModule(networkUrl) as unknown as NetworkProxyModule;
  loadAndApplyNetworkProxy();
  await configureHttpDispatcher();
}
