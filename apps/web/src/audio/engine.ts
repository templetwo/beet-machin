import * as Tone from "tone";
import {
  DEFAULT_INSTRUMENT,
  DEFAULT_KIT,
  INSTRUMENT_IDS,
  KIT_IDS,
  quantizeToStep,
  sixteenthSeconds,
  swingDelaySeconds,
  type InstrumentId,
  type KitId,
  type PadId,
  type Project,
  type Track
} from "@beet/shared";
import { createKit, type KitInstance } from "./kits";
import { createInstrument, type InstrumentInstance } from "./instruments";

export type TransportState = "stopped" | "playing" | "paused";

export function resolveKitId(track: Track): KitId {
  return (KIT_IDS as readonly string[]).includes(track.kitId ?? "")
    ? (track.kitId as KitId)
    : DEFAULT_KIT;
}

export function resolveInstrumentId(track: Track): InstrumentId {
  return (INSTRUMENT_IDS as readonly string[]).includes(track.instrumentId ?? "")
    ? (track.instrumentId as InstrumentId)
    : DEFAULT_INSTRUMENT;
}

interface TrackNodes {
  signature: string;
  source: KitInstance | InstrumentInstance;
  channel: Tone.Channel;
  send: Tone.Gain;
  dispose: () => void;
}

/**
 * One persistent engine for the whole app.
 * - Lives outside React; components talk to it, it never re-renders anything.
 * - The 16-step sequence is created exactly once and never rebuilt on
 *   play/stop, so repeated transport cycles can never stack duplicate
 *   callbacks (research trap #3).
 * - Swing uses the same shared math as offline WAV rendering, so exports
 *   sound like live playback.
 */
class BeetEngine {
  private started = false;
  private starting: Promise<void> | null = null;

  private project: Project | null = null;
  private trackNodes = new Map<string, TrackNodes>();

  private masterIn: Tone.Gain | null = null;
  private reverb: Tone.Reverb | null = null;
  private sequence: Tone.Sequence<number> | null = null;

  private bar = 0;
  private playingSceneId: string | null = null;

  onStep: ((step: number, sceneId: string) => void) | null = null;
  onTransport: ((state: TransportState) => void) | null = null;

  get isReady(): boolean {
    return this.started;
  }

  /** Must be called from a user gesture the first time ("Tap to wake the beets"). */
  async ensureStarted(): Promise<void> {
    if (this.started) {
      await this.resumeIfNeeded();
      return;
    }
    if (this.starting) return this.starting;
    this.starting = (async () => {
      await Tone.start();

      // Master chain: volume -> gentle glue compressor -> brickwall limiter.
      const masterIn = new Tone.Gain(this.project?.masterVolume ?? 0.7);
      const comp = new Tone.Compressor({ threshold: -18, ratio: 3 });
      const limiter = new Tone.Limiter(-1);
      masterIn.connect(comp);
      comp.connect(limiter);
      limiter.toDestination();
      this.masterIn = masterIn;

      // Shared reverb return. Impulse response generation is async; waiting on
      // it here means the send bus is silent-proof from the first note.
      const reverb = new Tone.Reverb({ decay: 2.4, preDelay: 0.02, wet: 1 });
      await reverb.generate();
      reverb.connect(masterIn);
      this.reverb = reverb;

      // The one and only step sequence.
      this.sequence = new Tone.Sequence<number>(
        (time, step) => this.handleStep(time, step),
        Array.from({ length: 16 }, (_, i) => i),
        "16n"
      );
      this.sequence.start(0);

      const transport = Tone.getTransport();
      transport.bpm.value = this.project?.bpm ?? 100;

      document.addEventListener("visibilitychange", () => {
        if (document.hidden && Tone.getTransport().state === "started") {
          this.pause();
        }
      });

      this.started = true;
      if (this.project) this.applyProject(this.project);
    })();
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }

  /** iOS Safari can leave the context "interrupted" after tab/lock; resume both layers. */
  private async resumeIfNeeded(): Promise<void> {
    const ctx = Tone.getContext();
    const raw = ctx.rawContext as AudioContext;
    if (raw.state !== "running") {
      try {
        await raw.resume();
      } catch {
        // A later user gesture will retry.
      }
    }
  }

  /** Point the engine at the latest project snapshot. Cheap; called on every edit. */
  sync(project: Project): void {
    this.project = project;
    if (this.started) this.applyProject(project);
  }

  private applyProject(project: Project): void {
    const transport = Tone.getTransport();
    if (Math.abs(transport.bpm.value - project.bpm) > 0.01) {
      transport.bpm.rampTo(project.bpm, 0.1);
    }
    this.masterIn?.gain.rampTo(project.masterVolume, 0.05);

    const seen = new Set<string>();
    for (const track of project.tracks) {
      seen.add(track.id);
      const signature =
        track.kind === "drums" ? `kit:${resolveKitId(track)}` : `inst:${resolveInstrumentId(track)}`;
      let nodes = this.trackNodes.get(track.id);
      if (nodes && nodes.signature !== signature) {
        nodes.dispose();
        this.trackNodes.delete(track.id);
        nodes = undefined;
      }
      if (!nodes) {
        nodes = this.buildTrackNodes(track, signature);
        this.trackNodes.set(track.id, nodes);
      }
      nodes.channel.volume.value = track.volume <= 0 ? -Infinity : Tone.gainToDb(track.volume);
      nodes.channel.pan.value = track.pan;
      nodes.send.gain.rampTo(track.reverbSend, 0.05);
    }
    for (const [id, nodes] of this.trackNodes) {
      if (!seen.has(id)) {
        nodes.dispose();
        this.trackNodes.delete(id);
      }
    }
  }

  private buildTrackNodes(track: Track, signature: string): TrackNodes {
    if (!this.masterIn || !this.reverb) {
      throw new Error("Engine not started");
    }
    const source =
      track.kind === "drums"
        ? createKit(resolveKitId(track))
        : createInstrument(resolveInstrumentId(track));
    const channel = new Tone.Channel({ volume: 0, pan: track.pan });
    source.output.connect(channel);
    channel.connect(this.masterIn);
    const send = new Tone.Gain(track.reverbSend);
    channel.connect(send);
    send.connect(this.reverb);
    return {
      signature,
      source,
      channel,
      send,
      dispose: () => {
        source.dispose();
        channel.dispose();
        send.dispose();
      }
    };
  }

  private handleStep(time: number, step: number): void {
    const p = this.project;
    if (!p) return;

    if (p.playbackMode === "song" && p.arrangement.length > 0) {
      if (step === 0) {
        this.playingSceneId = p.arrangement[this.bar % p.arrangement.length] ?? p.activeSceneId;
        this.bar++;
      }
    } else {
      // Loop mode follows the active scene live, so switching scenes mid-play
      // takes effect on the very next step.
      this.playingSceneId = p.activeSceneId;
      this.bar = 0;
    }
    const sceneId = this.playingSceneId ?? p.activeSceneId;
    const scene = p.scenes.find((s) => s.id === sceneId);

    if (scene) {
      const anySolo = p.tracks.some((t) => t.solo);
      const swung = time + swingDelaySeconds(step, p.bpm, p.swing);
      for (const track of p.tracks) {
        if (track.muted || (anySolo && !track.solo)) continue;
        const clip = scene.clipsByTrackId[track.id];
        const nodes = this.trackNodes.get(track.id);
        if (!clip || !nodes) continue;
        if (clip.kind === "drums" && track.kind === "drums") {
          const kit = nodes.source as KitInstance;
          for (const s of clip.steps) {
            if (s.step === step) kit.trigger(s.padId as PadId, s.velocity, swung);
          }
        } else if (clip.kind === "melody" && track.kind === "instrument") {
          const inst = nodes.source as InstrumentInstance;
          for (const note of clip.notes) {
            if (note.step === step) {
              const dur = note.lengthSteps * sixteenthSeconds(p.bpm) * 0.95;
              inst.triggerNote(note.midi, dur, swung, note.velocity);
            }
          }
        }
      }
    }

    Tone.getDraw().schedule(() => {
      this.onStep?.(step, sceneId);
    }, time);
  }

  async play(): Promise<void> {
    await this.ensureStarted();
    const transport = Tone.getTransport();
    if (transport.state === "started") return;
    transport.start("+0.05");
    this.onTransport?.("playing");
  }

  pause(): void {
    const transport = Tone.getTransport();
    if (transport.state !== "started") return;
    transport.pause();
    this.onTransport?.("paused");
  }

  stop(): void {
    const transport = Tone.getTransport();
    if (transport.state !== "stopped") transport.stop();
    this.bar = 0;
    this.playingSceneId = null;
    this.releaseAllVoices();
    this.onTransport?.("stopped");
    this.onStep?.(-1, this.project?.activeSceneId ?? "");
  }

  private releaseAllVoices(): void {
    for (const nodes of this.trackNodes.values()) {
      if ("releaseAll" in nodes.source) nodes.source.releaseAll();
    }
  }

  /** Nearest step to the current transport position, or null when not playing. */
  currentQuantizedStep(): number | null {
    const transport = Tone.getTransport();
    if (transport.state !== "started") return null;
    const ticksPerSixteenth = transport.PPQ / 4;
    return quantizeToStep(transport.ticks / ticksPerSixteenth);
  }

  transportState(): TransportState {
    const s = Tone.getTransport().state;
    return s === "started" ? "playing" : s === "paused" ? "paused" : "stopped";
  }

  /** Play a pad right now through the track's own chain (used by pad buttons and live record). */
  previewPad(trackId: string, padId: PadId, velocity = 0.9): void {
    void this.resumeIfNeeded();
    const nodes = this.trackNodes.get(trackId);
    if (nodes && "trigger" in nodes.source) {
      nodes.source.trigger(padId, velocity, Tone.now());
    }
  }

  /** Play a note right now through the track's own chain (keys, live record). */
  previewNote(trackId: string, midi: number): void {
    void this.resumeIfNeeded();
    const nodes = this.trackNodes.get(trackId);
    if (nodes && "previewNote" in nodes.source) {
      nodes.source.previewNote(midi);
    }
  }

  /** Called when leaving the studio: stop and free all per-track nodes. */
  unloadProject(): void {
    this.stop();
    for (const nodes of this.trackNodes.values()) nodes.dispose();
    this.trackNodes.clear();
    this.project = null;
  }
}

export const engine = new BeetEngine();
