import * as THREE from "three";
import { proxyStockImage } from "@/lib/ai/stockLookup";

const cache = new Map<string, Promise<THREE.Texture | null>>();

/** Listing photo, fetched through the app so the bench can paint it. */
export function loadStockPhoto(url: string): Promise<THREE.Texture | null> {
  const hit = cache.get(url);
  if (hit) return hit;
  const pending = proxyStockImage({ data: { url } })
    .then((res) => {
      if (!res.ok) return null;
      return new Promise<THREE.Texture | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const tex = new THREE.Texture(img);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.needsUpdate = true;
          resolve(tex);
        };
        img.onerror = () => resolve(null);
        img.src = res.dataUrl;
      });
    })
    .catch(() => null);
  cache.set(url, pending);
  return pending;
}
