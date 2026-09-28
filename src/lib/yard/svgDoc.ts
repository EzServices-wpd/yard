/**
 * Tiny jsPDF-shaped drawing surface that records into an SVG string.
 * Same calls renderProject / drawShape / drawBubble already make — one picture path for the PDF and the plan panel.
 */
import type { RGB } from "./pdfKit";

type Dash = number[];

function rgb(c: RGB | number[], a = 1) {
  const [r, g, b] = c;
  return a < 1 ? `rgba(${r},${g},${b},${a})` : `rgb(${r},${g},${b})`;
}

function esc(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Approximate Helvetica advance — good enough for bubble labels and chip layout. */
function advance(text: string, size: number, style: string) {
  const bold = style.includes("bold");
  let w = 0;
  for (const ch of text) {
    if (ch === " ") w += 0.28;
    else if ("ilI.,:;!'|".includes(ch)) w += 0.28;
    else if ("mwMW@".includes(ch)) w += 0.9;
    else if (/[A-Z]/.test(ch)) w += bold ? 0.72 : 0.66;
    else w += bold ? 0.6 : 0.55;
  }
  return w * size;
}

export type SvgDocStats = {
  ops: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export class SvgDoc {
  w: number;
  h: number;
  private parts: string[] = [];
  private fill: RGB = [0, 0, 0];
  private stroke: RGB = [0, 0, 0];
  private lw = 1;
  private fontSize = 10;
  private fontStyle = "normal";
  private textColor: RGB = [0, 0, 0];
  private dash: Dash = [];
  private join = "round";
  private cap = "round";
  stats: SvgDocStats = { ops: 0, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
  }

  private touch(x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.stats.minX = Math.min(this.stats.minX, x);
    this.stats.minY = Math.min(this.stats.minY, y);
    this.stats.maxX = Math.max(this.stats.maxX, x);
    this.stats.maxY = Math.max(this.stats.maxY, y);
  }

  private strokeAttrs() {
    const dash = this.dash.length ? ` stroke-dasharray="${this.dash.join(" ")}"` : "";
    return `fill="none" stroke="${rgb(this.stroke)}" stroke-width="${this.lw}" stroke-linejoin="${this.join}" stroke-linecap="${this.cap}"${dash}`;
  }

  private fillAttrs(style: "F" | "S" | "FD") {
    if (style === "S") return this.strokeAttrs();
    if (style === "F") return `fill="${rgb(this.fill)}" stroke="none"`;
    return `fill="${rgb(this.fill)}" stroke="${rgb(this.stroke)}" stroke-width="${this.lw}" stroke-linejoin="${this.join}" stroke-linecap="${this.cap}"${
      this.dash.length ? ` stroke-dasharray="${this.dash.join(" ")}"` : ""
    }`;
  }

  setLineJoin(j: "round" | "bevel" | "miter") {
    this.join = j;
  }
  setLineCap(c: "round" | "butt" | "square") {
    this.cap = c;
  }
  setDrawColor(r: number, g?: number, b?: number) {
    this.stroke = g == null ? [r, r, r] : [r, g!, b!];
  }
  setFillColor(r: number, g?: number, b?: number) {
    this.fill = g == null ? [r, r, r] : [r, g!, b!];
  }
  setTextColor(r: number, g?: number, b?: number) {
    this.textColor = g == null ? [r, r, r] : [r, g!, b!];
  }
  setLineWidth(w: number) {
    this.lw = w;
  }
  setLineDashPattern(dash: number[], _phase?: number) {
    this.dash = dash ?? [];
  }
  setFont(_name: string, style: string = "normal") {
    this.fontStyle = style;
  }
  setFontSize(size: number) {
    this.fontSize = size;
  }
  getTextWidth(t: string) {
    return advance(String(t), this.fontSize, this.fontStyle);
  }
  splitTextToSize(t: string, maxW: number): string[] {
    const words = String(t).split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    const lines: string[] = [];
    let cur = words[0];
    for (let i = 1; i < words.length; i++) {
      const next = `${cur} ${words[i]}`;
      if (this.getTextWidth(next) <= maxW) cur = next;
      else {
        lines.push(cur);
        cur = words[i];
      }
    }
    lines.push(cur);
    return lines;
  }

  line(x1: number, y1: number, x2: number, y2: number) {
    this.touch(x1, y1);
    this.touch(x2, y2);
    this.stats.ops++;
    this.parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${this.strokeAttrs()} />`);
  }

  lines(deltas: number[][], x: number, y: number, _scale: number[], style: "F" | "S" | "FD", closed: boolean) {
    let cx = x;
    let cy = y;
    this.touch(cx, cy);
    let d = `M ${cx} ${cy}`;
    for (const [dx, dy] of deltas) {
      cx += dx;
      cy += dy;
      this.touch(cx, cy);
      d += ` L ${cx} ${cy}`;
    }
    if (closed) d += " Z";
    this.stats.ops++;
    this.parts.push(`<path d="${d}" ${this.fillAttrs(style)} />`);
  }

  rect(x: number, y: number, w: number, h: number, style: "F" | "S" | "FD" = "S") {
    this.touch(x, y);
    this.touch(x + w, y + h);
    this.stats.ops++;
    this.parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" ${this.fillAttrs(style)} />`);
  }

  roundedRect(x: number, y: number, w: number, h: number, rx: number, ry: number, style: "F" | "S" | "FD" = "S") {
    this.touch(x, y);
    this.touch(x + w, y + h);
    this.stats.ops++;
    this.parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${ry}" ${this.fillAttrs(style)} />`,
    );
  }

  circle(x: number, y: number, r: number, style: "F" | "S" | "FD" = "S") {
    this.touch(x - r, y - r);
    this.touch(x + r, y + r);
    this.stats.ops++;
    this.parts.push(`<circle cx="${x}" cy="${y}" r="${r}" ${this.fillAttrs(style)} />`);
  }

  triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, style: "F" | "S" | "FD" = "S") {
    this.touch(x1, y1);
    this.touch(x2, y2);
    this.touch(x3, y3);
    this.stats.ops++;
    this.parts.push(`<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3}" ${this.fillAttrs(style)} />`);
  }

  text(t: string, x: number, y: number, opts?: { align?: "left" | "center" | "right" }) {
    const align = opts?.align ?? "left";
    const anchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
    const weight = this.fontStyle.includes("bold") ? "700" : "400";
    const italic = this.fontStyle.includes("italic") ? "italic" : "normal";
    const tw = this.getTextWidth(t);
    if (align === "center") {
      this.touch(x - tw / 2, y - this.fontSize);
      this.touch(x + tw / 2, y);
    } else if (align === "right") {
      this.touch(x - tw, y - this.fontSize);
      this.touch(x, y);
    } else {
      this.touch(x, y - this.fontSize);
      this.touch(x + tw, y);
    }
    this.stats.ops++;
    this.parts.push(
      `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Helvetica, Arial, sans-serif" font-size="${this.fontSize}" font-weight="${weight}" font-style="${italic}" fill="${rgb(this.textColor)}">${esc(t)}</text>`,
    );
  }

  toSvg(bg?: RGB): string {
    const paper = bg ? `<rect width="100%" height="100%" fill="${rgb(bg)}" />` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}">${paper}${this.parts.join("")}</svg>`;
  }
}
