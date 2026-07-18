import { describe, expect, it } from "vitest";
import { gridRowMidis, midiToName, nextVelocity, scaleMidiForRow, snapToScale } from "./music";
import {
  barSeconds,
  playbackBars,
  playbackDurationSeconds,
  quantizeToStep,
  sanitizeFilename,
  sixteenthSeconds,
  stepStartSeconds,
  swingDelaySeconds
} from "./timing";
import { encodeWavPcm16, floatTo16, normalizePeak } from "./wav";
import { makeBlankProject } from "./starters";

describe("scale generation", () => {
  it("maps C pentatonic minor rows to the right midi notes", () => {
    // C4=60, Eb4=63, F4=65, G4=67, Bb4=70, then wraps: C5=72, Eb5=75, F5=77
    expect(gridRowMidis("C", "pentatonicMinor", 4)).toEqual([60, 63, 65, 67, 70, 72, 75, 77]);
  });

  it("respects key transposition", () => {
    expect(scaleMidiForRow(0, "A", "minor", 3)).toBe(57); // A3
    expect(scaleMidiForRow(2, "A", "minor", 3)).toBe(60); // C4, minor third
  });

  it("names notes correctly", () => {
    expect(midiToName(60)).toBe("C4");
    expect(midiToName(70)).toBe("A#4");
  });

  it("snapToScale keeps in-scale notes and pulls others to a neighbor", () => {
    expect(snapToScale(60, "C", "pentatonicMinor")).toBe(60);
    const snapped = snapToScale(61, "C", "pentatonicMinor"); // C# is out of scale
    expect([60, 63]).toContain(snapped);
    expect(snapped).toBe(60); // ties resolve downward
  });

  it("velocity cycles off -> soft -> normal -> accent -> off", () => {
    const soft = nextVelocity(undefined);
    const normal = nextVelocity(soft ?? 0);
    const accent = nextVelocity(normal ?? 0);
    const off = nextVelocity(accent ?? 0);
    expect(soft).toBeLessThan(normal ?? 0);
    expect(normal).toBeLessThan(accent ?? 0);
    expect(accent).toBe(1);
    expect(off).toBeUndefined();
  });
});

describe("swing and timing", () => {
  it("applies no swing to even steps and none at swing 0", () => {
    expect(swingDelaySeconds(0, 100, 0.5)).toBe(0);
    expect(swingDelaySeconds(4, 100, 0.5)).toBe(0);
    expect(swingDelaySeconds(3, 100, 0)).toBe(0);
  });

  it("delays odd steps proportionally and always less than one sixteenth", () => {
    const bpm = 100;
    const sixteenth = sixteenthSeconds(bpm);
    const small = swingDelaySeconds(1, bpm, 0.2);
    const big = swingDelaySeconds(1, bpm, 0.6);
    expect(small).toBeGreaterThan(0);
    expect(big).toBeGreaterThan(small);
    expect(big).toBeLessThan(sixteenth);
  });

  it("step start times are strictly increasing under max swing", () => {
    const bpm = 60;
    let prev = -1;
    for (let step = 0; step < 16; step++) {
      const t = stepStartSeconds(step, bpm, 0.6);
      expect(t).toBeGreaterThan(prev);
      prev = t;
    }
  });

  it("quantizes fractional positions to the nearest step with wrap-around", () => {
    expect(quantizeToStep(4.4)).toBe(4);
    expect(quantizeToStep(4.6)).toBe(5);
    expect(quantizeToStep(15.7)).toBe(0);
    expect(quantizeToStep(-0.4)).toBe(0);
  });

  it("computes loop and song durations from the arrangement", () => {
    const p = makeBlankProject();
    expect(playbackBars({ playbackMode: "loop", arrangement: p.arrangement })).toBe(1);
    expect(playbackBars({ playbackMode: "song", arrangement: ["a", "b", "a"] })).toBe(3);
    const bpm = 120;
    expect(playbackDurationSeconds({ playbackMode: "song", arrangement: ["a", "b"], bpm })).toBe(
      2 * barSeconds(bpm)
    );
    expect(barSeconds(120)).toBeCloseTo(2, 10); // 4 beats at 0.5s each
  });
});

describe("sanitizeFilename", () => {
  it("lowercases, dashes, and trims", () => {
    expect(sanitizeFilename("My Cool JAM!!")).toBe("my-cool-jam");
    expect(sanitizeFilename("   ")).toBe("beet-jam");
    expect(sanitizeFilename("🍠🍠🍠")).toBe("beet-jam");
    expect(sanitizeFilename("a".repeat(80)).length).toBeLessThanOrEqual(40);
  });
});

describe("WAV encoding", () => {
  it("writes a valid RIFF/WAVE header with correct sizes", () => {
    const frames = 100;
    const left = new Float32Array(frames).fill(0.5);
    const right = new Float32Array(frames).fill(-0.5);
    const buf = encodeWavPcm16([left, right], 44100);
    const view = new DataView(buf);
    const tag = (o: number, len: number) =>
      Array.from({ length: len }, (_, i) => String.fromCharCode(view.getUint8(o + i))).join("");
    expect(tag(0, 4)).toBe("RIFF");
    expect(tag(8, 4)).toBe("WAVE");
    expect(tag(36, 4)).toBe("data");
    expect(view.getUint16(22, true)).toBe(2); // channels
    expect(view.getUint32(24, true)).toBe(44100); // sample rate
    expect(view.getUint16(34, true)).toBe(16); // bit depth
    expect(view.getUint32(40, true)).toBe(frames * 2 * 2); // data length
    expect(buf.byteLength).toBe(44 + frames * 4);
  });

  it("clamps float samples safely into 16-bit range", () => {
    expect(floatTo16(2)).toBe(0x7fff);
    expect(floatTo16(-2)).toBe(-0x8000);
    expect(floatTo16(0)).toBe(0);
  });

  it("normalization only attenuates and never boosts", () => {
    const loud = new Float32Array([0, 1.6, -1.2]);
    const peak = normalizePeak([loud], 0.95);
    expect(peak).toBeCloseTo(1.6, 5);
    expect(Math.max(...loud.map(Math.abs))).toBeLessThanOrEqual(0.95 + 1e-6);

    const quiet = new Float32Array([0.1, -0.2]);
    normalizePeak([quiet], 0.95);
    expect(quiet[1]).toBeCloseTo(-0.2, 6); // untouched
  });
});
