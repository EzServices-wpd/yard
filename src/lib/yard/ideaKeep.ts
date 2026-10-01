/**
 * Print is the moment a plan can join Ideas.
 * Local gate first (intent, soundness, already-built). Grok files a new idea.
 */
import { reviewPrintedIdea } from "@/lib/ai/ideaReview";
import { getCatalogItem } from "./catalog";
import { IDEAS } from "./ideas";
import { inspectHonesty } from "./honesty";
import {
  acceptIdeaCard,
  ideaSignature,
  ideaStem,
  listLearnedIdeas,
  localLibraryDecision,
  readJudgement,
  rememberJudgement,
  saveLearnedIdea,
  type IdeaCandidate,
  type KnownIdea,
} from "./ideaLibrary";
import { isWireStock } from "./promptHelpers";
import type { BuildPlan, YardProject } from "./types";
import { fmtUnitEnvelopeInches } from "./voiceHonesty";
import { namedStockDisplayName } from "./weekendStockHonesty";

const inflight = new Map<string, Promise<KeepResult>>();

export type KeepResult = { added: boolean; knownLabel?: string };

function knownIdeas(): (KnownIdea & { section: string })[] {
  const learned = listLearnedIdeas().map((i) => ({ prompt: i.prompt, label: i.label, section: i.section }));
  const seed = IDEAS.map((i) => ({ prompt: i.prompt, label: i.label, section: i.section }));
  return [...seed, ...learned];
}

function partsBrief(plan: BuildPlan): string {
  const rows = plan.cutList.filter((c) => c.name && c.quantity > 0).slice(0, 10);
  if (rows.length) {
    const body = rows.map((c) => `${c.quantity} ${c.name}`).join(", ");
    const more = plan.cutList.length > rows.length ? ` (+${plan.cutList.length - rows.length})` : "";
    return `${body}${more}`.slice(0, 280);
  }
  return plan.instructions
    .slice(0, 4)
    .map((s) => s.title)
    .filter(Boolean)
    .join("; ")
    .slice(0, 280);
}

function warningsBrief(plan: BuildPlan): string {
  return plan.feasibility.issues
    .filter((i) => i.severity !== "info")
    .slice(0, 3)
    .map((i) => i.message)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function soundsKnown(reason: string): boolean {
  return /already|same idea|not new|on the list|listed|have this|have one/i.test(reason);
}

export function candidateFromPrint(project: YardProject, plan: BuildPlan): IdeaCandidate {
  const material = getCatalogItem(project.primaryMaterialId);
  const wire = isWireStock(material);
  const unit = project.fitted?.unit ?? project.pocket?.unit ?? project.overall;
  const size = fmtUnitEnvelopeInches(unit.width, unit.height, unit.depth, {
    shape: project.fitted?.unit?.shape,
    prompt: project.prompt,
    name: project.name,
    legs: project.fitted?.unit?.legs,
  });
  const honesty = inspectHonesty(project, plan);
  const pieces = plan.totals.pieces || project.instances.length + project.panels.length;
  const stock = wire ? "" : namedStockDisplayName(project.prompt ?? "", material);
  const place = [
    project.assumptions?.installMode,
    project.fitted?.family,
    ...(project.fitted?.affordances ?? []).slice(0, 3),
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    prompt: (project.prompt ?? "").trim(),
    name: (project.name ?? "").trim(),
    size,
    kind: project.kind,
    stock: stock === "stock" ? "" : stock,
    pieces,
    feasibility: plan.feasibility.status,
    summary: plan.feasibility.summary ?? "",
    honestyOk: honesty.ok,
    wire,
    parts: partsBrief(plan),
    warnings: warningsBrief(plan),
    place,
    steps: plan.instructions.length,
  };
}

export async function keepPrintedIdea(project: YardProject, plan: BuildPlan): Promise<KeepResult> {
  const candidate = candidateFromPrint(project, plan);
  const known = knownIdeas();
  const gate = localLibraryDecision(candidate, known);
  const sig = ideaSignature(candidate);
  if (!gate.call) {
    return { added: false, knownLabel: gate.reason === "already built" ? gate.match : undefined };
  }

  const prior = readJudgement(sig);
  if (prior?.added) {
    const saved = listLearnedIdeas().find((i) => ideaStem(i.prompt) === ideaStem(candidate.prompt));
    return { added: false, knownLabel: saved?.label || candidate.name };
  }
  if (prior) return { added: false, knownLabel: prior.known };

  const pending = inflight.get(sig);
  if (pending) return pending;

  const job = (async () => {
    let review: Awaited<ReturnType<typeof reviewPrintedIdea>>;
    try {
      review = await reviewPrintedIdea({
        data: {
          prompt: candidate.prompt,
          name: candidate.name,
          size: candidate.size,
          kind: candidate.kind,
          stock: candidate.stock,
          pieces: candidate.pieces,
          feasibility: candidate.feasibility,
          summary: candidate.summary,
          parts: candidate.parts,
          warnings: candidate.warnings,
          place: candidate.place,
          steps: candidate.steps,
          known: known.map((k) => ({ label: k.label, section: k.section })),
        },
      });
    } catch {
      return { added: false };
    }
    if (!review.ok || !review.add || !review.idea) {
      if (review.ok) {
        const knownLabel = soundsKnown(review.reason) ? candidate.name : undefined;
        rememberJudgement(sig, false, knownLabel);
        return { added: false, knownLabel };
      }
      return { added: false };
    }
    const card = acceptIdeaCard(review.idea, candidate, known);
    if (!card) {
      rememberJudgement(sig, false);
      return { added: false };
    }
    saveLearnedIdea(card);
    rememberJudgement(sig, true);
    return { added: true };
  })();

  inflight.set(sig, job);
  try {
    return await job;
  } finally {
    inflight.delete(sig);
  }
}
