import * as Tone from "tone";
import type { KitId, PadId } from "@beet/shared";

/**
 * All drum sounds are synthesized live from these typed configs.
 * No sample files, nothing downloaded.
 */

interface KickCfg {
  pitch: string;
  pitchDecay: number;
  octaves: number;
  decay: number;
  gain: number;
}

interface NoiseCfg {
  noise: "white" | "pink" | "brown";
  attack?: number;
  decay: number;
  filterType: "highpass" | "bandpass" | "lowpass";
  filterFreq: number;
  gain: number;
}

type PercCfg =
  | { mode: "membrane"; pitch: string; decay: number; gain: number }
  | { mode: "metal"; pitch: string; decay: number; gain: number }
  | { mode: "blip"; pitch: string; decay: number; gain: number };

export interface KitConfig {
  kick: KickCfg;
  snare: NoiseCfg;
  hatClosed: NoiseCfg;
  hatOpen: NoiseCfg;
  clap: NoiseCfg;
  perc: PercCfg;
  /** Optional bit crusher (bits) applied to the whole kit. */
  crushBits?: number;
}

export const KIT_CONFIGS: Record<KitId, KitConfig> = {
  beetBox: {
    kick: { pitch: "A1", pitchDecay: 0.045, octaves: 6, decay: 0.32, gain: 1.0 },
    snare: { noise: "white", decay: 0.18, filterType: "bandpass", filterFreq: 1900, gain: 0.8 },
    hatClosed: { noise: "white", decay: 0.05, filterType: "highpass", filterFreq: 7000, gain: 0.5 },
    hatOpen: { noise: "white", decay: 0.3, filterType: "highpass", filterFreq: 6000, gain: 0.45 },
    clap: {
      noise: "pink",
      attack: 0.004,
      decay: 0.16,
      filterType: "bandpass",
      filterFreq: 1400,
      gain: 0.75
    },
    perc: { mode: "membrane", pitch: "E2", decay: 0.25, gain: 0.7 }
  },
  garden808: {
    kick: { pitch: "F1", pitchDecay: 0.09, octaves: 8, decay: 0.5, gain: 1.0 },
    snare: { noise: "white", decay: 0.12, filterType: "bandpass", filterFreq: 2500, gain: 0.7 },
    hatClosed: { noise: "white", decay: 0.04, filterType: "highpass", filterFreq: 8200, gain: 0.45 },
    hatOpen: { noise: "white", decay: 0.26, filterType: "highpass", filterFreq: 7500, gain: 0.4 },
    clap: {
      noise: "pink",
      attack: 0.005,
      decay: 0.2,
      filterType: "bandpass",
      filterFreq: 1200,
      gain: 0.8
    },
    perc: { mode: "membrane", pitch: "A1", decay: 0.4, gain: 0.75 }
  },
  arcadeCrunch: {
    crushBits: 4,
    kick: { pitch: "C2", pitchDecay: 0.02, octaves: 4, decay: 0.15, gain: 0.85 },
    snare: { noise: "white", decay: 0.09, filterType: "highpass", filterFreq: 2800, gain: 0.6 },
    hatClosed: { noise: "white", decay: 0.03, filterType: "highpass", filterFreq: 9000, gain: 0.4 },
    hatOpen: { noise: "white", decay: 0.12, filterType: "highpass", filterFreq: 8500, gain: 0.35 },
    clap: { noise: "white", decay: 0.08, filterType: "bandpass", filterFreq: 2100, gain: 0.55 },
    perc: { mode: "blip", pitch: "G4", decay: 0.09, gain: 0.5 }
  },
  spacePop: {
    kick: { pitch: "A1", pitchDecay: 0.05, octaves: 7, decay: 0.28, gain: 0.95 },
    snare: { noise: "pink", decay: 0.15, filterType: "bandpass", filterFreq: 2200, gain: 0.75 },
    hatClosed: { noise: "white", decay: 0.05, filterType: "highpass", filterFreq: 8000, gain: 0.45 },
    hatOpen: { noise: "white", decay: 0.35, filterType: "highpass", filterFreq: 7000, gain: 0.4 },
    clap: {
      noise: "pink",
      attack: 0.004,
      decay: 0.18,
      filterType: "bandpass",
      filterFreq: 1500,
      gain: 0.7
    },
    perc: { mode: "metal", pitch: "D5", decay: 0.3, gain: 0.3 }
  },
  sproutSnap: {
    kick: { pitch: "C2", pitchDecay: 0.02, octaves: 5, decay: 0.14, gain: 0.9 },
    snare: { noise: "white", decay: 0.07, filterType: "highpass", filterFreq: 3200, gain: 0.55 },
    hatClosed: { noise: "white", decay: 0.025, filterType: "highpass", filterFreq: 9500, gain: 0.35 },
    hatOpen: { noise: "white", decay: 0.16, filterType: "highpass", filterFreq: 9000, gain: 0.3 },
    clap: {
      noise: "white",
      attack: 0.003,
      decay: 0.09,
      filterType: "bandpass",
      filterFreq: 2600,
      gain: 0.5
    },
    perc: { mode: "blip", pitch: "A5", decay: 0.06, gain: 0.4 }
  },
  muddyRoots: {
    crushBits: 6,
    kick: { pitch: "E1", pitchDecay: 0.08, octaves: 5, decay: 0.45, gain: 0.95 },
    snare: { noise: "brown", decay: 0.22, filterType: "lowpass", filterFreq: 2200, gain: 0.7 },
    hatClosed: { noise: "white", decay: 0.06, filterType: "highpass", filterFreq: 5000, gain: 0.35 },
    hatOpen: { noise: "white", decay: 0.3, filterType: "highpass", filterFreq: 4500, gain: 0.3 },
    clap: {
      noise: "pink",
      attack: 0.006,
      decay: 0.22,
      filterType: "lowpass",
      filterFreq: 1800,
      gain: 0.65
    },
    perc: { mode: "membrane", pitch: "D2", decay: 0.35, gain: 0.6 }
  },
  tinPatch: {
    crushBits: 8,
    kick: { pitch: "G1", pitchDecay: 0.03, octaves: 5, decay: 0.2, gain: 0.9 },
    snare: { noise: "white", decay: 0.1, filterType: "bandpass", filterFreq: 3400, gain: 0.65 },
    hatClosed: { noise: "white", decay: 0.035, filterType: "highpass", filterFreq: 10000, gain: 0.4 },
    hatOpen: { noise: "white", decay: 0.18, filterType: "highpass", filterFreq: 9500, gain: 0.35 },
    clap: { noise: "white", decay: 0.1, filterType: "bandpass", filterFreq: 2800, gain: 0.55 },
    perc: { mode: "metal", pitch: "F#5", decay: 0.35, gain: 0.45 }
  }
};

export interface KitInstance {
  output: Tone.Gain;
  trigger: (pad: PadId, velocity: number, time: number) => void;
  dispose: () => void;
}

export function createKit(kitId: KitId): KitInstance {
  const cfg = KIT_CONFIGS[kitId];
  const output = new Tone.Gain(0.9);
  const disposables: { dispose: () => void }[] = [output];

  // Optional crush stage sits between pads and kit output.
  let padBus: Tone.ToneAudioNode = output;
  if (cfg.crushBits !== undefined) {
    const crusher = new Tone.BitCrusher(cfg.crushBits);
    crusher.connect(output);
    disposables.push(crusher);
    padBus = crusher;
  }

  const padGain = (gain: number) => {
    const g = new Tone.Gain(gain);
    g.connect(padBus);
    disposables.push(g);
    return g;
  };

  // Kick
  const kick = new Tone.MembraneSynth({
    pitchDecay: cfg.kick.pitchDecay,
    octaves: cfg.kick.octaves,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: cfg.kick.decay, sustain: 0, release: 0.05 }
  });
  kick.connect(padGain(cfg.kick.gain));
  disposables.push(kick);

  // Noise-based pads
  const makeNoisePad = (nc: NoiseCfg) => {
    const synth = new Tone.NoiseSynth({
      noise: { type: nc.noise },
      envelope: { attack: nc.attack ?? 0.001, decay: nc.decay, sustain: 0, release: 0.03 }
    });
    const filter = new Tone.Filter(nc.filterFreq, nc.filterType);
    synth.connect(filter);
    filter.connect(padGain(nc.gain));
    disposables.push(synth, filter);
    return synth;
  };
  const snare = makeNoisePad(cfg.snare);
  const hatClosed = makeNoisePad(cfg.hatClosed);
  const hatOpen = makeNoisePad(cfg.hatOpen);
  const clap = makeNoisePad(cfg.clap);

  // Percussion pad, three flavors
  let percTrigger: (velocity: number, time: number) => void;
  if (cfg.perc.mode === "membrane") {
    const p = cfg.perc;
    const tom = new Tone.MembraneSynth({
      pitchDecay: 0.03,
      octaves: 3,
      envelope: { attack: 0.001, decay: p.decay, sustain: 0, release: 0.05 }
    });
    tom.connect(padGain(p.gain));
    disposables.push(tom);
    percTrigger = (v, t) => tom.triggerAttackRelease(p.pitch, p.decay, t, v);
  } else if (cfg.perc.mode === "metal") {
    const p = cfg.perc;
    const metal = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: p.decay, release: 0.1 },
      harmonicity: 5.1,
      modulationIndex: 24,
      resonance: 3000,
      octaves: 1.2
    });
    metal.connect(padGain(p.gain));
    disposables.push(metal);
    percTrigger = (v, t) => metal.triggerAttackRelease(p.pitch, p.decay, t, v);
  } else {
    const p = cfg.perc;
    const blip = new Tone.Synth({
      oscillator: { type: "square" },
      envelope: { attack: 0.001, decay: p.decay, sustain: 0, release: 0.02 }
    });
    blip.connect(padGain(p.gain));
    disposables.push(blip);
    percTrigger = (v, t) => blip.triggerAttackRelease(p.pitch, p.decay, t, v);
  }

  const trigger = (pad: PadId, velocity: number, time: number) => {
    const v = Math.max(0.05, Math.min(1, velocity));
    switch (pad) {
      case "kick":
        kick.triggerAttackRelease(cfg.kick.pitch, cfg.kick.decay, time, v);
        break;
      case "snare":
        snare.triggerAttackRelease(cfg.snare.decay, time, v);
        break;
      case "hatClosed":
        hatClosed.triggerAttackRelease(cfg.hatClosed.decay, time, v);
        break;
      case "hatOpen":
        hatOpen.triggerAttackRelease(cfg.hatOpen.decay, time, v);
        break;
      case "clap":
        clap.triggerAttackRelease(cfg.clap.decay, time, v);
        break;
      case "perc":
        percTrigger(v, time);
        break;
    }
  };

  return {
    output,
    trigger,
    dispose: () => {
      for (const d of disposables) d.dispose();
    }
  };
}
