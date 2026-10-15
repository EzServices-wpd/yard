import qrcode from "qrcode-generator";
import type { jsPDF } from "jspdf";

/**
 * Draw a QR code for `url` as vector squares, built locally (no QR web service).
 * Returns the side length drawn, in points.
 */
export function drawQr(doc: jsPDF, url: string, x: number, y: number, size: number): number {
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 2;
  const cell = size / (n + quiet * 2);
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, size, size, "F");
  doc.setFillColor(0, 0, 0);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) doc.rect(x + (c + quiet) * cell, y + (r + quiet) * cell, cell + 0.05, cell + 0.05, "F");
    }
  }
  return size;
}
