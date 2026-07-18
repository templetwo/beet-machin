import { beforeEach, describe, expect, it } from "vitest";
import { makeBlankProject } from "@beet/shared";
import { useProjectStore } from "./projectStore";

function store() {
  return useProjectStore.getState();
}

function freshProject() {
  const p = makeBlankProject("Test Jam");
  store().loadProject(p);
  return useProjectStore.getState().project;
}

describe("projectStore", () => {
  beforeEach(() => {
    useProjectStore.setState({ project: null, undoStack: [], redoStack: [], saveState: "idle" });
  });

  it("cycles drum step velocity off -> soft -> normal -> accent -> off", () => {
    const p = freshProject();
    const trackId = p?.tracks[0]?.id ?? "";
    const sceneId = p?.activeSceneId ?? "";

    const velAt = () => {
      const clip = useProjectStore
        .getState()
        .project?.scenes.find((s) => s.id === sceneId)?.clipsByTrackId[trackId];
      if (!clip || clip.kind !== "drums") return undefined;
      return clip.steps.find((s) => s.step === 0 && s.padId === "kick")?.velocity;
    };

    expect(velAt()).toBeUndefined();
    store().toggleDrumStep(trackId, sceneId, 0, "kick");
    expect(velAt()).toBe(0.5);
    store().toggleDrumStep(trackId, sceneId, 0, "kick");
    expect(velAt()).toBe(0.8);
    store().toggleDrumStep(trackId, sceneId, 0, "kick");
    expect(velAt()).toBe(1);
    store().toggleDrumStep(trackId, sceneId, 0, "kick");
    expect(velAt()).toBeUndefined();
  });

  it("bumps revision and supports undo/redo", () => {
    const p = freshProject();
    const trackId = p?.tracks[0]?.id ?? "";
    const sceneId = p?.activeSceneId ?? "";
    const rev0 = p?.revision ?? -1;

    store().toggleDrumStep(trackId, sceneId, 3, "snare");
    expect(useProjectStore.getState().project?.revision).toBe(rev0 + 1);

    store().undo();
    expect(useProjectStore.getState().project?.revision).toBe(rev0);
    const clipAfterUndo = useProjectStore
      .getState()
      .project?.scenes.find((s) => s.id === sceneId)?.clipsByTrackId[trackId];
    expect(clipAfterUndo?.kind === "drums" && clipAfterUndo.steps.length).toBe(0);

    store().redo();
    const clipAfterRedo = useProjectStore
      .getState()
      .project?.scenes.find((s) => s.id === sceneId)?.clipsByTrackId[trackId];
    expect(clipAfterRedo?.kind === "drums" && clipAfterRedo.steps.length).toBe(1);
  });

  it("caps tracks at 8 and gives new tracks clips in every scene", () => {
    freshProject();
    let lastId: string | null = null;
    for (let i = 0; i < 12; i++) {
      lastId = store().addTrack(i % 2 === 0 ? "instrument" : "drums");
    }
    const p = useProjectStore.getState().project;
    expect(p?.tracks.length).toBe(8);
    expect(lastId).toBeNull(); // additions past 8 are refused
    for (const scene of p?.scenes ?? []) {
      expect(Object.keys(scene.clipsByTrackId).length).toBe(8);
    }
  });

  it("snaps every melody note when key/scale changes", () => {
    const p = freshProject();
    const sceneId = p?.activeSceneId ?? "";
    const melId = store().addTrack("instrument") ?? "";
    store().recordNote(melId, sceneId, 0, 61, 1); // C#, out of C pentatonic minor

    store().setKeyScale("C", "pentatonicMinor");
    const clip = useProjectStore
      .getState()
      .project?.scenes.find((s) => s.id === sceneId)?.clipsByTrackId[melId];
    const midi = clip?.kind === "melody" ? clip.notes[0]?.midi : undefined;
    expect(midi).toBe(60); // snapped down to the root
  });

  it("moves, duplicates, and removes arrangement blocks", () => {
    const p = freshProject();
    const [a, b] = [p?.scenes[0]?.id ?? "", p?.scenes[1]?.id ?? ""];
    store().arrangementAdd(a);
    store().arrangementAdd(b);
    expect(useProjectStore.getState().project?.arrangement).toEqual([a, a, b]); // blank starts with [A]

    store().arrangementMove(2, -1);
    expect(useProjectStore.getState().project?.arrangement).toEqual([a, b, a]);

    store().arrangementDuplicate(1);
    expect(useProjectStore.getState().project?.arrangement).toEqual([a, b, b, a]);

    store().arrangementRemove(0);
    expect(useProjectStore.getState().project?.arrangement).toEqual([b, b, a]);
  });
});
