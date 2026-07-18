import * as Tone from "tone";
import {
  barSeconds,
  encodeWavPcm16,
  normalizePeak,
  playbackBars,
  sanitizeFilename,
  sixteenthSeconds,
  stepStartSeconds,
  type PadId,
  type Project
} from "@beet/shared";
import { createKit } from "./kits";
import { createInstrument } from "./instruments";
import { resolveInstrumentId, resolveKitId } from "./engine";

const REVERB_TAIL_SECONDS = 3.0; // reverb decay (2.4s) + safety margin, no empty bar added

export interface RenderedWav {
  blob: Blob;
  filename: string;
  seconds: number;
}

/**
 * Render the project to a 16-bit stereo 44.1 kHz WAV, fully offline.
 * The synth graph is rebuilt inside the offline context with the same
 * factories the live engine uses, and events are scheduled with the same
 * shared swing math, so the file matches what the child hears.
 */
export async function renderProjectToWav(project: Project): Promise<RenderedWav> {
  const bars = playbackBars(project);
  const bar = barSeconds(project.bpm);
  const musicSeconds = bars * bar;
  const duration = musicSeconds + REVERB_TAIL_SECONDS;

  const rendered = await Tone.Offline(
    async ({ transport }) => {
      // Master chain, rebuilt offline.
      const masterIn = new Tone.Gain(project.masterVolume);
      const comp = new Tone.Compressor({ threshold: -18, ratio: 3 });
      const limiter = new Tone.Limiter(-1);
      masterIn.connect(comp);
      comp.connect(limiter);
      limiter.toDestination();

      // Reverb: generation is async, must resolve before rendering starts or
      // the send bus renders silent (research trap #7).
      const reverb = new Tone.Reverb({ decay: 2.4, preDelay: 0.02, wet: 1 });
      await reverb.generate();
      reverb.connect(masterIn);

      const anySolo = project.tracks.some((t) => t.solo);

      for (const track of project.tracks) {
        if (track.muted || (anySolo && !track.solo)) continue;

        const source =
          track.kind === "drums"
            ? createKit(resolveKitId(track))
            : createInstrument(resolveInstrumentId(track));
        const channel = new Tone.Channel({
          volume: track.volume <= 0 ? -Infinity : Tone.gainToDb(track.volume),
          pan: track.pan
        });
        source.output.connect(channel);
        channel.connect(masterIn);
        const send = new Tone.Gain(track.reverbSend);
        channel.connect(send);
        send.connect(reverb);

        for (let barIdx = 0; barIdx < bars; barIdx++) {
          const sceneId =
            project.playbackMode === "song" && project.arrangement.length > 0
              ? (project.arrangement[barIdx] ?? project.activeSceneId)
              : project.activeSceneId;
          const scene = project.scenes.find((s) => s.id === sceneId);
          const clip = scene?.clipsByTrackId[track.id];
          if (!clip) continue;
          const barStart = barIdx * bar;

          if (clip.kind === "drums" && "trigger" in source) {
            for (const s of clip.steps) {
              const at = barStart + stepStartSeconds(s.step, project.bpm, project.swing);
              transport.schedule((time) => {
                source.trigger(s.padId as PadId, s.velocity, time);
              }, at);
            }
          } else if (clip.kind === "melody" && "triggerNote" in source) {
            for (const note of clip.notes) {
              const at = barStart + stepStartSeconds(note.step, project.bpm, project.swing);
              const dur = note.lengthSteps * sixteenthSeconds(project.bpm) * 0.95;
              transport.schedule((time) => {
                source.triggerNote(note.midi, dur, time, note.velocity);
              }, at);
            }
          }
        }
      }

      transport.start(0);
    },
    duration,
    2,
    44100
  );

  const audio = rendered.get();
  if (!audio) throw new Error("Offline render produced no audio");

  const channels = [
    new Float32Array(audio.getChannelData(0)),
    new Float32Array(audio.numberOfChannels > 1 ? audio.getChannelData(1) : audio.getChannelData(0))
  ];
  normalizePeak(channels, 0.95);
  const wavBytes = encodeWavPcm16(channels, audio.sampleRate);

  return {
    blob: new Blob([wavBytes], { type: "audio/wav" }),
    filename: `${sanitizeFilename(project.title)}.wav`,
    seconds: duration
  };
}
