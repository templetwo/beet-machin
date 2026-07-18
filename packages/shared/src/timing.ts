import { STEPS_PER_BAR, SWING_MAX, type Project } from "./schema";

/** Duration of one sixteenth note in seconds. */
export function sixteenthSeconds(bpm: number): number {
  return 60 / bpm / 4;
}

export function barSeconds(bpm: number): number {
  return STEPS_PER_BAR * sixteenthSeconds(bpm);
}

/**
 * Swing delay applied to off-beat sixteenths (odd steps).
 * The SAME function is used for live playback and offline rendering so exports
 * feel identical to what the child hears.
 * At the max UI swing (60%) an off-beat sixteenth is delayed by 30% of a
 * sixteenth, just shy of a full triplet feel, and always strictly less than
 * one sixteenth so steps can never collide.
 */
export function swingDelaySeconds(step: number, bpm: number, swing: number): number {
  if (step % 2 === 0) return 0;
  const s = Math.min(SWING_MAX, Math.max(0, swing));
  return s * 0.5 * sixteenthSeconds(bpm);
}

/** Absolute start time of a step inside its bar, swing included. */
export function stepStartSeconds(step: number, bpm: number, swing: number): number {
  return step * sixteenthSeconds(bpm) + swingDelaySeconds(step, bpm, swing);
}

/** Quantize a transport position (in sixteenths, possibly fractional) to the nearest step 0-15. */
export function quantizeToStep(positionSixteenths: number): number {
  const n = Math.round(positionSixteenths);
  return ((n % STEPS_PER_BAR) + STEPS_PER_BAR) % STEPS_PER_BAR;
}

/** How many bars a playback pass covers. Loop mode = 1 bar; song mode = arrangement length. */
export function playbackBars(project: Pick<Project, "playbackMode" | "arrangement">): number {
  if (project.playbackMode === "song" && project.arrangement.length > 0) {
    return project.arrangement.length;
  }
  return 1;
}

export function playbackDurationSeconds(
  project: Pick<Project, "playbackMode" | "arrangement" | "bpm">
): number {
  return playbackBars(project) * barSeconds(project.bpm);
}

/** Turn a jam title into a safe download filename. */
export function sanitizeFilename(title: string): string {
  const cleaned = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return cleaned.length > 0 ? cleaned : "beet-jam";
}
