import {
  uid,
  type DrumClip,
  type DrumStep,
  type MelodyClip,
  type MelodyNote,
  type NoteLength,
  type Project,
  type Scene,
  type Track
} from "./schema";
import {
  DEFAULT_INSTRUMENT,
  DEFAULT_KIT,
  INSTRUMENT_KEYWORDS,
  INSTRUMENT_LABELS,
  KIT_KEYWORDS,
  KIT_LABELS,
  type InstrumentId,
  type KitId,
  type PadId
} from "./music";

export const TRACK_COLORS = [
  "#FF3B81",
  "#B8F34A",
  "#46D9FF",
  "#FFB454",
  "#C08CFF",
  "#FF7A5C",
  "#7DF0C1",
  "#FFF7E8"
] as const;

export function makeEmptyClip(kind: Track["kind"]): DrumClip | MelodyClip {
  return kind === "drums" ? { kind: "drums", steps: [] } : { kind: "melody", notes: [] };
}

interface TrackOpts {
  name: string;
  color?: string;
  kitId?: KitId;
  instrumentId?: InstrumentId;
  octave?: number;
  volume?: number;
  reverbSend?: number;
}

export function makeDrumTrack(opts: TrackOpts): Track {
  return {
    id: uid(),
    name: opts.name,
    kind: "drums",
    color: opts.color ?? TRACK_COLORS[0],
    kitId: opts.kitId ?? DEFAULT_KIT,
    octave: 3,
    volume: opts.volume ?? 0.85,
    pan: 0,
    reverbSend: opts.reverbSend ?? 0.08,
    muted: false,
    solo: false
  };
}

export function makeInstrumentTrack(opts: TrackOpts): Track {
  return {
    id: uid(),
    name: opts.name,
    kind: "instrument",
    color: opts.color ?? TRACK_COLORS[2],
    instrumentId: opts.instrumentId ?? DEFAULT_INSTRUMENT,
    octave: opts.octave ?? 4,
    volume: opts.volume ?? 0.8,
    pan: 0,
    reverbSend: opts.reverbSend ?? 0.18,
    muted: false,
    solo: false
  };
}

const SCENE_NAMES = ["A", "B", "C", "D"] as const;

export function makeScenes(tracks: Track[]): Scene[] {
  return SCENE_NAMES.map((name) => ({
    id: uid(),
    name,
    clipsByTrackId: Object.fromEntries(tracks.map((t) => [t.id, makeEmptyClip(t.kind)]))
  }));
}

/** Compact builder: pad -> steps, with optional per-step velocity overrides. */
function d(pad: PadId, steps: number[], vel = 0.8, accents: number[] = []): DrumStep[] {
  return steps.map((step) => ({
    step,
    padId: pad,
    velocity: accents.includes(step) ? 1 : vel
  }));
}

function n(step: number, midi: number, lengthSteps: NoteLength = 1, velocity = 0.8): MelodyNote {
  return { step, midi, lengthSteps, velocity };
}

interface BaseOpts {
  title: string;
  bpm?: number;
  swing?: number;
  tracks?: Track[];
  sceneA?: Record<string, DrumClip | MelodyClip>;
  sceneB?: Record<string, DrumClip | MelodyClip>;
  arrangement?: number[]; // indexes into scenes
}

export function makeProject(opts: BaseOpts): Project {
  const now = new Date().toISOString();
  const tracks = opts.tracks ?? [makeDrumTrack({ name: "Beet Drums" })];
  const scenes = makeScenes(tracks);
  const a = scenes[0];
  const b = scenes[1];
  if (a && opts.sceneA) a.clipsByTrackId = { ...a.clipsByTrackId, ...opts.sceneA };
  if (b && opts.sceneB) b.clipsByTrackId = { ...b.clipsByTrackId, ...opts.sceneB };
  const arrangementIdx = opts.arrangement ?? [0];
  return {
    schemaVersion: 1,
    id: uid(),
    title: opts.title,
    createdAt: now,
    updatedAt: now,
    bpm: opts.bpm ?? 100,
    swing: opts.swing ?? 0,
    key: "C",
    scale: "pentatonicMinor",
    masterVolume: 0.7,
    playbackMode: "loop",
    activeSceneId: a?.id ?? "",
    tracks,
    scenes,
    arrangement: arrangementIdx
      .map((i) => scenes[i]?.id)
      .filter((x): x is string => typeof x === "string"),
    revision: 0
  };
}

export function makeBlankProject(title = "New Jam"): Project {
  return makeProject({ title });
}

/* ------------------------- Starter templates ------------------------- */
/* All patterns below are original teaching grooves written for Beet Machin. */

function hipHopGarden(): Project {
  const drums = makeDrumTrack({ name: "Garden Kit", kitId: "beetBox" });
  const bass = makeInstrumentTrack({
    name: "Root Bass",
    instrumentId: "bassSprout",
    octave: 2,
    color: TRACK_COLORS[1]
  });
  return makeProject({
    title: "Hip-Hop Garden",
    bpm: 90,
    swing: 0.18,
    tracks: [drums, bass],
    sceneA: {
      [drums.id]: {
        kind: "drums",
        steps: [
          ...d("kick", [0, 7, 10], 0.9, [0]),
          ...d("snare", [4, 12], 0.85),
          ...d("hatClosed", [0, 2, 4, 6, 8, 10, 12, 14], 0.5, [0, 8])
        ]
      },
      [bass.id]: {
        kind: "melody",
        notes: [n(0, 36, 2, 0.9), n(3, 39), n(8, 43, 2, 0.85), n(11, 46)]
      }
    },
    arrangement: [0, 0]
  });
}

function dancePatch(): Project {
  const drums = makeDrumTrack({ name: "Patch Kit", kitId: "garden808" });
  const bass = makeInstrumentTrack({
    name: "Bounce Bass",
    instrumentId: "bassSprout",
    octave: 2,
    color: TRACK_COLORS[1]
  });
  const keys = makeInstrumentTrack({
    name: "Sugar Keys",
    instrumentId: "candyKeys",
    octave: 4,
    color: TRACK_COLORS[4]
  });
  return makeProject({
    title: "Dance Patch",
    bpm: 124,
    tracks: [drums, bass, keys],
    sceneA: {
      [drums.id]: {
        kind: "drums",
        steps: [
          ...d("kick", [0, 4, 8, 12], 0.95),
          ...d("clap", [4, 12], 0.85),
          ...d("hatOpen", [2, 6, 10, 14], 0.55)
        ]
      },
      [bass.id]: {
        kind: "melody",
        notes: [n(2, 36, 2, 0.9), n(6, 36, 2, 0.9), n(10, 39, 2, 0.9), n(14, 43, 2, 0.9)]
      },
      [keys.id]: {
        kind: "melody",
        notes: [n(0, 60, 4, 0.6), n(8, 63, 4, 0.6)]
      }
    },
    arrangement: [0, 0]
  });
}

function funkyRoots(): Project {
  const drums = makeDrumTrack({ name: "Roots Kit", kitId: "beetBox" });
  const pluck = makeInstrumentTrack({
    name: "Funky Pluck",
    instrumentId: "pluckyPea",
    octave: 4,
    color: TRACK_COLORS[3]
  });
  return makeProject({
    title: "Funky Roots",
    bpm: 106,
    swing: 0.3,
    tracks: [drums, pluck],
    sceneA: {
      [drums.id]: {
        kind: "drums",
        steps: [
          ...d("kick", [0, 3, 6, 10], 0.9, [0]),
          ...d("snare", [4, 12], 0.85),
          ...d("hatClosed", [1, 3, 5, 7, 9, 11, 13, 15], 0.45)
        ]
      },
      [pluck.id]: {
        kind: "melody",
        notes: [n(0, 60, 1, 0.85), n(3, 63), n(6, 65), n(10, 67, 1, 0.9), n(12, 63)]
      }
    },
    arrangement: [0, 0]
  });
}

function chillGreenhouse(): Project {
  const drums = makeDrumTrack({ name: "Soft Kit", kitId: "spacePop", reverbSend: 0.2 });
  const bells = makeInstrumentTrack({
    name: "Glass Bells",
    instrumentId: "bellBloom",
    octave: 5,
    reverbSend: 0.45,
    color: TRACK_COLORS[6]
  });
  const bass = makeInstrumentTrack({
    name: "Deep Roots",
    instrumentId: "bassSprout",
    octave: 2,
    color: TRACK_COLORS[1],
    volume: 0.7
  });
  return makeProject({
    title: "Chill Greenhouse",
    bpm: 80,
    tracks: [drums, bells, bass],
    sceneA: {
      [drums.id]: {
        kind: "drums",
        steps: [
          ...d("kick", [0, 8], 0.7),
          ...d("snare", [4, 12], 0.5),
          ...d("hatClosed", [2, 6, 10, 14], 0.35)
        ]
      },
      [bells.id]: {
        kind: "melody",
        notes: [n(0, 72, 8, 0.5), n(8, 70, 8, 0.45)]
      },
      [bass.id]: { kind: "melody", notes: [n(0, 36, 8, 0.7), n(8, 34, 8, 0.65)] }
    },
    arrangement: [0, 0]
  });
}

function arcadeBeets(): Project {
  const drums = makeDrumTrack({ name: "Pixel Kit", kitId: "arcadeCrunch" });
  const lead = makeInstrumentTrack({
    name: "Hero Lead",
    instrumentId: "neonLead",
    octave: 5,
    color: TRACK_COLORS[2],
    volume: 0.65
  });
  return makeProject({
    title: "Arcade Beets",
    bpm: 140,
    tracks: [drums, lead],
    sceneA: {
      [drums.id]: {
        kind: "drums",
        steps: [
          ...d("kick", [0, 5, 8, 13], 0.9),
          ...d("snare", [4, 12], 0.85),
          ...d("perc", [6, 14], 0.6),
          ...d("hatClosed", [2, 10], 0.5)
        ]
      },
      [lead.id]: {
        kind: "melody",
        notes: [
          n(0, 72, 1, 0.7),
          n(2, 75, 1, 0.7),
          n(4, 77, 1, 0.7),
          n(6, 79, 1, 0.75),
          n(8, 77, 1, 0.7),
          n(10, 75, 1, 0.7),
          n(12, 72, 2, 0.75)
        ]
      }
    },
    arrangement: [0, 0]
  });
}

function choirBloom(): Project {
  const drums = makeDrumTrack({ name: "Soft Roots", kitId: "muddyRoots", reverbSend: 0.25 });
  const choir = makeInstrumentTrack({
    name: "Beet Choir",
    instrumentId: "beetChoir",
    octave: 5,
    reverbSend: 0.5,
    color: TRACK_COLORS[6]
  });
  const pad = makeInstrumentTrack({
    name: "Petal Pad",
    instrumentId: "padPetal",
    octave: 3,
    reverbSend: 0.35,
    color: TRACK_COLORS[4],
    volume: 0.6
  });
  return makeProject({
    title: "Choir Bloom",
    bpm: 72,
    tracks: [drums, choir, pad],
    sceneA: {
      [drums.id]: {
        kind: "drums",
        steps: [
          ...d("kick", [0, 8], 0.65),
          ...d("snare", [4, 12], 0.45),
          ...d("hatClosed", [2, 6, 10, 14], 0.3)
        ]
      },
      [choir.id]: {
        kind: "melody",
        notes: [n(0, 72, 8, 0.55), n(8, 70, 8, 0.5)]
      },
      [pad.id]: {
        kind: "melody",
        notes: [n(0, 48, 8, 0.5), n(8, 46, 8, 0.45)]
      }
    },
    arrangement: [0, 0]
  });
}

function tinGarden(): Project {
  const drums = makeDrumTrack({ name: "Junk Kit", kitId: "tinPatch" });
  const vine = makeInstrumentTrack({
    name: "Vine Pluck",
    instrumentId: "vineString",
    octave: 4,
    color: TRACK_COLORS[3]
  });
  return makeProject({
    title: "Tin Garden",
    bpm: 118,
    swing: 0.15,
    tracks: [drums, vine],
    sceneA: {
      [drums.id]: {
        kind: "drums",
        steps: [
          ...d("kick", [0, 6, 10], 0.9, [0]),
          ...d("snare", [4, 12], 0.8),
          ...d("perc", [2, 14], 0.6),
          ...d("hatClosed", [0, 2, 4, 6, 8, 10, 12, 14], 0.4)
        ]
      },
      [vine.id]: {
        kind: "melody",
        notes: [n(0, 63, 1, 0.8), n(2, 67), n(4, 70), n(7, 70, 2, 0.85), n(10, 67), n(12, 63, 2, 0.8)]
      }
    },
    arrangement: [0, 0]
  });
}

function snappySprouts(): Project {
  const drums = makeDrumTrack({ name: "Snap Kit", kitId: "sproutSnap" });
  const horn = makeInstrumentTrack({
    name: "Sunny Horn",
    instrumentId: "sunnyHorn",
    octave: 4,
    color: TRACK_COLORS[7],
    volume: 0.65
  });
  return makeProject({
    title: "Snappy Sprouts",
    bpm: 128,
    tracks: [drums, horn],
    sceneA: {
      [drums.id]: {
        kind: "drums",
        steps: [
          ...d("kick", [0, 4, 8, 11], 0.95),
          ...d("clap", [4, 12], 0.85),
          ...d("hatClosed", [0, 2, 4, 6, 8, 10, 12, 14], 0.45, [0, 8])
        ]
      },
      [horn.id]: {
        kind: "melody",
        notes: [n(0, 65, 2, 0.8), n(4, 70, 2, 0.85), n(8, 72, 2, 0.85), n(12, 70, 4, 0.8)]
      }
    },
    arrangement: [0, 0]
  });
}

function tinPetals(): Project {
  const drums = makeDrumTrack({ name: "Petal Junk", kitId: "tinPatch", reverbSend: 0.15 });
  const pad = makeInstrumentTrack({
    name: "Petal Pad",
    instrumentId: "padPetal",
    octave: 3,
    color: TRACK_COLORS[4],
    volume: 0.55
  });
  const vine = makeInstrumentTrack({
    name: "Vine Pluck",
    instrumentId: "vineString",
    octave: 5,
    color: TRACK_COLORS[3],
    volume: 0.6
  });
  return makeProject({
    title: "Tin Petals",
    bpm: 96,
    tracks: [drums, pad, vine],
    sceneA: {
      [drums.id]: {
        kind: "drums",
        steps: [
          ...d("kick", [0, 8], 0.75),
          ...d("snare", [4, 12], 0.55),
          ...d("perc", [6, 14], 0.5)
        ]
      },
      [pad.id]: {
        kind: "melody",
        notes: [n(0, 55, 8, 0.5), n(8, 53, 8, 0.45)]
      },
      [vine.id]: {
        kind: "melody",
        notes: [n(2, 72, 1, 0.6), n(6, 75, 1, 0.6), n(10, 72, 1, 0.6), n(13, 72, 2, 0.6)]
      }
    },
    arrangement: [0, 0]
  });
}

export interface StarterTemplate {
  id: string;
  name: string;
  blurb: string;
  make: () => Project;
  tags: readonly string[];
}

/** Search terms for a template: every kit/instrument it uses, by label and keyword. */
function templateTags(make: () => Project): string[] {
  const tags = new Set<string>();
  for (const track of make().tracks) {
    if (track.kitId) {
      tags.add(KIT_LABELS[track.kitId as KitId]);
      for (const kw of KIT_KEYWORDS[track.kitId as KitId] ?? []) tags.add(kw);
    }
    if (track.instrumentId) {
      tags.add(INSTRUMENT_LABELS[track.instrumentId as InstrumentId]);
      for (const kw of INSTRUMENT_KEYWORDS[track.instrumentId as InstrumentId] ?? []) tags.add(kw);
    }
  }
  return [...tags];
}

const RAW_TEMPLATES: Omit<StarterTemplate, "tags">[] = [
  { id: "blank", name: "Blank Jam", blurb: "An empty garden bed. Plant anything.", make: () => makeBlankProject() },
  { id: "hipHopGarden", name: "Hip-Hop Garden", blurb: "Laid-back boom with room to breathe.", make: hipHopGarden },
  { id: "dancePatch", name: "Dance Patch", blurb: "Four kicks on the floor, hands in the air.", make: dancePatch },
  { id: "funkyRoots", name: "Funky Roots", blurb: "Swingy, plucky, a little cheeky.", make: funkyRoots },
  { id: "chillGreenhouse", name: "Chill Greenhouse", blurb: "Slow bells and warm soil.", make: chillGreenhouse },
  { id: "arcadeBeets", name: "Arcade Beets", blurb: "Crunchy pixels, fast fingers.", make: arcadeBeets },
  { id: "choirBloom", name: "Choir Bloom", blurb: "Soft voices rising over warm soil.", make: choirBloom },
  { id: "tinGarden", name: "Tin Garden", blurb: "Clank and pluck in the toolshed.", make: tinGarden },
  { id: "snappySprouts", name: "Snappy Sprouts", blurb: "Tight snaps, sunny horn on top.", make: snappySprouts },
  { id: "tinPetals", name: "Tin Petals", blurb: "Rusty rhythm, soft petals drifting.", make: tinPetals }
];

export const STARTER_TEMPLATES: StarterTemplate[] = RAW_TEMPLATES.map((t) => ({
  ...t,
  tags: templateTags(t.make)
}));
