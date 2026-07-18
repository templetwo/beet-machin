import { z } from "zod";

/** Musical keys (pitch classes). */
export const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export type MusicalKey = (typeof KEYS)[number];

export const SCALES = ["major", "minor", "pentatonicMajor", "pentatonicMinor"] as const;
export type ScaleName = (typeof SCALES)[number];

export const STEPS_PER_BAR = 16;
export const MAX_TRACKS = 8;
export const MAX_SCENES = 4;
export const MAX_ARRANGEMENT = 16;
export const BPM_MIN = 60;
export const BPM_MAX = 180;
export const SWING_MAX = 0.6;

export const MusicalKeySchema = z.enum(KEYS);
export const ScaleNameSchema = z.enum(SCALES);

export const DrumStepSchema = z.object({
  step: z.number().int().min(0).max(STEPS_PER_BAR - 1),
  padId: z.string().min(1),
  velocity: z.number().min(0).max(1)
});
export type DrumStep = z.infer<typeof DrumStepSchema>;

export const DrumClipSchema = z.object({
  kind: z.literal("drums"),
  steps: z.array(DrumStepSchema)
});
export type DrumClip = z.infer<typeof DrumClipSchema>;

export const NOTE_LENGTHS = [1, 2, 4, 8] as const;
export type NoteLength = (typeof NOTE_LENGTHS)[number];

export const MelodyNoteSchema = z.object({
  step: z.number().int().min(0).max(STEPS_PER_BAR - 1),
  midi: z.number().int().min(0).max(127),
  lengthSteps: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]),
  velocity: z.number().min(0).max(1)
});
export type MelodyNote = z.infer<typeof MelodyNoteSchema>;

export const MelodyClipSchema = z.object({
  kind: z.literal("melody"),
  notes: z.array(MelodyNoteSchema)
});
export type MelodyClip = z.infer<typeof MelodyClipSchema>;

export const ClipSchema = z.discriminatedUnion("kind", [DrumClipSchema, MelodyClipSchema]);
export type Clip = z.infer<typeof ClipSchema>;

export const TrackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40),
  kind: z.enum(["drums", "instrument"]),
  color: z.string().min(1),
  kitId: z.string().optional(),
  instrumentId: z.string().optional(),
  octave: z.number().int().min(1).max(7),
  volume: z.number().min(0).max(1),
  pan: z.number().min(-1).max(1),
  reverbSend: z.number().min(0).max(1),
  muted: z.boolean(),
  solo: z.boolean()
});
export type Track = z.infer<typeof TrackSchema>;

export const SceneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(24),
  clipsByTrackId: z.record(z.string(), ClipSchema)
});
export type Scene = z.infer<typeof SceneSchema>;

export const ProjectSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  title: z.string().min(1).max(60),
  createdAt: z.string(),
  updatedAt: z.string(),
  bpm: z.number().min(BPM_MIN).max(BPM_MAX),
  swing: z.number().min(0).max(SWING_MAX),
  key: MusicalKeySchema,
  scale: ScaleNameSchema,
  masterVolume: z.number().min(0).max(1),
  playbackMode: z.enum(["loop", "song"]),
  activeSceneId: z.string().min(1),
  tracks: z.array(TrackSchema).max(MAX_TRACKS),
  scenes: z.array(SceneSchema).min(1).max(MAX_SCENES),
  arrangement: z.array(z.string()).max(MAX_ARRANGEMENT),
  revision: z.number().int().min(0)
});
export type Project = z.infer<typeof ProjectSchema>;

export type PlaybackMode = Project["playbackMode"];

/** Portable unique id (browser + Node). */
export function uid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
