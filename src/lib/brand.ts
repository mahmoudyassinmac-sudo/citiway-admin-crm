import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { FALLBACK_STAMP_PNG_BASE64 } from "@/lib/brand-fallback";

export type BrandKind = "stamp" | "signature";

export interface BrandImage {
  bytes: Uint8Array;
  contentType: "image/png" | "image/jpeg";
}

/** What the Super Admin has configured: the stamp always exists (built-in fallback); the signature is optional. */
export async function brandPaths(): Promise<{ stamp: string | null; signature: string | null }> {
  const { data } = await createAdminClient()
    .from("company_settings")
    .select("stamp_image_path, signature_image_path")
    .eq("id", 1)
    .maybeSingle();
  return {
    stamp: (data?.stamp_image_path as string | null) ?? null,
    signature: (data?.signature_image_path as string | null) ?? null,
  };
}

export function sniffImageType(bytes: Uint8Array): BrandImage["contentType"] | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

/** Loads the stamp / signature image. Never call this for a user who isn't allowed to stamp. */
export async function loadBrandImage(kind: BrandKind, paths?: { stamp: string | null; signature: string | null }): Promise<BrandImage | null> {
  const p = paths ?? (await brandPaths());
  const path = kind === "stamp" ? p.stamp : p.signature;
  if (path) {
    const { data, error } = await createAdminClient().storage.from("brand").download(path);
    if (!error && data) {
      const bytes = new Uint8Array(await data.arrayBuffer());
      const contentType = sniffImageType(bytes);
      if (contentType) return { bytes, contentType };
    }
  }
  if (kind === "stamp") {
    return { bytes: Uint8Array.from(Buffer.from(FALLBACK_STAMP_PNG_BASE64, "base64")), contentType: "image/png" };
  }
  return null;
}

/** Images printed in a stamp slot, in order: signature (if any) then stamp. */
export async function stampImageKinds(): Promise<BrandKind[]> {
  const p = await brandPaths();
  return p.signature ? ["signature", "stamp"] : ["stamp"];
}
