/**
 * The bench's Measure readout: the header's own W × D × H (typed axes as typed, assumed axes the model's extent),
 * then the proud-front note and the mode's companion words. A round piece keeps its "dia × H" talk.
 * Its own component so the one-size test renders exactly what the bench shows (Critic row 134: check the rendered
 * output, not the source text).
 */
import { headerAxes } from "@/lib/yard/pdf";
import { headerSize } from "@/lib/yard/headerSize";
import { modelProudNote } from "@/lib/yard/modelSize";
import { fmtUnitEnvelopeInches, openingStorageMeasureEmptyTalk } from "@/lib/yard/voiceHonesty";
import type { YardProject } from "@/lib/yard/types";

export function MeasureReadout({ project, wire, workMode }: { project: YardProject; wire: boolean; workMode: string }) {
  const pocketUnit = (project.pocket ?? project.recastFrom?.pocket)?.unit;
  const proud = pocketUnit ? "" : modelProudNote(project.panels, project.overall.depth);
  const one = headerSize(project);
  const envelope = project.fitted?.unit?.shape !== "round"
    ? headerAxes(project)
    : fmtUnitEnvelopeInches(one.width, one.height, one.depth, {
        shape: project.fitted?.unit?.shape,
        prompt: project.prompt,
        name: project.name,
        legs: project.fitted?.unit?.legs,
      });
  const emptyTalk = pocketUnit ? null : openingStorageMeasureEmptyTalk(project.prompt);
  const companion = emptyTalk
    ? emptyTalk.hudCompanion
    : wire
      ? ""
      : workMode === "walk"
        ? " · on the road"
        : workMode === "build"
          ? " · snap to the glow"
          : "";
  return (
    <>
      {envelope}
      {proud ? ` · ${proud}` : ""}
      {companion}
    </>
  );
}
