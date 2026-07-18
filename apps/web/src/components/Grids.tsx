import { memo, useCallback, useMemo, useRef } from "react";
import {
  gridRowMidis,
  midiToName,
  PAD_LABELS,
  PAD_ORDER,
  velocityLabel,
  type DrumClip,
  type MelodyClip,
  type PadId,
  type Project,
  type Track
} from "@beet/shared";
import { engine } from "../audio/engine";
import { useProjectStore } from "../state/projectStore";
import { useUiStore } from "../state/uiStore";

/* ------------------------------ Drum grid ------------------------------ */

const DISPLAY_PADS: PadId[] = [...PAD_ORDER].reverse(); // kick on the bottom row

const DrumCell = memo(function DrumCell({
  pad,
  step,
  velocity,
  isNow,
  onToggle
}: {
  pad: PadId;
  step: number;
  velocity: number | undefined;
  isNow: boolean;
  onToggle: (pad: PadId, step: number) => void;
}) {
  const tier = velocityLabel(velocity);
  return (
    <button
      type="button"
      className={`cell${velocity !== undefined ? ` on ${tier}` : ""}${isNow ? " now" : ""}${
        step % 4 === 0 ? " beat" : ""
      }`}
      aria-pressed={velocity !== undefined}
      aria-label={`${PAD_LABELS[pad]}, step ${step + 1}, ${tier}`}
      onClick={() => onToggle(pad, step)}
    />
  );
});

export function DrumGrid({
  track,
  clip,
  sceneId
}: {
  track: Track;
  clip: DrumClip;
  sceneId: string;
}) {
  const toggleDrumStep = useProjectStore((s) => s.toggleDrumStep);
  const recordDrumHit = useProjectStore((s) => s.recordDrumHit);
  const currentStep = useUiStore((s) => s.currentStep);
  const recordArmed = useUiStore((s) => s.recordArmed);

  const byCell = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of clip.steps) map.set(`${s.padId}:${s.step}`, s.velocity);
    return map;
  }, [clip]);
  const byCellRef = useRef(byCell);
  byCellRef.current = byCell;

  const onToggle = useCallback(
    (pad: PadId, step: number) => {
      const wasOff = !byCellRef.current.has(`${pad}:${step}`);
      toggleDrumStep(track.id, sceneId, step, pad);
      if (wasOff) engine.previewPad(track.id, pad, 0.7);
    },
    [toggleDrumStep, track.id, sceneId]
  );

  const hitPad = (pad: PadId) => {
    engine.previewPad(track.id, pad);
    if (recordArmed) {
      const q = engine.currentQuantizedStep();
      const targetScene = useUiStore.getState().playingSceneId ?? sceneId;
      if (q !== null) recordDrumHit(track.id, targetScene, q, pad);
    }
  };

  return (
    <div className="grid-wrap" role="group" aria-label={`Drum grid for ${track.name}`}>
      {DISPLAY_PADS.map((pad) => (
        <div className="grid-row" key={pad}>
          <button
            type="button"
            className="pad-btn"
            style={{ ["--pad-color" as string]: track.color }}
            onPointerDown={() => hitPad(pad)}
            aria-label={`Play ${PAD_LABELS[pad]}`}
          >
            {PAD_LABELS[pad]}
          </button>
          <div className="cells" role="row">
            {Array.from({ length: 16 }, (_, step) => (
              <DrumCell
                key={step}
                pad={pad}
                step={step}
                velocity={byCell.get(`${pad}:${step}`)}
                isNow={currentStep === step}
                onToggle={onToggle}
              />
            ))}
          </div>
        </div>
      ))}
      <p className="grid-hint">Tap a square to plant a hit. Tap again for louder, again for loudest, once more to clear.</p>
    </div>
  );
}

/* ----------------------------- Melody grid ----------------------------- */

const MelodyCell = memo(function MelodyCell({
  midi,
  step,
  note,
  isNow,
  onToggle
}: {
  midi: number;
  step: number;
  note: { lengthSteps: number } | undefined;
  isNow: boolean;
  onToggle: (midi: number, step: number) => void;
}) {
  return (
    <button
      type="button"
      className={`cell melody${note ? " on normal" : ""}${isNow ? " now" : ""}${
        step % 4 === 0 ? " beat" : ""
      }`}
      aria-pressed={note !== undefined}
      aria-label={`${midiToName(midi)}, step ${step + 1}, ${note ? "on" : "off"}`}
      onClick={() => onToggle(midi, step)}
    >
      {note && note.lengthSteps > 1 ? (
        <span
          className="tail"
          style={{
            width: `calc(${note.lengthSteps * 100}% + ${(note.lengthSteps - 1)} * var(--cell-gap))`
          }}
          aria-hidden="true"
        />
      ) : null}
    </button>
  );
});

export function MelodyGrid({
  project,
  track,
  clip,
  sceneId
}: {
  project: Project;
  track: Track;
  clip: MelodyClip;
  sceneId: string;
}) {
  const toggleMelodyCell = useProjectStore((s) => s.toggleMelodyCell);
  const recordNote = useProjectStore((s) => s.recordNote);
  const setTrackParams = useProjectStore((s) => s.setTrackParams);
  const currentStep = useUiStore((s) => s.currentStep);
  const recordArmed = useUiStore((s) => s.recordArmed);
  const noteLength = useUiStore((s) => s.noteLength);
  const setNoteLength = useUiStore((s) => s.setNoteLength);

  const rowMidis = useMemo(
    () => gridRowMidis(project.key, project.scale, track.octave),
    [project.key, project.scale, track.octave]
  );
  const displayRows = useMemo(() => [...rowMidis].reverse(), [rowMidis]); // high notes on top

  const byCell = useMemo(() => {
    const map = new Map<string, { lengthSteps: number }>();
    for (const n of clip.notes) map.set(`${n.midi}:${n.step}`, { lengthSteps: n.lengthSteps });
    return map;
  }, [clip]);

  const noteLengthRef = useRef(noteLength);
  noteLengthRef.current = noteLength;
  const byCellRef = useRef(byCell);
  byCellRef.current = byCell;

  const onToggle = useCallback(
    (midi: number, step: number) => {
      const wasOff = !byCellRef.current.has(`${midi}:${step}`);
      toggleMelodyCell(track.id, sceneId, step, midi, noteLengthRef.current);
      if (wasOff) engine.previewNote(track.id, midi);
    },
    [toggleMelodyCell, track.id, sceneId]
  );

  const playKey = (midi: number) => {
    engine.previewNote(track.id, midi);
    if (recordArmed) {
      const q = engine.currentQuantizedStep();
      const targetScene = useUiStore.getState().playingSceneId ?? sceneId;
      if (q !== null) recordNote(track.id, targetScene, q, midi, noteLengthRef.current);
    }
  };

  return (
    <div className="grid-wrap" role="group" aria-label={`Melody grid for ${track.name}`}>
      <div className="melody-tools">
        <div className="tool-group" role="group" aria-label="Note length">
          <span className="tool-label">Note length</span>
          {[1, 2, 4, 8].map((len) => (
            <button
              key={len}
              type="button"
              className={`chip${noteLength === len ? " active" : ""}`}
              aria-pressed={noteLength === len}
              onClick={() => setNoteLength(len as 1 | 2 | 4 | 8)}
            >
              {len}
            </button>
          ))}
        </div>
        <div className="tool-group" role="group" aria-label="Octave">
          <span className="tool-label">Octave {track.octave}</span>
          <button
            type="button"
            className="chip"
            aria-label="Octave down"
            disabled={track.octave <= 1}
            onClick={() => setTrackParams(track.id, { octave: Math.max(1, track.octave - 1) })}
          >
            −
          </button>
          <button
            type="button"
            className="chip"
            aria-label="Octave up"
            disabled={track.octave >= 7}
            onClick={() => setTrackParams(track.id, { octave: Math.min(7, track.octave + 1) })}
          >
            +
          </button>
        </div>
      </div>

      {displayRows.map((midi) => (
        <div className="grid-row" key={midi}>
          <button
            type="button"
            className="pad-btn note-label"
            style={{ ["--pad-color" as string]: track.color }}
            onPointerDown={() => playKey(midi)}
            aria-label={`Play ${midiToName(midi)}`}
          >
            {midiToName(midi)}
          </button>
          <div className="cells" role="row">
            {Array.from({ length: 16 }, (_, step) => (
              <MelodyCell
                key={step}
                midi={midi}
                step={step}
                note={byCell.get(`${midi}:${step}`)}
                isNow={currentStep === step}
                onToggle={onToggle}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="keys-row" role="group" aria-label="Play keys">
        {rowMidis.map((midi, i) => (
          <button
            key={midi}
            type="button"
            className="key-btn"
            onPointerDown={() => playKey(midi)}
            aria-label={`Play ${midiToName(midi)}`}
          >
            <span className="key-note">{midiToName(midi)}</span>
            <span className="key-hint">{"ASDFGHJK"[i]}</span>
          </button>
        ))}
      </div>
      <p className="grid-hint">
        Notes always land in your key. Tap a square to plant a note, tap it again to pull it out.
      </p>
    </div>
  );
}
