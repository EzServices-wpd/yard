/** Published measures + encyclopedia extract — the scale of the queried wire. */

export type RealMeasures = {
  id: string;
  label: string;
  heightM?: number;
  lengthM?: number;
  widthM?: number;
  summary: string;
};

/**
 * Wikidata entity ids (Q135209751) are internal lookup keys, never words for the maker.
 * Strips "(Q123)", "[Q123]", "(wd:Q123)" and "wikidata Q123" from any text bound for a title or note.
 */
export function stripEntityIds(text: string): string {
  return text
    .replace(/\s*[([]\s*(?:wd:)?Q\d+\s*[)\]]/g, "")
    .replace(/\bwikidata(?:\s+(?:entity|item|id))?:?\s*Q\d+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function meters(claim: { mainsnak?: { datavalue?: { value?: { amount?: string; unit?: string } } } } | undefined): number | undefined {
  const v = claim?.mainsnak?.datavalue?.value;
  if (!v?.amount) return undefined;
  const n = parseFloat(v.amount);
  if (!Number.isFinite(n)) return undefined;
  const unit = v.unit ?? "";
  if (unit.endsWith("Q174728")) return n / 100;
  if (unit.endsWith("Q3710")) return n * 0.3048;
  if (unit.endsWith("Q218593")) return n * 0.0254;
  if (unit.endsWith("Q11573") || unit.endsWith("Q828224") || unit === "1") return n;
  return n;
}

export async function lookupRealMeasures(subject: string): Promise<RealMeasures | null> {
  const q = subject.trim();
  if (q.length < 2) return null;
  try {
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=en&limit=5&format=json`;
    const sres = await fetch(searchUrl, {
      headers: { Accept: "application/json", "User-Agent": "Yard/1.0 (maker planner)" },
      signal: AbortSignal.timeout(4500),
    });
    if (!sres.ok) return null;
    const sjson = (await sres.json()) as { search?: { id: string; label: string; description?: string }[] };
    const skip = /album|song|film|band|musician|single|novel|episode|television|company|surname|video game|constellation|painting|podcast|radio|website|web series|magazine|newspaper|record label/i;
    const prefer = /tower|building|mausoleum|monument|animal|species|mammal|statue|bridge|pyramid|temple|church|mosque|castle|lighthouse|skyscraper|structure/i;
    const hits = sjson.search ?? [];
    const hit =
      hits.find((h) => prefer.test(`${h.label} ${h.description ?? ""}`)) ||
      hits.find((h) => !skip.test(h.description ?? "")) ||
      hits[0];
    if (!hit?.id) return null;
    const eres = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${hit.id}&props=claims|labels&languages=en&format=json`,
      {
        headers: { Accept: "application/json", "User-Agent": "Yard/1.0 (maker planner)" },
        signal: AbortSignal.timeout(4500),
      },
    );
    if (!eres.ok) return null;
    const ejson = (await eres.json()) as {
      entities?: Record<
        string,
        { labels?: { en?: { value: string } }; claims?: Record<string, { mainsnak?: { datavalue?: { value?: { amount?: string; unit?: string } } } }[]> }
      >;
    };
    const ent = ejson.entities?.[hit.id];
    const claims = ent?.claims ?? {};
    const heightM = meters(claims.P2048?.[0]);
    const lengthM = meters(claims.P2043?.[0]);
    const widthM = meters(claims.P2049?.[0]);
    // hit.id stays on the result for internal use; the words the maker sees carry the English label only.
    const label = stripEntityIds(ent?.labels?.en?.value ?? hit.label);
    const parts = [
      label,
      heightM ? `height ${heightM.toFixed(2)} m` : null,
      lengthM ? `length ${lengthM.toFixed(2)} m` : null,
      widthM ? `width ${widthM.toFixed(2)} m` : null,
      hit.description ? stripEntityIds(hit.description) : null,
    ].filter(Boolean);
    return {
      id: hit.id,
      label,
      heightM,
      lengthM,
      widthM,
      summary: parts.join(" · "),
    };
  } catch {
    return null;
  }
}

export async function lookupWikipediaSummary(subject: string): Promise<string | null> {
  const q = subject.trim();
  if (q.length < 2) return null;
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q.replace(/\s+/g, "_"))}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Yard/1.0 (maker planner)" },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { extract?: string; title?: string; description?: string };
    const extract = json.extract?.trim();
    if (!extract) return null;
    return stripEntityIds(`${json.title ?? q}: ${extract.slice(0, 500)}`);
  } catch {
    return null;
  }
}

export async function lookupRealForm(subject: string): Promise<{ summary: string; measures: RealMeasures | null }> {
  const [measures, wiki] = await Promise.all([lookupRealMeasures(subject), lookupWikipediaSummary(subject)]);
  const summary = stripEntityIds([measures?.summary, wiki].filter(Boolean).join(" — "));
  return { summary: summary || subject, measures };
}
