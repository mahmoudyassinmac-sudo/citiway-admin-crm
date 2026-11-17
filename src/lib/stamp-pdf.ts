import "server-only";
import { PDFDocument } from "pdf-lib";
import type { BrandImage } from "@/lib/brand";
import type { StampAnchor } from "@/lib/signoff";

/**
 * Draws the signature (optional) and stamp into the document's stamp slot.
 * Layout mirrors <StampSlot>: the slot is split into equal columns, each image is
 * "contain"-fitted, vertically centred and aligned left / centre / right in its column.
 */
export async function stampPdf(
  pdfBytes: Uint8Array,
  anchor: StampAnchor,
  images: BrandImage[],
  meta: { approvedBy: string; reference: string },
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const pages = pdf.getPages();
  const page = pages[Math.min(Math.max(anchor.page, 0), pages.length - 1)];
  const { width: W, height: H } = page.getSize();

  const box = { x: anchor.x * W, w: anchor.w * W, h: anchor.h * H, y: H - (anchor.y + anchor.h) * H };
  const n = images.length;
  const colW = box.w / n;

  for (let i = 0; i < n; i++) {
    const img = images[i];
    const embedded = img.contentType === "image/png" ? await pdf.embedPng(img.bytes) : await pdf.embedJpg(img.bytes);
    const scale = Math.min(colW / embedded.width, box.h / embedded.height);
    const dw = embedded.width * scale;
    const dh = embedded.height * scale;
    const colX = box.x + i * colW;
    const dx = anchor.align === "left" ? colX : anchor.align === "right" ? colX + colW - dw : colX + (colW - dw) / 2;
    page.drawImage(embedded, { x: dx, y: box.y + (box.h - dh) / 2, width: dw, height: dh });
  }

  pdf.setSubject(`Approved & stamped by ${meta.approvedBy}`);
  pdf.setKeywords(["Citiway", meta.reference, "approved"]);
  pdf.setModificationDate(new Date());
  return pdf.save();
}
