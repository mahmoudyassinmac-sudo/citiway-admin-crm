import { getSession } from "@/lib/auth";
import { loadBrandImage, type BrandKind } from "@/lib/brand";

/**
 * Stamp / signature image for the Super Admin's own screen (live preview while issuing a
 * stamped document, and the Company Settings preview). Nobody else can fetch it.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (kind !== "stamp" && kind !== "signature") return new Response("Not found", { status: 404 });
  const session = await getSession();
  if (session.role !== "super_admin" || !session.configured) return new Response("Forbidden", { status: 403 });
  const img = await loadBrandImage(kind as BrandKind);
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(img.bytes), {
    headers: { "Content-Type": img.contentType, "Cache-Control": "private, no-store" },
  });
}
