"use client";

import { getFontEmbedCSS, toJpeg } from "html-to-image";
import { PDFDocument } from "pdf-lib";
import { finalizeArchive, prepareArchiveUpload } from "@/app/(app)/documents/archive-actions";
import type { DocTable, SignoffMode, StampAnchor } from "@/lib/signoff";
import { createClient } from "@/lib/supabase/client";

const A4_PT = [595.28, 841.89] as const;
const PAGE_PX = { w: 794, h: 1123 };

/** The A4 sheets currently on screen: each tool renders them inside `.scaler > .scaler`. */
function findPages(): HTMLElement[] {
  const root = document.getElementById("root");
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(".scaler > .scaler"))
    .map((s) => s.firstElementChild as HTMLElement | null)
    .filter((p): p is HTMLElement => !!p);
}

/** First stamp slot on the sheets, as page fractions (transform-independent). */
function findAnchor(pages: HTMLElement[]): StampAnchor | null {
  for (let i = 0; i < pages.length; i++) {
    const slot = pages[i].querySelector<HTMLElement>("[data-stamp-anchor]");
    if (!slot) continue;
    const p = pages[i].getBoundingClientRect();
    const r = slot.getBoundingClientRect();
    if (!p.width || !p.height || !r.width || !r.height) continue;
    const align = slot.dataset.stampAlign;
    return {
      page: i,
      x: (r.left - p.left) / p.width,
      y: (r.top - p.top) / p.height,
      w: r.width / p.width,
      h: r.height / p.height,
      align: align === "left" || align === "right" ? align : "center",
    };
  }
  return null;
}

const skip = (n: HTMLElement) => !(n.classList && n.classList.contains("no-print"));

/** Renders the on-screen sheets to an A4 PDF (one page per sheet). */
async function renderPdf(pages: HTMLElement[], title: string): Promise<Uint8Array> {
  if (document.fonts) await document.fonts.ready;
  let fontEmbedCSS: string | undefined;
  try {
    fontEmbedCSS = await getFontEmbedCSS(pages[0]);
  } catch {
    fontEmbedCSS = undefined; // fall back to html-to-image's own font handling
  }
  const pdf = await PDFDocument.create();
  for (const page of pages) {
    const dataUrl = await toJpeg(page, {
      quality: 0.92,
      pixelRatio: 2,
      width: PAGE_PX.w,
      height: PAGE_PX.h,
      backgroundColor: "#ffffff",
      cacheBust: false,
      fontEmbedCSS,
      filter: skip,
    });
    const img = await pdf.embedJpg(dataUrl);
    const pg = pdf.addPage([A4_PT[0], A4_PT[1]]);
    pg.drawImage(img, { x: 0, y: 0, width: A4_PT[0], height: A4_PT[1] });
  }
  pdf.setTitle(title);
  pdf.setCreator("Citiway CRM");
  pdf.setProducer("Citiway CRM");
  return pdf.save();
}

export interface ArchiveResult {
  ok: boolean;
  message: string;
}

/**
 * Archives the document that is on screen right now as a PDF in the CRM.
 * Call it right after the record was saved (it needs the row id).
 */
export async function archiveOnScreenDocument(opts: {
  table: DocTable;
  id: string;
  title: string;
  mode: SignoffMode;
}): Promise<ArchiveResult> {
  try {
    const pages = findPages();
    if (!pages.length) return { ok: false, message: "PDF not archived: the document preview was not found." };
    const anchor = findAnchor(pages);
    const bytes = await renderPdf(pages, opts.title);

    const prep = await prepareArchiveUpload(opts.table, opts.id);
    if (!prep.ok) return { ok: false, message: `PDF not archived: ${prep.error}` };

    const { error } = await createClient()
      .storage.from("documents")
      .uploadToSignedUrl(prep.path, prep.token, new Blob([bytes as BlobPart], { type: "application/pdf" }), {
        contentType: "application/pdf",
      });
    if (error) return { ok: false, message: `PDF not archived: ${error.message}` };

    const fin = await finalizeArchive({ table: opts.table, id: opts.id, path: prep.path, anchor, mode: opts.mode });
    return fin.ok ? { ok: true, message: fin.message } : { ok: false, message: `PDF not archived: ${fin.error}` };
  } catch (e) {
    return { ok: false, message: `PDF not archived: ${e instanceof Error ? e.message : "unexpected error"}` };
  }
}
