import { NextResponse } from "next/server";
import { applySkin, createSkin, deleteSkin, readSkinState, updateSkin } from "@/lib/skin-store";
import type { CreateSkinInput, UpdateSkinInput } from "@/lib/skin-types";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

function rejectUntrusted(request: Request): NextResponse | null {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Untrusted API request" }, { status: 403 });
  return null;
}

function requireJson(request: Request): NextResponse | null {
  if (!hasJsonContentType(request)) return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  return null;
}

function failure(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error);
  const status = /not found/i.test(message) ? 404 : /read-only|cannot be deleted/i.test(message) ? 409 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const rejection = rejectUntrusted(request);
  if (rejection) return rejection;
  try {
    return NextResponse.json(readSkinState(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const rejection = rejectUntrusted(request) ?? requireJson(request);
  if (rejection) return rejection;
  try {
    const body = await request.json() as CreateSkinInput;
    return NextResponse.json(createSkin(body), { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  const rejection = rejectUntrusted(request) ?? requireJson(request);
  if (rejection) return rejection;
  try {
    const body = await request.json() as UpdateSkinInput;
    return NextResponse.json(updateSkin(body));
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request) {
  const rejection = rejectUntrusted(request) ?? requireJson(request);
  if (rejection) return rejection;
  try {
    const body = await request.json() as { id?: unknown };
    if (typeof body.id !== "string" || !body.id) return NextResponse.json({ error: "Skin id is required" }, { status: 400 });
    return NextResponse.json(applySkin(body.id));
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request) {
  const rejection = rejectUntrusted(request);
  if (rejection) return rejection;
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Skin id is required" }, { status: 400 });
    return NextResponse.json(deleteSkin(id));
  } catch (error) {
    return failure(error);
  }
}
