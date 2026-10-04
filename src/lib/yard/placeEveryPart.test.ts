import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { placementIndex } from "./placeEveryPart.ts";

const prompts = [
  "dining chair 18 seat height",
  "kitchen chair from 1x4",
  "step stool 18 inches",
  "bench 48 wide",
  "desk 60 inches wide by 30 deep by 29 high",
  "bookcase 30 wide 48 tall",
  "linen closet 31.5 wide 78 tall 16 deep",
  "popsicle stick catapult",
  "PVC birdhouse",
];

describe("every part is placed after its support", () => {
  for (const prompt of prompts) {
    it(prompt, () => {
      const project = generateFromPrompt(prompt);
      const plan = buildPlan(project);
      const placed = placementIndex(project, plan.instructions);
      const parts = project.panels.length
        ? project.panels.filter((p) => p.type !== "drawer")
        : [...new Set(project.instances.map((i) => i.role || "member"))].map((role) => ({ id: role, name: role, type: role }));
      for (const part of parts) {
        const key = "id" in part && project.panels.length ? part.id : part.name;
        assert.ok(placed.has(key), `${prompt} never places ${part.name}`);
      }
      const seat = plan.instructions.find((s) => /seat|tread|rail/i.test(s.title));
      if (/chair|stool|bench/.test(prompt) && seat) {
        assert.match(`${seat.title} ${seat.description}`, /on the legs|on the aprons|on the frame|set the tread|rests on|attach .+ to/i);
      }
    });
  }
});
