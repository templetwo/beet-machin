import { KEYS, type MusicalKey, type ScaleName } from "./schema";

export const SCALE_INTERVALS: Record<ScaleName, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonicMajor: [0, 2, 4, 7, 9],
  pentatonicMinor: [0, 3, 5, 7, 10]
};

export const SCALE_LABELS: Record<ScaleName, string> = {
  major: "Major",
  minor: "Minor",
  pentatonicMajor: "Pentatonic Major",
  pentatonicMinor: "Pentatonic Minor"
};

export function keyToPitchClass(key: MusicalKey): number {
  return KEYS.indexOf(key);
}

/**
 * Midi note for a scale-locked grid row.
 * Row 0 is the lowest row: the root of `key` at `octave` (octave 4 root = C4 = 60 for key C).
 * Rows walk up the scale, wrapping into the next octave.
 */
export function scaleMidiForRow(
  row: number,
  key: MusicalKey,
  scale: ScaleName,
  octave: number
): number {
  const intervals = SCALE_INTERVALS[scale];
  const n = intervals.length;
  const octUp = Math.floor(row / n);
  const deg = ((row % n) + n) % n;
  const midi = 12 * (octave + 1) + keyToPitchClass(key) + (intervals[deg] ?? 0) + 12 * octUp;
  return Math.min(127, Math.max(0, midi));
}

/** All midi rows for an 8-row melody grid, lowest first. */
export function gridRowMidis(key: MusicalKey, scale: ScaleName, octave: number): number[] {
  return Array.from({ length: 8 }, (_, r) => scaleMidiForRow(r, key, scale, octave));
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

export function midiToName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[pc]}${oct}`;
}

/** Snap a midi note to the nearest pitch in the given key/scale (ties resolve downward). */
export function snapToScale(midi: number, key: MusicalKey, scale: ScaleName): number {
  const root = keyToPitchClass(key);
  const pcs = new Set(SCALE_INTERVALS[scale].map((i) => (root + i) % 12));
  for (let d = 0; d <= 6; d++) {
    const down = midi - d;
    if (down >= 0 && pcs.has(((down % 12) + 12) % 12)) return down;
    const up = midi + d;
    if (up <= 127 && pcs.has(up % 12)) return up;
  }
  return midi;
}

/* ---------- Sound catalog (ids shared by app, engine, and saved projects) ---------- */

export const PAD_ORDER = ["kick", "snare", "hatClosed", "hatOpen", "clap", "perc"] as const;
export type PadId = (typeof PAD_ORDER)[number];

export const PAD_LABELS: Record<PadId, string> = {
  kick: "Kick",
  snare: "Snare",
  hatClosed: "Closed Hat",
  hatOpen: "Open Hat",
  clap: "Clap",
  perc: "Percussion"
};

export const KIT_IDS = [
  "beetBox",
  "garden808",
  "arcadeCrunch",
  "spacePop",
  "sproutSnap",
  "muddyRoots",
  "tinPatch"
] as const;
export type KitId = (typeof KIT_IDS)[number];

export const KIT_LABELS: Record<KitId, string> = {
  beetBox: "Beet Box",
  garden808: "808 Garden",
  arcadeCrunch: "Arcade Crunch",
  spacePop: "Space Pop",
  sproutSnap: "Sprout Snap",
  muddyRoots: "Muddy Roots",
  tinPatch: "Tin Patch"
};

/** Extra search terms for the kit picker, beyond the label text itself. */
export const KIT_KEYWORDS: Partial<Record<KitId, readonly string[]>> = {
  garden808: ["808", "trap", "deep"],
  arcadeCrunch: ["chiptune", "8bit", "game", "crunch"],
  spacePop: ["space", "pop", "shimmer"],
  sproutSnap: ["snap", "tight", "trap", "snappy"],
  muddyRoots: ["lofi", "lo-fi", "muddy", "boom bap", "dusty", "warm"],
  tinPatch: ["metal", "tin", "junk", "industrial", "clank"]
};

export const INSTRUMENT_IDS = [
  "bassSprout",
  "candyKeys",
  "pluckyPea",
  "neonLead",
  "bellBloom",
  "padPetal",
  "beetChoir",
  "vineString",
  "sunnyHorn"
] as const;
export type InstrumentId = (typeof INSTRUMENT_IDS)[number];

export const INSTRUMENT_LABELS: Record<InstrumentId, string> = {
  bassSprout: "Bass Sprout",
  candyKeys: "Candy Keys",
  pluckyPea: "Plucky Pea",
  neonLead: "Neon Lead",
  bellBloom: "Bell Bloom",
  padPetal: "Pad Petal",
  beetChoir: "Beet Choir",
  vineString: "Vine String",
  sunnyHorn: "Sunny Horn"
};

/** Extra search terms for the instrument picker, beyond the label text itself. */
export const INSTRUMENT_KEYWORDS: Partial<Record<InstrumentId, readonly string[]>> = {
  bassSprout: ["bass", "low", "root"],
  candyKeys: ["piano", "keys", "sweet"],
  pluckyPea: ["pluck", "pizzicato"],
  neonLead: ["lead", "synth", "bright"],
  bellBloom: ["bell", "chime", "glass"],
  padPetal: ["pad", "string", "strings", "sustain", "warm"],
  beetChoir: ["vocal", "voice", "choir", "sing", "singer", "aah", "ooh", "human"],
  vineString: ["pluck", "string", "guitar", "harp"],
  sunnyHorn: ["brass", "horn", "trumpet", "punchy"]
};

export const DEFAULT_KIT: KitId = "beetBox";
export const DEFAULT_INSTRUMENT: InstrumentId = "bassSprout";

/** Velocity cycle used by the drum grid: off -> soft -> normal -> accent -> off. */
export const VELOCITY_CYCLE = [0.5, 0.8, 1] as const;

export function nextVelocity(current: number | undefined): number | undefined {
  if (current === undefined) return VELOCITY_CYCLE[0];
  if (current < 0.65) return VELOCITY_CYCLE[1];
  if (current < 0.9) return VELOCITY_CYCLE[2];
  return undefined; // back to off
}

export function velocityLabel(v: number | undefined): string {
  if (v === undefined) return "off";
  if (v < 0.65) return "soft";
  if (v < 0.9) return "normal";
  return "accent";
}
