/**
 * SVG → PNG for the share card, in our own function: @resvg/resvg-wasm (MPL-2.0) with Figtree 400/700
 * (OFL, fonts/OFL.txt; static instances of the variable font, Latin and shop fractions only). No system fonts,
 * no network: the wasm and the fonts are bundled into the server function.
 */
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import wasmData from "@resvg/resvg-wasm/index_bg.wasm?url&inline";
import figtree400 from "./fonts/Figtree-400.ttf?inline";
import figtree700 from "./fonts/Figtree-700.ttf?inline";

const bytes = (dataUrl: string) => Uint8Array.from(Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"));
let ready: Promise<void> | null = null;
let fonts: Uint8Array[] = [];

export async function svgToPng(svg: string): Promise<Uint8Array> {
  ready ??= initWasm(bytes(wasmData)).then(() => { fonts = [bytes(figtree400), bytes(figtree700)]; });
  try { await ready; } catch (err) { ready = null; throw err; }
  const r = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: { fontBuffers: fonts, defaultFontFamily: "Figtree", sansSerifFamily: "Figtree" },
  });
  try {
    const img = r.render();
    try { return img.asPng(); } finally { img.free(); }
  } finally { r.free(); }
}
