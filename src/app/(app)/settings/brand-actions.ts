"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { brandPaths, sniffImageType, type BrandKind } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true; message: string } | { ok: false; error: string };

const COLUMN: Record<BrandKind, "stamp_image_path" | "signature_image_path"> = {
  stamp: "stamp_image_path",
  signature: "signature_image_path",
};

async function owner() {
  const s = await getSession();
  return s.configured && s.userId && s.role === "super_admin" ? s : null;
}

/** Super Admin uploads the company stamp or the authorised signature (PNG/JPG, transparent PNG recommended). */
export async function uploadBrandImage(formData: FormData): Promise<Result> {
  if (!(await owner())) return { ok: false, error: "Only the Super Admin can change the stamp & signature." };
  const kind = formData.get("kind");
  const file = formData.get("file");
  if (kind !== "stamp" && kind !== "signature") return { ok: false, error: "Unknown image." };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose an image file." };
  if (file.size > 3 * 1024 * 1024) return { ok: false, error: "The image must be under 3 MB." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return { ok: false, error: "Use a PNG or JPG image." };

  const admin = createAdminClient();
  const path = `${kind}-${Date.now()}.${type === "image/png" ? "png" : "jpg"}`;
  const { error: upErr } = await admin.storage.from("brand").upload(path, bytes, { contentType: type });
  if (upErr) return { ok: false, error: upErr.message };

  const previous = (await brandPaths())[kind];
  const { error } = await admin.from("company_settings").update({ [COLUMN[kind]]: path }).eq("id", 1);
  if (error) return { ok: false, error: error.message };
  if (previous) await admin.storage.from("brand").remove([previous]);

  revalidatePath("/settings");
  return { ok: true, message: kind === "stamp" ? "Stamp updated." : "Signature updated." };
}

/** Removing the stamp falls back to the built-in Citiway stamp; removing the signature prints the stamp alone. */
export async function removeBrandImage(kind: BrandKind): Promise<Result> {
  if (!(await owner())) return { ok: false, error: "Only the Super Admin can change the stamp & signature." };
  if (kind !== "stamp" && kind !== "signature") return { ok: false, error: "Unknown image." };
  const admin = createAdminClient();
  const previous = (await brandPaths())[kind];
  const { error } = await admin.from("company_settings").update({ [COLUMN[kind]]: null }).eq("id", 1);
  if (error) return { ok: false, error: error.message };
  if (previous) await admin.storage.from("brand").remove([previous]);
  revalidatePath("/settings");
  return { ok: true, message: kind === "stamp" ? "Back to the built-in stamp." : "Signature removed." };
}
