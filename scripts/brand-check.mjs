import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const MAX_CARD_BYTES = 600 * 1024;

export function stripJsComments(src) {
  if (!src) return "";
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n\r]*/g, "");
}

export function rootDeclaresOgTypeGame(rootTsx) {
  if (!rootTsx) return false;
  const code = stripJsComments(rootTsx);
  return /property\s*:\s*["']og:type["'][\s\S]{0,120}?content\s*:\s*["']x:game["']/i.test(code)
    || /content\s*:\s*["']x:game["'][\s\S]{0,120}?property\s*:\s*["']og:type["']/i.test(code);
}

export function rootDeclaresGameImage(rootTsx) {
  if (!rootTsx) return false;
  return /property\s*:\s*["']x:game:image["']/i.test(stripJsComments(rootTsx));
}

export function rootUsesCardPlaceholder(rootTsx) {
  if (!rootTsx) return false;
  return /og\.grok\.me\/v\d+\/card\.png/i.test(rootTsx);
}

export function rootUsesBannerPlaceholder(rootTsx) {
  if (!rootTsx) return false;
  return /og\.grok\.me\/v\d+\/banner\.png/i.test(rootTsx);
}

export function computeBrandWarnings({ hasCanvas, workspaceRoot = "/workspace" }) {
  const skillPath = join(workspaceRoot, ".grok/skills/og/SKILL.md");
  const rootTsxPath = join(workspaceRoot, "src/routes/__root.tsx");
  const rootTsx = existsSync(rootTsxPath) ? readFileSync(rootTsxPath, "utf8") : "";
  const cardPath = [join(workspaceRoot, "public/og.jpg"), join(workspaceRoot, "public/og.png")].find(existsSync);
  const warnings = [];

  if (cardPath !== undefined) {
    if (rootUsesCardPlaceholder(rootTsx)) {
      warnings.push(`BRAND WARNING: ${cardPath} exists but __root.tsx still points og:image at the placeholder.`);
    } else if (statSync(cardPath).size > MAX_CARD_BYTES) {
      warnings.push(`BRAND WARNING: ${cardPath} is over 600 KB.`);
    }
  } else if (hasCanvas) {
    warnings.push(`BRAND WARNING: canvas app but ${workspaceRoot}/public/og.jpg is missing. See ${skillPath}.`);
  }

  if (hasCanvas && !rootDeclaresOgTypeGame(rootTsx)) {
    warnings.push('BRAND WARNING: canvas app missing og:type="x:game".');
  }

  const customCardWired = cardPath !== undefined && !rootUsesCardPlaceholder(rootTsx);
  if (hasCanvas && customCardWired) {
    const bannerPath = join(workspaceRoot, "public/x-banner.jpg");
    if (!existsSync(bannerPath)) {
      warnings.push(`BRAND WARNING: canvas app missing ${bannerPath}.`);
    } else if (statSync(bannerPath).size > MAX_CARD_BYTES) {
      warnings.push(`BRAND WARNING: ${bannerPath} is over 600 KB.`);
    } else if (rootUsesBannerPlaceholder(rootTsx)) {
      warnings.push(`BRAND WARNING: ${bannerPath} exists but x:game:image still uses the placeholder.`);
    }
    if (!rootDeclaresGameImage(rootTsx)) {
      warnings.push("BRAND WARNING: canvas app missing x:game:image.");
    }
  }

  return warnings;
}
