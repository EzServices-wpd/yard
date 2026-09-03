/**
 * Buyable listings for catalog stock.
 * Same measurements only. Sorted by price per piece, any seller.
 * Prices are last checked on the product page — not a live API.
 * Amazon hrefs pick up the Associates tag when it is set.
 */

import type { BomLine, ShopOffer } from "./types";
import { FORGE_CATALOG, getCatalogItem } from "./catalog";
import { toPrimitive } from "./geometry";
import {
  affiliateUrl,
  amazonAssociateTag,
  shopLinks,
  stampAmazon,
  type ShopRetailer,
} from "./shop";

export type ListingOffer = {
  catalogId: string;
  retailer: "amazon" | "homedepot" | "lowes" | "walmart";
  title: string;
  href: string;
  asin?: string;
  packQty: number;
  packPrice: number;
  lengthIn: number;
  widthIn?: number;
  thickIn?: number;
  checkedAt: string;
};

export type PricedOffer = ListingOffer & {
  unitPrice: number;
  packsNeeded: number;
  lineTotal: number;
  best: boolean;
};

const CHECK = "2026-08-19";

export const LISTINGS: ListingOffer[] = [
  {
    catalogId: "popsicle-standard",
    retailer: "amazon",
    title: "GUSTO 4.5\" popsicle sticks, 1000 count",
    href: "https://www.amazon.com/dp/B0931TYTN4",
    asin: "B0931TYTN4",
    packQty: 1000,
    packPrice: 14.98,
    lengthIn: 4.5,
    widthIn: 0.375,
    thickIn: 0.08,
    checkedAt: CHECK,
  },
  {
    catalogId: "popsicle-standard",
    retailer: "amazon",
    title: "CraftySticks 4.5\" x 3/8\" sticks, 1000 pack",
    href: "https://www.amazon.com/dp/B07YM541VG",
    asin: "B07YM541VG",
    packQty: 1000,
    packPrice: 28.95,
    lengthIn: 4.5,
    widthIn: 0.375,
    thickIn: 0.09,
    checkedAt: CHECK,
  },
  {
    catalogId: "popsicle-jumbo",
    retailer: "amazon",
    title: "Darice 6\" jumbo craft sticks, 500 pack",
    href: "https://www.amazon.com/dp/B0CPKHS44K",
    asin: "B0CPKHS44K",
    packQty: 500,
    packPrice: 12.99,
    lengthIn: 6,
    widthIn: 0.75,
    thickIn: 0.08,
    checkedAt: CHECK,
  },
  {
    catalogId: "popsicle-jumbo",
    retailer: "amazon",
    title: "1200 pack 6\" jumbo wood sticks",
    href: "https://www.amazon.com/dp/B0CD7PP3R1",
    asin: "B0CD7PP3R1",
    packQty: 1200,
    packPrice: 18.99,
    lengthIn: 6,
    widthIn: 0.75,
    thickIn: 0.08,
    checkedAt: CHECK,
  },
  {
    catalogId: "toothpick",
    retailer: "walmart",
    title: "Diamond Classic round toothpicks, 800 count",
    href: "https://www.walmart.com/ip/Diamond-Classic-Round-Toothpicks-Toothpick-Box-800-Count-Wood-Toothpicks/15055437",
    packQty: 800,
    packPrice: 2.97,
    lengthIn: 2.5,
    checkedAt: CHECK,
  },
  {
    catalogId: "toothpick",
    retailer: "amazon",
    title: "Royal plain round toothpicks, 800 count",
    href: "https://www.amazon.com/dp/B01E5UD40I",
    asin: "B01E5UD40I",
    packQty: 800,
    packPrice: 6.49,
    lengthIn: 2.5,
    checkedAt: CHECK,
  },
  {
    catalogId: "straw-plastic",
    retailer: "amazon",
    title: "Plastic drinking straws, 500 count (7.75\")",
    href: "https://www.amazon.com/s?k=plastic+drinking+straws+bulk+500",
    packQty: 500,
    packPrice: 8.99,
    lengthIn: 7.75,
    checkedAt: CHECK,
  },
  {
    catalogId: "straw-plastic",
    retailer: "walmart",
    title: "Great Value plastic straws, 250 count",
    href: "https://www.walmart.com/search?q=plastic+drinking+straws+bulk",
    packQty: 250,
    packPrice: 4.48,
    lengthIn: 7.75,
    checkedAt: CHECK,
  },
  {
    catalogId: "straw-plastic",
    retailer: "amazon",
    title: "Clear plastic straws bulk pack, 1000 count",
    href: "https://www.amazon.com/s?k=plastic+straws+1000+count",
    packQty: 1000,
    packPrice: 12.99,
    lengthIn: 7.75,
    checkedAt: CHECK,
  },
  {
    catalogId: "bamboo-skewer-12",
    retailer: "amazon",
    title: "Perfect Stix 12\" bamboo skewers, 100 count",
    href: "https://www.amazon.com/s?k=Perfect+Stix+12+inch+bamboo+skewers+100",
    packQty: 100,
    packPrice: 6.99,
    lengthIn: 12,
    checkedAt: CHECK,
  },
  {
    catalogId: "lumber-2x4-8",
    retailer: "homedepot",
    title: "2x4x96\" #2 KD-HT stud",
    href: "https://www.homedepot.com/p/2-in-x-4-in-x-96-in-2-Premium-Grade-KD-HT-Stud-058449/312528776",
    packQty: 1,
    packPrice: 3.95,
    lengthIn: 96,
    widthIn: 3.5,
    thickIn: 1.5,
    checkedAt: CHECK,
  },
  {
    catalogId: "lumber-2x4-8",
    retailer: "lowes",
    title: "2x4x8 kiln-dried whitewood stud",
    href: "https://www.lowes.com/search?searchTerm=2x4x8%20stud",
    packQty: 1,
    packPrice: 4.15,
    lengthIn: 96,
    widthIn: 3.5,
    thickIn: 1.5,
    checkedAt: CHECK,
  },
  {
    catalogId: "lumber-2x2-8",
    retailer: "homedepot",
    title: "2x2x8 lumber (1-1/2\" actual)",
    href: "https://www.homedepot.com/s/2x2x8%20lumber",
    packQty: 1,
    packPrice: 4.5,
    lengthIn: 96,
    widthIn: 1.5,
    thickIn: 1.5,
    checkedAt: CHECK,
  },
  {
    catalogId: "plywood-3-4-4x8",
    retailer: "homedepot",
    title: "3/4\" x 4x8 Sande sanded plywood",
    href: "https://www.homedepot.com/p/SANDEPLY-18mm-Sande-Plywood-3-4-in-Category-x-4-ft-x-8-ft-Actual-0-709-in-x-48-in-x-96-in-454559/203414066",
    packQty: 1,
    packPrice: 38.43,
    lengthIn: 96,
    widthIn: 48,
    thickIn: 0.709,
    checkedAt: CHECK,
  },
  {
    catalogId: "pvc-3-4-sch40",
    retailer: "homedepot",
    title: "Charlotte 3/4\" x 10' Sch 40 PVC",
    href: "https://www.homedepot.com/p/Charlotte-Pipe-3-4-in-x-10-ft-PVC-Schedule-40-Pressure-Plain-End-Pipe-PVC-04007-0600/100348472",
    packQty: 1,
    packPrice: 5.76,
    lengthIn: 120,
    checkedAt: CHECK,
  },
  {
    catalogId: "pvc-3-4-sch40",
    retailer: "lowes",
    title: "3/4\" x 10' Sch 40 PVC pipe",
    href: "https://www.lowes.com/search?searchTerm=3%2F4%20inch%20schedule%2040%20PVC%2010%20ft",
    packQty: 1,
    packPrice: 6.28,
    lengthIn: 120,
    checkedAt: CHECK,
  },
  {
    catalogId: "dowel-1-2-36",
    retailer: "amazon",
    title: "1/2\" x 36\" hardwood dowels, 10 pack",
    href: "https://www.amazon.com/s?k=ALBO+1%2F2+x+36+wooden+dowel+10+pack",
    packQty: 10,
    packPrice: 16.99,
    lengthIn: 36,
    checkedAt: CHECK,
  },
  {
    catalogId: "glue",
    retailer: "homedepot",
    title: "Titebond Original wood glue, 8 oz",
    href: "https://www.homedepot.com/p/Titebond-8-oz-Original-Wood-Glue-5063/202180088",
    packQty: 1,
    packPrice: 4.98,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "glue",
    retailer: "amazon",
    title: "Titebond Original wood glue, 8 oz",
    href: "https://www.amazon.com/s?k=Titebond+Original+wood+glue+8+oz",
    packQty: 1,
    packPrice: 5.47,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "tape-packing",
    retailer: "homedepot",
    title: "Scotch 1.88\" packing tape",
    href: "https://www.homedepot.com/s/packing%20tape",
    packQty: 1,
    packPrice: 3.97,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "pvc-cement",
    retailer: "homedepot",
    title: "Oatey PVC regular cement, 8 oz",
    href: "https://www.homedepot.com/s/PVC%20cement",
    packQty: 1,
    packPrice: 7.48,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "pvc-tee",
    retailer: "homedepot",
    title: "Charlotte 3/4\" Sch 40 PVC tee",
    href: "https://www.homedepot.com/s/3%2F4%20inch%20PVC%20tee%20schedule%2040",
    packQty: 1,
    packPrice: 1.18,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "pvc-elbow-90",
    retailer: "homedepot",
    title: "Charlotte 3/4\" Sch 40 90 degree elbow",
    href: "https://www.homedepot.com/s/3%2F4%20inch%20PVC%2090%20elbow",
    packQty: 1,
    packPrice: 0.88,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "pvc-elbow-45",
    retailer: "homedepot",
    title: "Charlotte 3/4\" Sch 40 45 degree elbow",
    href: "https://www.homedepot.com/s/3%2F4%20inch%20PVC%2045%20elbow",
    packQty: 1,
    packPrice: 0.92,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "pvc-coupling",
    retailer: "homedepot",
    title: "Charlotte 3/4\" Sch 40 coupling",
    href: "https://www.homedepot.com/s/3%2F4%20inch%20PVC%20coupling",
    packQty: 1,
    packPrice: 0.68,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "screws-8",
    retailer: "homedepot",
    title: "#8 x 1-1/4\" wood screws, 1 lb",
    href: "https://www.homedepot.com/s/%238%201-1%2F4%20wood%20screws",
    packQty: 1,
    packPrice: 8.47,
    lengthIn: 1.25,
    checkedAt: CHECK,
  },
  {
    catalogId: "screws-8",
    retailer: "amazon",
    title: "#8 x 1-1/4\" wood screws",
    href: "https://www.amazon.com/s?k=%238+1-1%2F4+wood+screws",
    packQty: 1,
    packPrice: 9.29,
    lengthIn: 1.25,
    checkedAt: CHECK,
  },
  {
    catalogId: "drawer-slides-16",
    retailer: "amazon",
    title: "16\" side-mount drawer slides, pair",
    href: "https://www.amazon.com/s?k=16+inch+side+mount+drawer+slides",
    packQty: 1,
    packPrice: 12.99,
    lengthIn: 16,
    checkedAt: CHECK,
  },
  {
    catalogId: "drawer-slides-16",
    retailer: "homedepot",
    title: "16\" side-mount drawer slides",
    href: "https://www.homedepot.com/s/16%20inch%20side%20mount%20drawer%20slides",
    packQty: 1,
    packPrice: 14.98,
    lengthIn: 16,
    checkedAt: CHECK,
  },
  {
    catalogId: "drawer-slides-18",
    retailer: "amazon",
    title: "18\" side-mount drawer slides, pair",
    href: "https://www.amazon.com/s?k=18+inch+side+mount+drawer+slides",
    packQty: 1,
    packPrice: 14.99,
    lengthIn: 18,
    checkedAt: CHECK,
  },
  {
    catalogId: "drawer-slides-18",
    retailer: "homedepot",
    title: "18\" side-mount drawer slides",
    href: "https://www.homedepot.com/s/18%20inch%20side%20mount%20drawer%20slides",
    packQty: 1,
    packPrice: 16.98,
    lengthIn: 18,
    checkedAt: CHECK,
  },
  {
    catalogId: "drawer-slides-22",
    retailer: "amazon",
    title: "22\" side-mount drawer slides, pair",
    href: "https://www.amazon.com/s?k=22+inch+side+mount+drawer+slides",
    packQty: 1,
    packPrice: 16.99,
    lengthIn: 22,
    checkedAt: CHECK,
  },
  {
    catalogId: "drawer-slides-22",
    retailer: "homedepot",
    title: "22\" side-mount drawer slides",
    href: "https://www.homedepot.com/s/22%20inch%20side%20mount%20drawer%20slides",
    packQty: 1,
    packPrice: 19.98,
    lengthIn: 22,
    checkedAt: CHECK,
  },
  {
    catalogId: "cabinet-hinges",
    retailer: "amazon",
    title: "Soft-close concealed cabinet hinges, pair",
    href: "https://www.amazon.com/s?k=soft+close+concealed+cabinet+hinges",
    packQty: 2,
    packPrice: 8.99,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "shelf-pins",
    retailer: "amazon",
    title: "5 mm shelf pins, 50 pack",
    href: "https://www.amazon.com/s?k=5mm+shelf+pins",
    packQty: 50,
    packPrice: 6.49,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "closet-rod-sockets",
    retailer: "homedepot",
    title: "Closet rod sockets / flanges, pair",
    href: "https://www.homedepot.com/s/closet%20rod%20sockets",
    packQty: 2,
    packPrice: 7.98,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "closet-rod-sockets",
    retailer: "amazon",
    title: "Closet rod sockets flanges pair",
    href: "https://www.amazon.com/s?k=closet+rod+sockets+flanges",
    packQty: 2,
    packPrice: 8.49,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "structural-screws",
    retailer: "homedepot",
    title: "GRK structural / RSS screws",
    href: "https://www.homedepot.com/s/GRK%20RSS%20structural%20screws",
    packQty: 1,
    packPrice: 18.97,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "structural-screws",
    retailer: "amazon",
    title: "GRK RSS structural screws",
    href: "https://www.amazon.com/s?k=GRK+RSS+structural+screws",
    packQty: 1,
    packPrice: 19.99,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "tapcon",
    retailer: "homedepot",
    title: "Tapcon concrete screws",
    href: "https://www.homedepot.com/s/Tapcon%20concrete%20screws",
    packQty: 1,
    packPrice: 12.48,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "flashing-tape",
    retailer: "homedepot",
    title: "Window flashing tape / sill pan",
    href: "https://www.homedepot.com/s/window%20flashing%20tape%20pan",
    packQty: 1,
    packPrice: 17.98,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "shims",
    retailer: "homedepot",
    title: "Wood shims, bundle",
    href: "https://www.homedepot.com/s/wood%20shims",
    packQty: 1,
    packPrice: 3.98,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "framing-nails",
    retailer: "homedepot",
    title: "16d framing nails",
    href: "https://www.homedepot.com/s/16d%20framing%20nails",
    packQty: 1,
    packPrice: 9.97,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "window-foam",
    retailer: "homedepot",
    title: "Low-expansion window foam",
    href: "https://www.homedepot.com/s/low%20expansion%20window%20foam",
    packQty: 1,
    packPrice: 7.48,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "window-unit",
    retailer: "homedepot",
    title: "Andersen replacement / new-construction window",
    href: "https://www.homedepot.com/s/Andersen%2036x48%20double%20hung%20window",
    packQty: 1,
    packPrice: 289,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "vanity-mirror",
    retailer: "amazon",
    title: "Vanity wall mirror",
    href: "https://www.amazon.com/s?k=vanity+wall+mirror+22x16",
    packQty: 1,
    packPrice: 39.99,
    lengthIn: 0,
    checkedAt: CHECK,
  },
  {
    catalogId: "lumber-2x6-8",
    retailer: "homedepot",
    title: "2x6x8 kiln-dried framing lumber",
    href: "https://www.homedepot.com/s/2x6x8%20framing%20lumber",
    packQty: 1,
    packPrice: 8.75,
    lengthIn: 96,
    checkedAt: CHECK,
  },
  {
    catalogId: "lumber-2x8-8",
    retailer: "homedepot",
    title: "2x8x8 kiln-dried framing lumber",
    href: "https://www.homedepot.com/s/2x8x8%20framing%20lumber",
    packQty: 1,
    packPrice: 11.48,
    lengthIn: 96,
    checkedAt: CHECK,
  },
  {
    catalogId: "lumber-2x10-8",
    retailer: "homedepot",
    title: "2x10x8 kiln-dried framing lumber",
    href: "https://www.homedepot.com/s/2x10x8%20framing%20lumber",
    packQty: 1,
    packPrice: 16.87,
    lengthIn: 96,
    checkedAt: CHECK,
  },
  {
    catalogId: "plywood-1-4-4x8",
    retailer: "homedepot",
    title: "1/4\" x 4x8 sanded plywood",
    href: "https://www.homedepot.com/s/1%2F4%20inch%204x8%20plywood",
    packQty: 1,
    packPrice: 24.98,
    lengthIn: 96,
    widthIn: 48,
    thickIn: 0.25,
    checkedAt: CHECK,
  },
];

const RETAILER_LABEL: Record<ListingOffer["retailer"], string> = {
  amazon: "Amazon",
  homedepot: "Home Depot",
  lowes: "Lowe's",
  walmart: "Walmart",
};

function sameSize(a: ListingOffer, b: { lengthIn?: number; widthIn?: number; thickIn?: number }) {
  const close = (x?: number, y?: number) => {
    if (x == null || y == null || x === 0 || y === 0) return true;
    return Math.abs(x - y) / Math.max(x, y) <= 0.12;
  };
  return close(a.lengthIn, b.lengthIn) && close(a.widthIn, b.widthIn) && close(a.thickIn, b.thickIn);
}

export function offersFor(
  catalogId: string,
  piecesNeeded: number,
  dims?: { lengthIn?: number; widthIn?: number; thickIn?: number },
): PricedOffer[] {
  let rows = LISTINGS.filter((o) => o.catalogId === catalogId).filter((o) =>
    dims ? sameSize(o, dims) : true,
  );
  if (!rows.length) {
    const item = getCatalogItem(catalogId);
    const q = item?.searchQuery || item?.name || catalogId;
    const pack = item?.unitsPerPack ?? 1;
    const recycled =
      item?.unitCostUsd === 0 ||
      item?.category === "recycled" ||
      item?.category === "paper_tube" ||
      (item?.tags ?? []).includes("recycled");
    const price = recycled ? 0 : (item?.unitCostUsd ?? 0) * pack || 9.99;
    rows = shopLinks(q, item?.asin).map((l) => ({
      catalogId,
      retailer: l.retailer,
      title: item?.name ?? q,
      href: l.href,
      asin: item?.asin,
      packQty: pack,
      packPrice: price,
      lengthIn: item?.dims.length ?? 0,
      widthIn: item?.dims.width,
      thickIn: item?.dims.thickness,
      checkedAt: CHECK,
    }));
  }
  const priced = rows
    .map((o) => {
      const packsNeeded = Math.max(1, Math.ceil(piecesNeeded / Math.max(1, o.packQty)));
      const href = stampAmazon(
        o.retailer === "amazon"
          ? o.asin
            ? affiliateUrl({ query: o.title, asin: o.asin, retailer: "amazon" })
            : o.href
          : o.href,
      );
      return {
        ...o,
        href,
        unitPrice: o.packPrice / Math.max(1, o.packQty),
        packsNeeded,
        lineTotal: packsNeeded * o.packPrice,
        best: false,
      };
    })
    .sort((a, b) => {
      const aAm = a.retailer === "amazon" ? 0 : 1;
      const bAm = b.retailer === "amazon" ? 0 : 1;
      if (aAm !== bAm) return aAm - bAm;
      return a.unitPrice - b.unitPrice || a.lineTotal - b.lineTotal;
    });
  if (priced[0]) priced[0].best = true;
  return priced;
}

export function retailerLabel(id: ListingOffer["retailer"]) {
  return RETAILER_LABEL[id];
}

export function tagNote() {
  return amazonAssociateTag()
    ? "Amazon links use your Associates tag."
    : "Amazon links are plain product pages until VITE_PUBLIC_AMAZON_ASSOCIATE_TAG is set.";
}

function guessCatalogId(line: BomLine): string | null {
  if (line.catalogId) {
    if (LISTINGS.some((o) => o.catalogId === line.catalogId)) return line.catalogId;
    if (FORGE_CATALOG.some((c) => c.id === line.catalogId)) return line.catalogId;
  }
  const hay = `${line.name} ${line.searchQuery ?? ""}`.toLowerCase();
  if (/popsicle|craft stick/.test(hay) && /jumbo|6.?inch/.test(hay)) return "popsicle-jumbo";
  if (/popsicle|craft stick/.test(hay)) return "popsicle-standard";
  if (/toothpick/.test(hay)) return "toothpick";
  if (/skewer/.test(hay)) return "bamboo-skewer-12";
  if (/paper towel/.test(hay)) return "paper-towel-roll";
  if (/straw/.test(hay)) return "straw-plastic";
  if (/2\s*[x×]\s*10/.test(hay)) return "lumber-2x10-8";
  if (/2\s*[x×]\s*2|two by two/.test(hay)) return "lumber-2x2-8";
  if (/2\s*[x×]\s*8/.test(hay)) return "lumber-2x8-8";
  if (/2\s*[x×]\s*6/.test(hay)) return "lumber-2x6-8";
  if (/2\s*[x×]\s*4|two by four|stud/.test(hay)) return "lumber-2x4-8";
  if (/foam board|foamcore|foam-board/.test(hay)) return "foam-board-20x30";
  if (/cardboard/.test(hay)) return "cardboard-corrugated-sheet";
  // Thin backer before generic plywood
  if (/1\/4|quarter.?inch|backer/.test(hay) && /ply/.test(hay)) return "plywood-1-4-4x8";
  if (/plywood/.test(hay)) return "plywood-3-4-4x8";
  if (/solvent|pvc cement/.test(hay)) return "pvc-cement";
  if (/pvc tee|\btee\b/.test(hay) && /pvc|slip/.test(hay)) return "pvc-tee";
  if (/45/.test(hay) && /elbow|pvc/.test(hay)) return "pvc-elbow-45";
  if (/elbow/.test(hay) && /pvc/.test(hay)) return "pvc-elbow-90";
  if (/coupling|coupler/.test(hay) && /pvc/.test(hay)) return "pvc-coupling";
  if (/pvc|schedule 40/.test(hay)) return "pvc-3-4-sch40";
  if (/dowel/.test(hay)) return "dowel-1-2-36";
  if (/titebond|wood glue|\bglue\b/.test(hay)) return "glue";
  if (/packing tape|duct tape|\btape\b/.test(hay)) return "tape-packing";
  // Structural / lag BEFORE generic wood screws ("Structural wood screws / lag" contains both)
  if (/grk|structural|lag|rss|tapcon|masonry/.test(hay)) {
    if (/tapcon|masonry|concrete/.test(hay)) return "tapcon";
    return "structural-screws";
  }
  if (/#8|wood screw/.test(hay)) return "screws-8";
  if (/slide/.test(hay)) {
    if (/\b22\b/.test(hay)) return "drawer-slides-22";
    if (/\b18\b/.test(hay)) return "drawer-slides-18";
    return "drawer-slides-16";
  }
  if (/hinge/.test(hay)) return "cabinet-hinges";
  if (/shelf pin/.test(hay)) return "shelf-pins";
  if (/rod socket|rod flange|closet rod socket/.test(hay)) return "closet-rod-sockets";
  if (/flashing|sill pan/.test(hay)) return "flashing-tape";
  if (/shim/.test(hay)) return "shims";
  if (/16d|framing nail/.test(hay)) return "framing-nails";
  if (/foam/.test(hay) && /window|expansion/.test(hay)) return "window-foam";
  if (/\bwindow\b/.test(hay) && /andersen|pella|hung|casement|unit/.test(hay)) return "window-unit";
  if (/mirror/.test(hay)) return "vanity-mirror";
  return line.catalogId ?? null;
}

function searchOffers(query: string, asin: string | undefined, qty: number): ShopOffer[] {
  const links = shopLinks(query, asin);
  return links.map((l, i) => ({
    retailer: l.retailer,
    label: l.label,
    title: query,
    href: stampAmazon(l.href),
    packQty: Math.max(1, qty),
    packPrice: 0,
    unitPrice: i,
    packsNeeded: 1,
    lineTotal: 0,
    best: i === 0,
    checkedAt: CHECK,
  }));
}

export function decorateBom(lines: BomLine[]): BomLine[] {
  return lines.map((line) => {
    const id = guessCatalogId(line);
    const item = id ? getCatalogItem(id) : undefined;
    const prim = item ? toPrimitive(item) : undefined;
    const packMatch = line.unit.match(/pack of (\d+)/i);
    const pieces = packMatch ? line.quantity * parseInt(packMatch[1], 10) : line.quantity;
    const priced = id
      ? offersFor(
          id,
          Math.max(1, pieces),
          prim ? { lengthIn: prim.length, widthIn: prim.width, thickIn: prim.height } : undefined,
        )
      : [];
    let offers: ShopOffer[] = priced.map((o) => ({
      retailer: o.retailer,
      label: retailerLabel(o.retailer as ShopRetailer),
      title: o.title,
      href: stampAmazon(o.href),
      packQty: o.packQty,
      packPrice: o.packPrice,
      unitPrice: o.unitPrice,
      packsNeeded: o.packsNeeded,
      lineTotal: o.lineTotal,
      best: o.best,
      checkedAt: o.checkedAt,
    }));
    if (!offers.length) {
      offers = searchOffers(line.searchQuery || line.name, line.asin, Math.max(1, line.quantity));
    }
    const best = offers.find((o) => o.best) ?? offers[0];
    return {
      ...line,
      catalogId: id ?? line.catalogId,
      asin: line.asin ?? priced.find((o) => o.asin)?.asin,
      estimatedCost: best && best.lineTotal > 0 ? best.lineTotal : line.estimatedCost,
      offers,
    };
  });
}
