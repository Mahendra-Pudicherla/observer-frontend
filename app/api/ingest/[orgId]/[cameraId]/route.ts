import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function backendBase(): string {
  return (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_API_URL ||
    // Known Railway production fallback if Vercel env is missing on the server
    "https://web-production-d893e.up.railway.app"
  ).replace(/\/$/, "");
}

/**
 * Same-origin proxy so mobile browsers can upload frames without
 * cross-origin fetch/CORS failures to Railway.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orgId: string; cameraId: string }> }
) {
  const { orgId, cameraId } = await context.params;
  const target = `${backendBase()}/ingest/${encodeURIComponent(orgId)}/${encodeURIComponent(cameraId)}`;

  const contentType = request.headers.get("content-type") || "image/jpeg";
  const body = await request.arrayBuffer();

  if (body.byteLength === 0) {
    return NextResponse.json({ detail: "Empty body" }, { status: 400 });
  }
  if (body.byteLength > 400_000) {
    return NextResponse.json({ detail: "Frame too large" }, { status: 413 });
  }

  try {
    const upstream = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body,
      cache: "no-store",
    });

    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        detail: "Upstream ingest failed",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    );
  }
}
