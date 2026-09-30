/**
 * Start with a space: whatever was measured, then any piece that can take those numbers.
 * Blank axes stay unmeasured. A piece that will ignore or clamp a number says so.
 */

export type SpaceMeasure = {
  wide: number | null;
  tall: number | null;
  deep: number | null;
  along: number | null;
  high: number | null;
  low: number | null;
};

export type SpaceModel = {
  id: string;
  label: string;
  detail: string;
  prompt: string;
};

export type SpaceRead = {
  line: string;
  models: SpaceModel[];
  note: string | null;
};

const ROOM = 192;

function fmt(n: number) {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function present(m: SpaceMeasure): number[] {
  return [m.wide, m.tall, m.deep, m.along, m.high, m.low].filter((n): n is number => n != null);
}

function shelfCount(tall: number) {
  if (tall >= 60) return 5;
  if (tall >= 48) return 4;
  if (tall >= 36) return 3;
  return 2;
}

function boxWords(m: SpaceMeasure) {
  const bits: string[] = [];
  if (m.wide) bits.push(`${fmt(m.wide)} wide`);
  if (m.deep) bits.push(`${fmt(m.deep)} deep`);
  if (m.tall) bits.push(`${fmt(m.tall)} tall`);
  return bits;
}

function missingBox(m: SpaceMeasure, axes: Array<"wide" | "tall" | "deep">) {
  const names = { wide: "width", tall: "height", deep: "depth" };
  const gone = axes.filter((a) => m[a] == null).map((a) => names[a]);
  if (!gone.length) return null;
  if (gone.length === 1) return `${gone[0]} wasn't measured — it will be assumed.`;
  return `${gone.slice(0, -1).join(", ")} and ${gone[gone.length - 1]} weren't measured — they will be assumed.`;
}

function bookcasePrompt(m: SpaceMeasure) {
  if (m.wide && m.tall && m.deep) {
    return `bookcase for a ${fmt(m.wide)} inch alcove, ${fmt(m.tall)} tall, ${fmt(m.deep)} deep`;
  }
  return `bookcase ${boxWords(m).join(" ")}`;
}

function closetPrompt(m: SpaceMeasure) {
  if (m.wide && m.tall && m.deep) {
    return `linen closet for a ${fmt(m.wide)} inch alcove, ${fmt(m.tall)} tall, ${fmt(m.deep)} deep`;
  }
  return `closet ${boxWords(m).join(" ")}`;
}

export function readSpace(m: SpaceMeasure): SpaceRead | null {
  const nums = present(m);
  if (!nums.length) return null;
  if (nums.some((n) => !(n > 0) || n > ROOM)) {
    return { line: "", models: [], note: "That number is bigger than a room this list will cut for." };
  }

  const bits: string[] = [];
  if (m.wide) bits.push(`${fmt(m.wide)} wide`);
  if (m.tall) bits.push(`${fmt(m.tall)} tall`);
  if (m.deep) bits.push(`${fmt(m.deep)} deep`);
  if (m.along) bits.push(`${fmt(m.along)} along the other wall`);
  if (m.high) bits.push(`${fmt(m.high)} at the high side`);
  if (m.low) bits.push(`${fmt(m.low)} at the low side`);
  const line = bits.join(", ") + ".";

  const models: SpaceModel[] = [];
  const assumed = missingBox(m, ["wide", "tall", "deep"]);

  if (m.wide || m.tall || m.deep) {
    const shallow = m.deep != null && m.deep < 8 ? " Shallower than 8 — tight for a case." : "";
    models.push({
      id: "bookcase",
      label: "Bookcase",
      detail: [assumed, shallow.trim() || "Open shelves in this opening."].filter(Boolean).join(" "),
      prompt: bookcasePrompt(m),
    });
    models.push({
      id: "closet",
      label: "Closet",
      detail: [assumed, m.deep != null && m.deep < 12 ? "Under 12 deep is a shallow closet." : "Doors. The opening is the unit."].filter(Boolean).join(" "),
      prompt: closetPrompt(m),
    });
    models.push({
      id: "desk",
      label: "Desk",
      detail: [
        assumed,
        m.tall != null && (m.tall < 27 || m.tall > 36) ? `${fmt(m.tall)} tall is an odd desk height.` : "Sit-down height if you measured it.",
      ].filter(Boolean).join(" "),
      prompt: m.wide && m.deep && m.tall
        ? `desk ${fmt(m.wide)} inches wide by ${fmt(m.deep)} deep by ${fmt(m.tall)} high`
        : `desk ${boxWords(m).join(" ")}`,
    });
    models.push({
      id: "bench",
      label: "Bench",
      detail: [assumed, m.tall != null && m.tall > 24 ? `${fmt(m.tall)} tall is high for a bench.` : "A seat in this footprint."].filter(Boolean).join(" "),
      prompt: `bench ${boxWords(m).join(" ")}`,
    });
    models.push({
      id: "nightstand",
      label: "Nightstand",
      detail: [assumed, m.tall != null && (m.tall < 18 || m.tall > 30) ? `${fmt(m.tall)} tall is an odd nightstand.` : "One drawer."].filter(Boolean).join(" "),
      prompt: `nightstand ${boxWords(m).join(" ")} with one drawer`,
    });
    models.push({
      id: "vanity",
      label: "Vanity",
      detail: [assumed, m.tall != null && (m.tall < 28 || m.tall > 36) ? `${fmt(m.tall)} tall is an odd vanity.` : "Two doors."].filter(Boolean).join(" "),
      prompt: m.wide && m.deep && m.tall
        ? `bathroom vanity ${fmt(m.wide)}" wide × ${fmt(m.deep)}" deep × ${fmt(m.tall)}" tall with two doors`
        : `bathroom vanity ${boxWords(m).join(" ")} with two doors`,
    });
    models.push({
      id: "cabinet",
      label: "Wall cabinet",
      detail: [assumed, "Hung on the wall, two doors."].filter(Boolean).join(" "),
      prompt: `wall cabinet ${boxWords(m).join(" ")} with two doors`,
    });
    models.push({
      id: "console",
      label: "TV console",
      detail: [assumed, m.tall != null && m.tall > 36 ? `${fmt(m.tall)} tall is high for a console.` : "Low and wide."].filter(Boolean).join(" "),
      prompt: `TV console ${boxWords(m).join(" ")}`,
    });
    if (m.wide || m.deep) {
      const shelfBits = [m.wide ? `${fmt(m.wide)} wide` : null, m.deep ? `${fmt(m.deep)} deep` : null].filter(Boolean);
      models.push({
        id: "shelf",
        label: "Hanging shelf",
        detail: m.tall ? "Height isn't used — a hanging shelf is a board, not a case." : "A board on brackets.",
        prompt: `floating shelf ${shelfBits.join(" ")}`,
      });
    }
  }

  if (m.along) {
    const a = m.wide ?? m.along;
    const b = m.wide ? m.along : m.along;
    const tall = m.tall;
    const reach = Math.round((Math.min(a, b) / Math.SQRT2) * 10) / 10;
    const capped = a > 48 || b > 48;
    const n = shelfCount(tall ?? 60);
    const prompt = m.wide
      ? `corner bookshelf ${fmt(m.wide)} wide ${fmt(m.along)} deep${tall ? ` ${fmt(tall)} tall` : ""}, ${n} shelves`
      : `corner bookshelf, ${fmt(m.along)} inches along each wall${tall ? `, ${fmt(tall)} tall` : ""}, ${n} shelves`;
    models.push({
      id: "corner",
      label: reach < 6 ? "Corner shelf, not books" : "Corner shelf",
      detail: [
        capped ? "A corner shelf stops at 48 inches along a wall. Longer than that will not be what you typed." : null,
        !tall ? "Height wasn't measured — it will be assumed." : null,
        reach < 6 ? `About ${reach} inches in front of the corner. Phones and plants.` : "Books fit.",
      ].filter(Boolean).join(" "),
      prompt,
    });
    if (Math.max(a, b) >= 48 && Math.min(a, b) >= 24) {
      const deskH = tall && tall >= 28 && tall <= 36 ? tall : null;
      models.push({
        id: "ldesk",
        label: "L desk",
        detail: deskH
          ? `${fmt(Math.max(a, b))} by ${fmt(Math.min(a, b))}, ${fmt(deskH)} tall.`
          : tall
            ? `${fmt(tall)} isn't desk height. This desk will be 30 tall, not ${fmt(tall)}.`
            : "30 tall, assumed.",
        prompt: `L-shaped corner desk ${fmt(Math.max(a, b))} by ${fmt(Math.min(a, b))} ${fmt(deskH ?? 30)} tall`,
      });
    }
  }

  if (m.high != null && m.low != null) {
    if (m.low >= m.high) {
      models.push({
        id: "slope",
        label: "Under the slope",
        detail: "The low side has to be the short one. Swap them.",
        prompt: "",
      });
    } else if (!m.wide) {
      models.push({
        id: "slope",
        label: "Under the slope",
        detail: "Width wasn't measured — a slope needs it.",
        prompt: "",
      });
    } else if (m.high - m.low < 6) {
      models.push({
        id: "slope",
        label: "Under the slope",
        detail: `Only ${fmt(m.high - m.low)} inches of slope. A straight bookcase is the honest piece.`,
        prompt: `bookcase ${fmt(m.wide)} wide 12 deep ${fmt(m.high)} tall`,
      });
    } else {
      const deepBit = m.deep ? ` ${fmt(m.deep)} deep` : "";
      models.push({
        id: "slope",
        label: "Under the slope",
        detail: m.deep ? "Uses the depth you measured." : "12 deep, assumed.",
        prompt: `bookshelf under a sloped ceiling ${fmt(m.wide)} wide${deepBit} ${fmt(m.high)} tall at the high side ${fmt(m.low)} at the low side`,
      });
    }
  }

  const usable = models.filter((model) => model.prompt);
  return { line, models: usable, note: usable.length ? null : "Nothing on this list can take just those numbers." };
}
