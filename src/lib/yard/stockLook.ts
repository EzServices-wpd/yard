/** Shared stock looks for the bench — grain, kraft, ply. Generated once, no network. */

import * as THREE from "three";
import type { CatalogItem } from "./types";

type Maps = {
  wood: THREE.CanvasTexture;
  ply: THREE.CanvasTexture;
  card: THREE.CanvasTexture;
};

let maps: Maps | null = null;

function paint(size: number, draw: (ctx: CanvasRenderingContext2D, n: number) => void) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) {
    const t = new THREE.CanvasTexture(c);
    return t;
  }
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function ensure(): Maps | null {
  if (typeof document === "undefined") return null;
  if (maps) return maps;
  const wood = paint(256, (ctx, n) => {
    ctx.fillStyle = "#e2c48a";
    ctx.fillRect(0, 0, n, n);
    for (let i = 0; i < 42; i++) {
      const y = (i / 42) * n + Math.sin(i * 1.7) * 2.2;
      ctx.strokeStyle = i % 5 === 0 ? "rgba(92,64,32,0.28)" : "rgba(120,82,40,0.14)";
      ctx.lineWidth = i % 7 === 0 ? 2.2 : 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= n; x += 8) {
        ctx.lineTo(x, y + Math.sin(x * 0.04 + i) * 3.4);
      }
      ctx.stroke();
    }
    for (let k = 0; k < 80; k++) {
      ctx.fillStyle = `rgba(70,48,24,${0.04 + (k % 5) * 0.01})`;
      ctx.fillRect((k * 17) % n, (k * 11) % n, 2, 6);
    }
  });
  wood.repeat.set(2, 8);

  const ply = paint(256, (ctx, n) => {
    ctx.fillStyle = "#d7b07a";
    ctx.fillRect(0, 0, n, n);
    for (let i = 0; i < 28; i++) {
      const y = (i / 28) * n;
      ctx.fillStyle = i % 2 === 0 ? "rgba(90,62,32,0.18)" : "rgba(232,210,160,0.2)";
      ctx.fillRect(0, y, n, n / 28 + 0.5);
    }
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = "rgba(70,48,24,0.12)";
      ctx.beginPath();
      const y = (i / 18) * n;
      ctx.moveTo(0, y);
      for (let x = 0; x <= n; x += 10) ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 2);
      ctx.stroke();
    }
  });
  ply.repeat.set(3, 3);

  const card = paint(256, (ctx, n) => {
    ctx.fillStyle = "#c4a06a";
    ctx.fillRect(0, 0, n, n);
    for (let x = 0; x < n; x += 6) {
      ctx.fillStyle = x % 12 === 0 ? "rgba(90,64,36,0.28)" : "rgba(232,210,170,0.18)";
      ctx.fillRect(x, 0, 3, n);
    }
    ctx.fillStyle = "rgba(60,40,20,0.08)";
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 13) % n, (i * 19) % n, 8, 3);
  });
  card.repeat.set(6, 2);

  maps = { wood, ply, card };
  return maps;
}

export type StockLook = {
  map: THREE.Texture | null;
  roughness: number;
  metalness: number;
  env: number;
};

export function stockLook(item?: CatalogItem | null, fallbackRough = 0.68, fallbackMetal = 0.04): StockLook {
  const m = ensure();
  if (!item) return { map: m?.wood ?? null, roughness: fallbackRough, metalness: fallbackMetal, env: 0.7 };
  const cat = item.category;
  if (cat === "cardboard" || cat === "paper_tube" || cat === "recycled") {
    return { map: m?.card ?? null, roughness: 0.9, metalness: 0.0, env: 0.35 };
  }
  if (cat === "sheet_goods") {
    return { map: m?.wood ?? null, roughness: 0.72, metalness: 0.02, env: 0.55 };
  }
  if (cat === "pvc_plumbing" || cat === "plastic") {
    return { map: null, roughness: item.roughness ?? 0.28, metalness: item.metalness ?? 0.12, env: 1.15 };
  }
  if (cat === "metal") {
    return { map: null, roughness: 0.35, metalness: 0.7, env: 1.2 };
  }
  if (cat === "foam") {
    return { map: null, roughness: 0.95, metalness: 0, env: 0.25 };
  }
  return {
    map: m?.wood ?? null,
    roughness: item.roughness ?? fallbackRough,
    metalness: item.metalness ?? fallbackMetal,
    env: 0.7,
  };
}

export function slideInches(carcaseDepth: number) {
  if (carcaseDepth >= 28) return 22;
  if (carcaseDepth >= 22) return 18;
  return 16;
}
