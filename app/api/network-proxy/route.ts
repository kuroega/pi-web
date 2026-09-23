import { NextResponse } from "next/server";
import {
  applyNetworkProxy,
  readNetworkProxy,
  validateProxyUrl,
  writeNetworkProxy,
} from "@/lib/network-proxy";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(readNetworkProxy());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json() as { proxy?: unknown };
    const proxy = validateProxyUrl(body.proxy ?? null);
    const config = writeNetworkProxy(proxy);
    applyNetworkProxy(config.proxy);
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 });
  }
}
