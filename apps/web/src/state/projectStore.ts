import { create } from "zustand";
import {
  makeEmptyClip,
  MAX_ARRANGEMENT,
  MAX_TRACKS,
  nextVelocity,
  snapToScale,
  TRACK_COLORS,
  uid,
  type MusicalKey,
  type NoteLength,
  type Project,
  type ScaleName,
  type Track
} from "@beet/shared";
import { persistHook } from "./persistHook";

export type SaveState = "idle" | "saving" | "saved" | "error";

const UNDO_LIMIT = 50;

interface ProjectState {
  project: Project | null;
  undoStack: Project[];
  redoStack: Project[];
  saveState: SaveState;

  loadProject: (p: Project) => void;
  closeProject: () => void;
  setSaveState: (s: SaveState) => void;

  /** Core mutation: clone, mutate, bump revision, push undo, schedule save. */
  apply: (label: string, mutate: (draft: Project) => void) => void;
  undo: () => void;
  redo: () => void;

  renameProject: (title: string) => void;
  setBpm: (bpm: number) => void;
  setSwing: (swing: number) => void;
  setMasterVolume: (v: number) => void;
  setPlaybackMode: (mode: Project["playbackMode"]) => void;
  setKeyScale: (key: MusicalKey, scale: ScaleName) => void;

  toggleDrumStep: (trackId: string, sceneId: string, step: number, padId: string) => void;
  recordDrumHit: (trackId: string, sceneId: string, step: number, padId: string) => void;
  toggleMelodyCell: (
    trackId: string,
    sceneId: string,
    step: number,
    midi: number,
    length: NoteLength
  ) => void;
  recordNote: (
    trackId: string,
    sceneId: string,
    step: number,
    midi: number,
    length: NoteLength
  ) => void;

  addTrack: (kind: Track["kind"]) => string | null;
  removeTrack: (trackId: string) => void;
  duplicateTrack: (trackId: string) => string | null;
  setTrackParams: (trackId: string, patch: Partial<Track>) => void;
  toggleMute: (trackId: string) => void;
  toggleSolo: (trackId: string) => void;

  setActiveScene: (sceneId: string) => void;
  renameScene: (sceneId: string, name: string) => void;
  clearScene: (sceneId: string) => void;
  copySceneTo: (fromId: string, toId: string) => void;

  arrangementAdd: (sceneId: string) => void;
  arrangementRemove: (index: number) => void;
  arrangementMove: (index: number, dir: -1 | 1) => void;
  arrangementDuplicate: (index: number) => void;
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  project: null,
  undoStack: [],
  redoStack: [],
  saveState: "idle",

  loadProject: (p) =>
    set({ project: structuredClone(p), undoStack: [], redoStack: [], saveState: "saved" }),

  closeProject: () => {
    persistHook.flush();
    set({ project: null, undoStack: [], redoStack: [], saveState: "idle" });
  },

  setSaveState: (saveState) => set({ saveState }),

  apply: (_label, mutate) => {
    const before = get().project;
    if (!before) return;
    const next = structuredClone(before);
    mutate(next);
    next.updatedAt = new Date().toISOString();
    next.revision = before.revision + 1;
    set((s) => ({
      project: next,
      undoStack: [...s.undoStack.slice(-(UNDO_LIMIT - 1)), before],
      redoStack: [],
      saveState: "saving"
    }));
    persistHook.schedule(next);
  },

  undo: () => {
    const { project, undoStack, redoStack } = get();
    const prev = undoStack[undoStack.length - 1];
    if (!project || !prev) return;
    set({
      project: prev,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, project].slice(-UNDO_LIMIT),
      saveState: "saving"
    });
    persistHook.schedule(prev);
  },

  redo: () => {
    const { project, undoStack, redoStack } = get();
    const next = redoStack[redoStack.length - 1];
    if (!project || !next) return;
    set({
      project: next,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, project].slice(-UNDO_LIMIT),
      saveState: "saving"
    });
    persistHook.schedule(next);
  },

  renameProject: (title) =>
    get().apply("Rename jam", (p) => {
      p.title = title.trim().slice(0, 60) || "New Jam";
    }),

  setBpm: (bpm) =>
    get().apply("Tempo", (p) => {
      p.bpm = Math.min(180, Math.max(60, Math.round(bpm)));
    }),

  setSwing: (swing) =>
    get().apply("Swing", (p) => {
      p.swing = Math.min(0.6, Math.max(0, swing));
    }),

  setMasterVolume: (v) =>
    get().apply("Master volume", (p) => {
      p.masterVolume = Math.min(1, Math.max(0, v));
    }),

  setPlaybackMode: (mode) =>
    get().apply("Playback mode", (p) => {
      p.playbackMode = mode;
    }),

  setKeyScale: (key, scale) =>
    get().apply("Key and scale", (p) => {
      p.key = key;
      p.scale = scale;
      // Keep every melody note visible and in tune under the new scale.
      for (const scene of p.scenes) {
        for (const clip of Object.values(scene.clipsByTrackId)) {
          if (clip.kind === "melody") {
            for (const note of clip.notes) {
              note.midi = snapToScale(note.midi, key, scale);
            }
          }
        }
      }
    }),

  toggleDrumStep: (trackId, sceneId, step, padId) =>
    get().apply("Drum step", (p) => {
      const clip = p.scenes.find((s) => s.id === sceneId)?.clipsByTrackId[trackId];
      if (!clip || clip.kind !== "drums") return;
      const existing = clip.steps.find((s) => s.step === step && s.padId === padId);
      const next = nextVelocity(existing?.velocity);
      clip.steps = clip.steps.filter((s) => !(s.step === step && s.padId === padId));
      if (next !== undefined) clip.steps.push({ step, padId, velocity: next });
    }),

  recordDrumHit: (trackId, sceneId, step, padId) =>
    get().apply("Record drum", (p) => {
      const clip = p.scenes.find((s) => s.id === sceneId)?.clipsByTrackId[trackId];
      if (!clip || clip.kind !== "drums") return;
      clip.steps = clip.steps.filter((s) => !(s.step === step && s.padId === padId));
      clip.steps.push({ step, padId, velocity: 0.9 });
    }),

  toggleMelodyCell: (trackId, sceneId, step, midi, length) =>
    get().apply("Melody note", (p) => {
      const clip = p.scenes.find((s) => s.id === sceneId)?.clipsByTrackId[trackId];
      if (!clip || clip.kind !== "melody") return;
      const existing = clip.notes.find((n) => n.step === step && n.midi === midi);
      if (existing) {
        clip.notes = clip.notes.filter((n) => !(n.step === step && n.midi === midi));
      } else {
        clip.notes.push({ step, midi, lengthSteps: length, velocity: 0.8 });
      }
    }),

  recordNote: (trackId, sceneId, step, midi, length) =>
    get().apply("Record note", (p) => {
      const clip = p.scenes.find((s) => s.id === sceneId)?.clipsByTrackId[trackId];
      if (!clip || clip.kind !== "melody") return;
      clip.notes = clip.notes.filter((n) => !(n.step === step && n.midi === midi));
      clip.notes.push({ step, midi, lengthSteps: length, velocity: 0.9 });
    }),

  addTrack: (kind) => {
    const p = get().project;
    if (!p || p.tracks.length >= MAX_TRACKS) return null;
    const id = uid();
    get().apply("Add track", (draft) => {
      const color = TRACK_COLORS[draft.tracks.length % TRACK_COLORS.length] ?? "#FF3B81";
      const base = {
        id,
        color,
        octave: kind === "drums" ? 3 : 4,
        volume: kind === "drums" ? 0.85 : 0.8,
        pan: 0,
        reverbSend: kind === "drums" ? 0.08 : 0.18,
        muted: false,
        solo: false
      };
      const track: Track =
        kind === "drums"
          ? { ...base, kind, name: `Drums ${draft.tracks.filter((t) => t.kind === "drums").length + 1}`, kitId: "beetBox" }
          : {
              ...base,
              kind,
              name: `Melody ${draft.tracks.filter((t) => t.kind === "instrument").length + 1}`,
              instrumentId: "bassSprout"
            };
      draft.tracks.push(track);
      for (const scene of draft.scenes) {
        scene.clipsByTrackId[id] = makeEmptyClip(kind);
      }
    });
    return id;
  },

  removeTrack: (trackId) =>
    get().apply("Remove track", (p) => {
      p.tracks = p.tracks.filter((t) => t.id !== trackId);
      for (const scene of p.scenes) {
        delete scene.clipsByTrackId[trackId];
      }
    }),

  duplicateTrack: (trackId) => {
    const p = get().project;
    if (!p || p.tracks.length >= MAX_TRACKS) return null;
    const src = p.tracks.find((t) => t.id === trackId);
    if (!src) return null;
    const id = uid();
    get().apply("Duplicate track", (draft) => {
      const srcIndex = draft.tracks.findIndex((t) => t.id === trackId);
      const copy: Track = {
        ...structuredClone(draft.tracks[srcIndex] as Track),
        id,
        name: `${src.name} copy`.slice(0, 40),
        solo: false
      };
      draft.tracks.splice(srcIndex + 1, 0, copy);
      for (const scene of draft.scenes) {
        const clip = scene.clipsByTrackId[trackId];
        scene.clipsByTrackId[id] = clip ? structuredClone(clip) : makeEmptyClip(copy.kind);
      }
    });
    return id;
  },

  setTrackParams: (trackId, patch) =>
    get().apply("Track settings", (p) => {
      const track = p.tracks.find((t) => t.id === trackId);
      if (!track) return;
      Object.assign(track, patch, { id: track.id, kind: track.kind });
    }),

  toggleMute: (trackId) =>
    get().apply("Mute", (p) => {
      const t = p.tracks.find((x) => x.id === trackId);
      if (t) t.muted = !t.muted;
    }),

  toggleSolo: (trackId) =>
    get().apply("Solo", (p) => {
      const t = p.tracks.find((x) => x.id === trackId);
      if (t) t.solo = !t.solo;
    }),

  setActiveScene: (sceneId) =>
    get().apply("Switch scene", (p) => {
      if (p.scenes.some((s) => s.id === sceneId)) p.activeSceneId = sceneId;
    }),

  renameScene: (sceneId, name) =>
    get().apply("Rename scene", (p) => {
      const s = p.scenes.find((x) => x.id === sceneId);
      if (s) s.name = name.trim().slice(0, 24) || s.name;
    }),

  clearScene: (sceneId) =>
    get().apply("Clear scene", (p) => {
      const scene = p.scenes.find((s) => s.id === sceneId);
      if (!scene) return;
      for (const track of p.tracks) {
        scene.clipsByTrackId[track.id] = makeEmptyClip(track.kind);
      }
    }),

  copySceneTo: (fromId, toId) =>
    get().apply("Copy scene", (p) => {
      const from = p.scenes.find((s) => s.id === fromId);
      const to = p.scenes.find((s) => s.id === toId);
      if (!from || !to || from === to) return;
      to.clipsByTrackId = structuredClone(from.clipsByTrackId);
    }),

  arrangementAdd: (sceneId) =>
    get().apply("Song block", (p) => {
      if (p.arrangement.length >= MAX_ARRANGEMENT) return;
      if (p.scenes.some((s) => s.id === sceneId)) p.arrangement.push(sceneId);
    }),

  arrangementRemove: (index) =>
    get().apply("Remove block", (p) => {
      p.arrangement.splice(index, 1);
    }),

  arrangementMove: (index, dir) =>
    get().apply("Move block", (p) => {
      const j = index + dir;
      if (index < 0 || j < 0 || index >= p.arrangement.length || j >= p.arrangement.length) return;
      const a = p.arrangement[index];
      const b = p.arrangement[j];
      if (a === undefined || b === undefined) return;
      p.arrangement[index] = b;
      p.arrangement[j] = a;
    }),

  arrangementDuplicate: (index) =>
    get().apply("Duplicate block", (p) => {
      const id = p.arrangement[index];
      if (id === undefined || p.arrangement.length >= MAX_ARRANGEMENT) return;
      p.arrangement.splice(index + 1, 0, id);
    })
}));
