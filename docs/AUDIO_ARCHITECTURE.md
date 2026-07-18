# Audio architecture

Short version: one engine, one sequence, one source of truth, and the same math everywhere.

## The engine is a singleton outside React

`apps/web/src/audio/engine.ts` owns the AudioContext, the master chain
(gain -> compressor -> limiter -> destination), a shared reverb return, and one
`Tone.Sequence` over steps 0-15.

The sequence is created exactly once when audio wakes and is never rebuilt on
play/stop. Rebuilding sequences per play is the classic Tone.js bug that stacks
duplicate callbacks until every note fires twice. Play and stop only touch the
transport.

React never renders audio. The store publishes project snapshots to
`engine.sync(project)`; the engine diffs tracks by a signature (`kit:x` or
`inst:y`), disposing and rebuilding a track's synths only when its sound
actually changed, and just ramping volume/pan/send otherwise.

## Scheduling rules

- Every trigger uses the `time` argument handed to the sequence callback.
  Nothing schedules with "now" during playback.
- Swing is not `transport.swing`. It is a pure function
  (`swingDelaySeconds` in `packages/shared`) added to the callback time for odd
  sixteenths. The offline renderer uses the same function, so a WAV grooves
  exactly like the room did.
- Song mode advances a bar counter at step 0 and reads the arrangement; loop
  mode re-reads the active scene every step, so switching scenes mid-play takes
  effect on the next step.
- UI playhead updates go through `Tone.getDraw().schedule` so painting never
  competes with the audio callback.

## Sounds

All four kits and five instruments are synthesized from typed configs
(`kits.ts`, `instruments.ts`): MembraneSynth kicks, filtered NoiseSynth
snares/hats/claps, a MetalSynth or square-blip percussion depending on the kit,
and a BitCrusher across the whole Arcade Crunch kit. Polyphonic instruments cap
their voices (6-8) so a chord-happy kid cannot melt a phone.

Per track: source -> Channel (volume in dB, pan) -> master, plus a Gain send
into the shared reverb. Mute/solo are gated in the step callback.

## Offline WAV export

`offlineRender.ts` rebuilds the same graph inside `Tone.Offline` using the same
factories, awaits `reverb.generate()` before rendering (skipping that yields a
silent reverb bus), schedules every event at absolute seconds with the shared
swing math, renders bars + a 3 s reverb tail at 44.1 kHz stereo, normalizes
conservatively (attenuate only, peak 0.95), and encodes 16-bit PCM with the
dependency-free encoder in `packages/shared/src/wav.ts` (unit tested in Node).

## Lifecycle and mobile

- Audio starts only from the "Tap to wake the beets" gesture (`Tone.start()`).
- iOS can leave the context "interrupted"; every user gesture path calls a
  resume check on the raw context.
- Hiding the tab pauses the transport and flushes the pending autosave
  (`visibilitychange` + `pagehide`), because mobile browsers kill tabs without
  warning.
- Leaving the studio disposes all track nodes; the master chain persists for
  the session.
