import * as Tone from "tone";
import { midiToFreq, type InstrumentId } from "@beet/shared";

export interface InstrumentInstance {
  output: Tone.Gain;
  triggerNote: (midi: number, durationSec: number, time: number, velocity: number) => void;
  previewNote: (midi: number) => void;
  releaseAll: () => void;
  dispose: () => void;
}

/**
 * All instruments are synthesized. Polyphonic ones are capped
 * (extra notes are dropped, never glitched) to protect mobile CPUs.
 */
export function createInstrument(id: InstrumentId): InstrumentInstance {
  const output = new Tone.Gain(1);
  const disposables: { dispose: () => void }[] = [output];

  let trigger: (freq: number, dur: number, time: number, vel: number) => void;
  let releaseAll: () => void = () => {};

  switch (id) {
    case "bassSprout": {
      const synth = new Tone.MonoSynth({
        oscillator: { type: "sawtooth" },
        filter: { type: "lowpass", Q: 1 },
        filterEnvelope: {
          attack: 0.01,
          decay: 0.2,
          sustain: 0.4,
          release: 0.2,
          baseFrequency: 80,
          octaves: 2.5
        },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.8, release: 0.15 }
      });
      const gain = new Tone.Gain(0.7);
      synth.connect(gain);
      gain.connect(output);
      disposables.push(synth, gain);
      trigger = (f, d, t, v) => synth.triggerAttackRelease(f, d, t, v);
      releaseAll = () => synth.triggerRelease();
      break;
    }
    case "candyKeys": {
      const poly = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.5, release: 0.8 }
      });
      poly.maxPolyphony = 8;
      const gain = new Tone.Gain(0.5);
      poly.connect(gain);
      gain.connect(output);
      disposables.push(poly, gain);
      trigger = (f, d, t, v) => poly.triggerAttackRelease(f, d, t, v);
      releaseAll = () => poly.releaseAll();
      break;
    }
    case "pluckyPea": {
      const poly = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.12 }
      });
      poly.maxPolyphony = 6;
      const filter = new Tone.Filter(3200, "lowpass");
      const gain = new Tone.Gain(0.65);
      poly.connect(filter);
      filter.connect(gain);
      gain.connect(output);
      disposables.push(poly, filter, gain);
      trigger = (f, d, t, v) => poly.triggerAttackRelease(f, Math.min(d, 0.25), t, v);
      releaseAll = () => poly.releaseAll();
      break;
    }
    case "neonLead": {
      const synth = new Tone.MonoSynth({
        oscillator: { type: "square" },
        portamento: 0.02,
        filter: { type: "lowpass", Q: 2 },
        filterEnvelope: {
          attack: 0.005,
          decay: 0.15,
          sustain: 0.5,
          release: 0.1,
          baseFrequency: 300,
          octaves: 3
        },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.1 }
      });
      const gain = new Tone.Gain(0.45);
      synth.connect(gain);
      gain.connect(output);
      disposables.push(synth, gain);
      trigger = (f, d, t, v) => synth.triggerAttackRelease(f, d, t, v);
      releaseAll = () => synth.triggerRelease();
      break;
    }
    case "bellBloom": {
      const poly = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 3.01,
        modulationIndex: 14,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 1.2, sustain: 0, release: 1.4 },
        modulation: { type: "sine" },
        modulationEnvelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.4 }
      });
      poly.maxPolyphony = 6;
      const gain = new Tone.Gain(0.4);
      poly.connect(gain);
      gain.connect(output);
      disposables.push(poly, gain);
      trigger = (f, d, t, v) => poly.triggerAttackRelease(f, d, t, v);
      releaseAll = () => poly.releaseAll();
      break;
    }
    case "padPetal": {
      const poly = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fatsawtooth", count: 3, spread: 25 },
        envelope: { attack: 0.6, decay: 0.4, sustain: 0.8, release: 1.6 }
      });
      poly.maxPolyphony = 5;
      const filter = new Tone.Filter(2400, "lowpass");
      const gain = new Tone.Gain(0.4);
      poly.connect(filter);
      filter.connect(gain);
      gain.connect(output);
      disposables.push(poly, filter, gain);
      trigger = (f, d, t, v) => poly.triggerAttackRelease(f, Math.max(d, 0.5), t, v);
      releaseAll = () => poly.releaseAll();
      break;
    }
    case "beetChoir": {
      const poly = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "fatsawtooth", count: 3, spread: 18 },
        envelope: { attack: 0.15, decay: 0.2, sustain: 0.85, release: 0.9 }
      });
      poly.maxPolyphony = 4;
      const vibrato = new Tone.Vibrato({ frequency: 5.5, depth: 0.12 });
      // Two parallel bandpass "formants" approximate an "ooh" vowel shape.
      const formant1 = new Tone.Filter({ type: "bandpass", frequency: 700, Q: 6 });
      const formant2 = new Tone.Filter({ type: "bandpass", frequency: 1200, Q: 6 });
      const formantGain1 = new Tone.Gain(0.6);
      const formantGain2 = new Tone.Gain(0.4);
      const gain = new Tone.Gain(0.4);
      poly.connect(vibrato);
      vibrato.connect(formant1);
      vibrato.connect(formant2);
      formant1.connect(formantGain1);
      formant2.connect(formantGain2);
      formantGain1.connect(gain);
      formantGain2.connect(gain);
      gain.connect(output);
      disposables.push(poly, vibrato, formant1, formant2, formantGain1, formantGain2, gain);
      trigger = (f, d, t, v) => poly.triggerAttackRelease(f, Math.max(d, 0.4), t, v);
      releaseAll = () => poly.releaseAll();
      break;
    }
    case "vineString": {
      const pluck = new Tone.PluckSynth({ attackNoise: 1, dampening: 3000, resonance: 0.92 });
      const gain = new Tone.Gain(0.6);
      pluck.connect(gain);
      gain.connect(output);
      disposables.push(pluck, gain);
      // PluckSynth has no velocity param; ride the shared gain right before each pluck instead.
      trigger = (f, d, t, v) => {
        gain.gain.setValueAtTime(Math.max(0.15, v), t);
        pluck.triggerAttack(f, t);
      };
      break;
    }
    case "sunnyHorn": {
      const synth = new Tone.MonoSynth({
        oscillator: { type: "sawtooth" },
        filter: { type: "lowpass", Q: 1.5 },
        filterEnvelope: {
          attack: 0.06,
          decay: 0.2,
          sustain: 0.7,
          release: 0.25,
          baseFrequency: 400,
          octaves: 3.2
        },
        envelope: { attack: 0.04, decay: 0.12, sustain: 0.75, release: 0.2 }
      });
      const gain = new Tone.Gain(0.55);
      synth.connect(gain);
      gain.connect(output);
      disposables.push(synth, gain);
      trigger = (f, d, t, v) => synth.triggerAttackRelease(f, d, t, v);
      releaseAll = () => synth.triggerRelease();
      break;
    }
  }

  return {
    output,
    triggerNote: (midi, durationSec, time, velocity) => {
      const v = Math.max(0.05, Math.min(1, velocity));
      trigger(midiToFreq(midi), Math.max(0.03, durationSec), time, v);
    },
    previewNote: (midi) => {
      trigger(midiToFreq(midi), 0.35, Tone.now(), 0.9);
    },
    releaseAll,
    dispose: () => {
      for (const d of disposables) d.dispose();
    }
  };
}
