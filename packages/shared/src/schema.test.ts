import { describe, expect, it } from "vitest";
import { ProjectSchema } from "./schema";
import { makeBlankProject, STARTER_TEMPLATES } from "./starters";
import { importAsProject, migrateProject, ProjectImportError } from "./migrate";

describe("Project schema", () => {
  it("accepts a freshly made blank project", () => {
    const p = makeBlankProject("Test Jam");
    expect(() => ProjectSchema.parse(p)).not.toThrow();
    expect(p.scenes).toHaveLength(4);
    expect(p.tracks.length).toBeGreaterThan(0);
    expect(p.activeSceneId).toBe(p.scenes[0]?.id);
  });

  it("accepts every starter template", () => {
    for (const t of STARTER_TEMPLATES) {
      const p = t.make();
      const result = ProjectSchema.safeParse(p);
      expect(result.success, `template ${t.id} should validate`).toBe(true);
    }
  });

  it("rejects out-of-range values", () => {
    const p = makeBlankProject();
    expect(ProjectSchema.safeParse({ ...p, bpm: 300 }).success).toBe(false);
    expect(ProjectSchema.safeParse({ ...p, swing: 0.9 }).success).toBe(false);
    expect(ProjectSchema.safeParse({ ...p, tracks: Array(9).fill(p.tracks[0]) }).success).toBe(
      false
    );
  });

  it("every starter clip references a real track and stays in step range", () => {
    for (const t of STARTER_TEMPLATES) {
      const p = t.make();
      const trackIds = new Set(p.tracks.map((tr) => tr.id));
      for (const scene of p.scenes) {
        for (const [trackId, clip] of Object.entries(scene.clipsByTrackId)) {
          expect(trackIds.has(trackId)).toBe(true);
          if (clip.kind === "drums") {
            for (const s of clip.steps) expect(s.step).toBeLessThan(16);
          } else {
            for (const note of clip.notes) expect(note.step).toBeLessThan(16);
          }
        }
      }
    }
  });
});

describe("migrateProject", () => {
  it("round-trips a valid v1 project through JSON", () => {
    const p = makeBlankProject("Round Trip");
    const restored = migrateProject(JSON.parse(JSON.stringify(p)));
    expect(restored).toEqual(p);
  });

  it("rejects garbage with a friendly error", () => {
    expect(() => migrateProject("nope")).toThrow(ProjectImportError);
    expect(() => migrateProject({ schemaVersion: 1, id: 42 })).toThrow(ProjectImportError);
  });

  it("rejects unknown future versions without destroying anything", () => {
    expect(() => migrateProject({ schemaVersion: 2 })).toThrow(ProjectImportError);
  });
});

describe("importAsProject", () => {
  it("keeps the id when there is no collision", () => {
    const p = makeBlankProject("Fresh");
    const { project, wasCopy } = importAsProject(JSON.parse(JSON.stringify(p)), new Set());
    expect(wasCopy).toBe(false);
    expect(project.id).toBe(p.id);
  });

  it("imports as a copy on id collision, never overwriting", () => {
    const p = makeBlankProject("Twin");
    const { project, wasCopy } = importAsProject(
      JSON.parse(JSON.stringify(p)),
      new Set([p.id])
    );
    expect(wasCopy).toBe(true);
    expect(project.id).not.toBe(p.id);
    expect(project.title).toContain("(copy)");
  });
});
