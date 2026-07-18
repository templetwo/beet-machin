import { useEffect, useMemo, useState } from "react";
import {
  INSTRUMENT_IDS,
  INSTRUMENT_KEYWORDS,
  INSTRUMENT_LABELS,
  KEYS,
  KIT_IDS,
  KIT_KEYWORDS,
  KIT_LABELS,
  gridRowMidis,
  PAD_ORDER,
  SCALES,
  SCALE_LABELS,
  type MusicalKey,
  type PadId,
  type ScaleName
} from "@beet/shared";
import { engine } from "../audio/engine";
import { renderProjectToWav } from "../audio/offlineRender";
import { useProjectStore } from "../state/projectStore";
import { useUiStore } from "../state/uiStore";
import { persistHook } from "../state/persistHook";
import { downloadWav, exportProjectFile } from "../importExport";
import { DrumGrid, MelodyGrid } from "./Grids";
import { BeetBuddy } from "./Brand";
import { SearchSelect } from "./SearchSelect";

const KIT_OPTIONS = KIT_IDS.map((k) => ({
  value: k,
  label: KIT_LABELS[k],
  keywords: KIT_KEYWORDS[k]
}));

const INSTRUMENT_OPTIONS = INSTRUMENT_IDS.map((k) => ({
  value: k,
  label: INSTRUMENT_LABELS[k],
  keywords: INSTRUMENT_KEYWORDS[k]
}));

function SaveBadge() {
  const saveState = useProjectStore((s) => s.saveState);
  const text =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Saved"
        : saveState === "error"
          ? "Save problem"
          : "";
  return (
    <span className={`save-badge ${saveState}`} role="status" aria-live="polite">
      {text}
    </span>
  );
}

function NoddingBuddy() {
  const playing = useUiStore((s) => s.playing);
  const step = useUiStore((s) => s.currentStep);
  const nod = playing === "playing" && step >= 0 && step % 4 === 0;
  return <BeetBuddy nod={nod} size={44} />;
}

export function Studio() {
  const project = useProjectStore((s) => s.project);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.undoStack.length > 0);
  const canRedo = useProjectStore((s) => s.redoStack.length > 0);
  const renameProject = useProjectStore((s) => s.renameProject);
  const setBpm = useProjectStore((s) => s.setBpm);
  const setSwing = useProjectStore((s) => s.setSwing);
  const setMasterVolume = useProjectStore((s) => s.setMasterVolume);
  const setPlaybackMode = useProjectStore((s) => s.setPlaybackMode);
  const setKeyScale = useProjectStore((s) => s.setKeyScale);
  const setActiveScene = useProjectStore((s) => s.setActiveScene);
  const renameScene = useProjectStore((s) => s.renameScene);
  const clearScene = useProjectStore((s) => s.clearScene);
  const copySceneTo = useProjectStore((s) => s.copySceneTo);
  const arrangementAdd = useProjectStore((s) => s.arrangementAdd);
  const arrangementRemove = useProjectStore((s) => s.arrangementRemove);
  const arrangementMove = useProjectStore((s) => s.arrangementMove);
  const arrangementDuplicate = useProjectStore((s) => s.arrangementDuplicate);
  const addTrack = useProjectStore((s) => s.addTrack);
  const removeTrack = useProjectStore((s) => s.removeTrack);
  const duplicateTrack = useProjectStore((s) => s.duplicateTrack);
  const setTrackParams = useProjectStore((s) => s.setTrackParams);
  const toggleMute = useProjectStore((s) => s.toggleMute);
  const toggleSolo = useProjectStore((s) => s.toggleSolo);
  const closeProject = useProjectStore((s) => s.closeProject);

  const view = useUiStore((s) => s.view);
  const audioReady = useUiStore((s) => s.audioReady);
  const setAudioReady = useUiStore((s) => s.setAudioReady);
  const playing = useUiStore((s) => s.playing);
  const selectedTrackId = useUiStore((s) => s.selectedTrackId);
  const selectTrack = useUiStore((s) => s.selectTrack);
  const recordArmed = useUiStore((s) => s.recordArmed);
  const setRecordArmed = useUiStore((s) => s.setRecordArmed);
  const exporting = useUiStore((s) => s.exporting);
  const setExporting = useUiStore((s) => s.setExporting);
  const showToast = useUiStore((s) => s.showToast);
  const setView = useUiStore((s) => s.setView);

  const [renamingScene, setRenamingScene] = useState(false);
  const [confirmDeleteTrack, setConfirmDeleteTrack] = useState<string | null>(null);

  const selectedTrack = useMemo(
    () => project?.tracks.find((t) => t.id === selectedTrackId) ?? project?.tracks[0] ?? null,
    [project, selectedTrackId]
  );
  const activeScene = useMemo(
    () => project?.scenes.find((s) => s.id === project.activeSceneId) ?? project?.scenes[0] ?? null,
    [project]
  );

  // Global keyboard shortcuts. Registered once; reads live state imperatively.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      const ui = useUiStore.getState();
      const ps = useProjectStore.getState();
      if (ui.view !== "studio" || !ps.project) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (!ui.audioReady) return;
        if (ui.playing === "playing") engine.pause();
        else void engine.play();
        return;
      }
      if (e.key === "Escape") {
        engine.stop();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) ps.redo();
        else ps.undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        ps.redo();
        return;
      }
      if (!ui.audioReady) return;
      const track = ps.project.tracks.find((t) => t.id === ui.selectedTrackId) ?? ps.project.tracks[0];
      if (!track) return;
      const sceneId = ui.playingSceneId ?? ps.project.activeSceneId;

      if (track.kind === "drums") {
        const idx = "123456".indexOf(e.key);
        if (idx >= 0) {
          const pad = PAD_ORDER[idx] as PadId;
          engine.previewPad(track.id, pad);
          if (ui.recordArmed) {
            const q = engine.currentQuantizedStep();
            if (q !== null) ps.recordDrumHit(track.id, sceneId, q, pad);
          }
        }
      } else {
        const idx = "asdfghjk".indexOf(e.key.toLowerCase());
        if (idx >= 0) {
          const midi = gridRowMidis(ps.project.key, ps.project.scale, track.octave)[idx];
          if (midi !== undefined) {
            engine.previewNote(track.id, midi);
            if (ui.recordArmed) {
              const q = engine.currentQuantizedStep();
              if (q !== null) ps.recordNote(track.id, sceneId, q, midi, ui.noteLength);
            }
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!project) return null;

  const wake = async () => {
    await engine.ensureStarted();
    setAudioReady(true);
  };

  const goBack = () => {
    engine.stop();
    persistHook.flush();
    engine.unloadProject();
    closeProject();
    setRecordArmed(false);
    selectTrack(null);
    setView("library");
  };

  const onExportWav = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { blob, filename } = await renderProjectToWav(project);
      downloadWav(blob, filename);
      showToast("You grew a groove! WAV saved to your downloads.");
    } catch {
      showToast("Couldn't make the WAV this time. Try again.");
    } finally {
      setExporting(false);
    }
  };

  const onExportJson = () => {
    exportProjectFile(project);
    showToast("Jam file saved to your downloads.");
  };

  const sceneIndex = project.scenes.findIndex((s) => s.id === project.activeSceneId);
  const nextScene = project.scenes[(sceneIndex + 1) % project.scenes.length];

  return (
    <div className="studio">
      {view === "studio" && !audioReady && (
        <div className="wake-overlay">
          <BeetBuddy size={90} />
          <button type="button" className="btn big pink" onClick={wake}>
            Tap to wake the beets
          </button>
          <p>Sound needs one tap to switch on. That's a browser rule, not ours.</p>
        </div>
      )}

      <header className="studio-header">
        <button type="button" className="btn ghost" onClick={goBack} aria-label="Back to your jams">
          ← Jams
        </button>
        <input
          className="title-input"
          value={project.title}
          maxLength={60}
          aria-label="Jam title"
          onChange={(e) => renameProject(e.target.value)}
        />
        <SaveBadge />
        <div className="spacer" />
        <button type="button" className="btn ghost" onClick={undo} disabled={!canUndo}>
          Undo
        </button>
        <button type="button" className="btn ghost" onClick={redo} disabled={!canRedo}>
          Redo
        </button>
        <button type="button" className="btn cyan" onClick={onExportJson}>
          Save file
        </button>
        <button type="button" className="btn lime" onClick={onExportWav} disabled={exporting}>
          {exporting ? "Rendering…" : "Make WAV"}
        </button>
        <NoddingBuddy />
      </header>

      <section className="transport" aria-label="Transport">
        {playing === "playing" ? (
          <button type="button" className="btn big" onClick={() => engine.pause()}>
            ❚❚ Pause
          </button>
        ) : (
          <button type="button" className="btn big pink" onClick={() => void engine.play()}>
            ▶ Play
          </button>
        )}
        <button type="button" className="btn" onClick={() => engine.stop()}>
          ■ Stop
        </button>
        <button
          type="button"
          className={`btn record${recordArmed ? " armed" : ""}`}
          aria-pressed={recordArmed}
          onClick={() => setRecordArmed(!recordArmed)}
        >
          ● Record
        </button>

        <div className="seg" role="group" aria-label="Playback mode">
          <button
            type="button"
            className={`seg-btn${project.playbackMode === "loop" ? " active" : ""}`}
            aria-pressed={project.playbackMode === "loop"}
            onClick={() => setPlaybackMode("loop")}
          >
            Loop
          </button>
          <button
            type="button"
            className={`seg-btn${project.playbackMode === "song" ? " active" : ""}`}
            aria-pressed={project.playbackMode === "song"}
            onClick={() => setPlaybackMode("song")}
          >
            Song
          </button>
        </div>

        <label className="knob">
          Tempo {project.bpm}
          <input
            type="range"
            min={60}
            max={180}
            value={project.bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
        </label>
        <label className="knob">
          Swing {Math.round(project.swing * 100)}%
          <input
            type="range"
            min={0}
            max={60}
            step={5}
            value={Math.round(project.swing * 100)}
            onChange={(e) => setSwing(Number(e.target.value) / 100)}
          />
        </label>
        <label className="knob">
          Key
          <select
            value={project.key}
            onChange={(e) => setKeyScale(e.target.value as MusicalKey, project.scale)}
          >
            {KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="knob">
          Scale
          <select
            value={project.scale}
            onChange={(e) => setKeyScale(project.key, e.target.value as ScaleName)}
          >
            {SCALES.map((s) => (
              <option key={s} value={s}>
                {SCALE_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="knob">
          Volume {Math.round(project.masterVolume * 100)}
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(project.masterVolume * 100)}
            onChange={(e) => setMasterVolume(Number(e.target.value) / 100)}
          />
        </label>
      </section>

      <section className="scenes" aria-label="Scenes">
        <div className="scene-btns" role="group" aria-label="Pick a scene">
          {project.scenes.map((sc) => (
            <button
              key={sc.id}
              type="button"
              className={`scene-btn${sc.id === project.activeSceneId ? " active" : ""}`}
              aria-pressed={sc.id === project.activeSceneId}
              onClick={() => setActiveScene(sc.id)}
            >
              {sc.name}
            </button>
          ))}
        </div>
        {activeScene && (
          <div className="scene-actions">
            {renamingScene ? (
              <input
                className="scene-rename"
                defaultValue={activeScene.name}
                maxLength={24}
                autoFocus
                aria-label="Scene name"
                onBlur={(e) => {
                  renameScene(activeScene.id, e.target.value);
                  setRenamingScene(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setRenamingScene(false);
                }}
              />
            ) : (
              <button type="button" className="btn ghost" onClick={() => setRenamingScene(true)}>
                Rename
              </button>
            )}
            {nextScene && nextScene.id !== activeScene.id && (
              <button
                type="button"
                className="btn ghost"
                onClick={() => copySceneTo(activeScene.id, nextScene.id)}
              >
                Copy to {nextScene.name}
              </button>
            )}
            <button type="button" className="btn ghost" onClick={() => clearScene(activeScene.id)}>
              Clear
            </button>
          </div>
        )}
      </section>

      <section className="arrangement" aria-label="Song blocks">
        <span className="arr-label">Song</span>
        <div className="arr-blocks">
          {project.arrangement.map((sceneId, i) => {
            const sc = project.scenes.find((s) => s.id === sceneId);
            return (
              <span className="arr-block" key={`${sceneId}-${i}`}>
                <strong>{sc?.name ?? "?"}</strong>
                <button
                  type="button"
                  aria-label={`Move block ${i + 1} left`}
                  disabled={i === 0}
                  onClick={() => arrangementMove(i, -1)}
                >
                  ◀
                </button>
                <button
                  type="button"
                  aria-label={`Move block ${i + 1} right`}
                  disabled={i === project.arrangement.length - 1}
                  onClick={() => arrangementMove(i, 1)}
                >
                  ▶
                </button>
                <button
                  type="button"
                  aria-label={`Duplicate block ${i + 1}`}
                  onClick={() => arrangementDuplicate(i)}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  aria-label={`Remove block ${i + 1}`}
                  onClick={() => arrangementRemove(i)}
                >
                  ✕
                </button>
              </span>
            );
          })}
          {project.arrangement.length === 0 && (
            <span className="arr-empty">Add scene blocks to build a song.</span>
          )}
        </div>
        <div className="arr-add">
          {project.scenes.map((sc) => (
            <button
              key={sc.id}
              type="button"
              className="chip"
              onClick={() => arrangementAdd(sc.id)}
              aria-label={`Add scene ${sc.name} to song`}
            >
              +{sc.name}
            </button>
          ))}
        </div>
      </section>

      <div className="studio-main">
        <aside className="tracks" aria-label="Tracks">
          {project.tracks.map((t) => (
            <div
              key={t.id}
              className={`track-row${selectedTrack?.id === t.id ? " selected" : ""}`}
            >
              <button
                type="button"
                className="track-pick"
                onClick={() => selectTrack(t.id)}
                aria-pressed={selectedTrack?.id === t.id}
              >
                <span className="dot" style={{ background: t.color }} aria-hidden="true" />
                {t.name}
              </button>
              <button
                type="button"
                className={`mini${t.muted ? " on" : ""}`}
                aria-pressed={t.muted}
                aria-label={`Mute ${t.name}`}
                onClick={() => toggleMute(t.id)}
              >
                M
              </button>
              <button
                type="button"
                className={`mini${t.solo ? " on solo" : ""}`}
                aria-pressed={t.solo}
                aria-label={`Solo ${t.name}`}
                onClick={() => toggleSolo(t.id)}
              >
                S
              </button>
            </div>
          ))}

          <div className="track-add">
            <button
              type="button"
              className="btn lime"
              disabled={project.tracks.length >= 8}
              onClick={() => {
                const id = addTrack("drums");
                if (id) selectTrack(id);
              }}
            >
              + Drums
            </button>
            <button
              type="button"
              className="btn cyan"
              disabled={project.tracks.length >= 8}
              onClick={() => {
                const id = addTrack("instrument");
                if (id) selectTrack(id);
              }}
            >
              + Melody
            </button>
            {project.tracks.length >= 8 && <p className="hint">A jam holds 8 tracks. Full house!</p>}
          </div>

          {selectedTrack && (
            <div className="track-panel">
              <input
                className="track-name"
                value={selectedTrack.name}
                maxLength={40}
                aria-label="Track name"
                onChange={(e) => setTrackParams(selectedTrack.id, { name: e.target.value })}
              />
              {selectedTrack.kind === "drums" ? (
                <SearchSelect
                  label="Kit"
                  value={selectedTrack.kitId ?? ""}
                  options={KIT_OPTIONS}
                  onChange={(kitId) => setTrackParams(selectedTrack.id, { kitId })}
                  placeholder="Search kits…"
                  emptyText="No beats found."
                />
              ) : (
                <SearchSelect
                  label="Sound"
                  value={selectedTrack.instrumentId ?? ""}
                  options={INSTRUMENT_OPTIONS}
                  onChange={(instrumentId) => setTrackParams(selectedTrack.id, { instrumentId })}
                  placeholder="Search sounds…"
                  emptyText="No sounds found."
                />
              )}
              <label className="knob wide">
                Loud {Math.round(selectedTrack.volume * 100)}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(selectedTrack.volume * 100)}
                  onChange={(e) =>
                    setTrackParams(selectedTrack.id, { volume: Number(e.target.value) / 100 })
                  }
                />
              </label>
              <label className="knob wide">
                Left–Right
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={Math.round(selectedTrack.pan * 100)}
                  onChange={(e) =>
                    setTrackParams(selectedTrack.id, { pan: Number(e.target.value) / 100 })
                  }
                />
              </label>
              <label className="knob wide">
                Space {Math.round(selectedTrack.reverbSend * 100)}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(selectedTrack.reverbSend * 100)}
                  onChange={(e) =>
                    setTrackParams(selectedTrack.id, { reverbSend: Number(e.target.value) / 100 })
                  }
                />
              </label>
              <div className="track-panel-actions">
                <button
                  type="button"
                  className="btn ghost"
                  disabled={project.tracks.length >= 8}
                  onClick={() => {
                    const id = duplicateTrack(selectedTrack.id);
                    if (id) selectTrack(id);
                  }}
                >
                  Duplicate
                </button>
                {confirmDeleteTrack === selectedTrack.id ? (
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => {
                      removeTrack(selectedTrack.id);
                      setConfirmDeleteTrack(null);
                      selectTrack(project.tracks.find((t) => t.id !== selectedTrack.id)?.id ?? null);
                    }}
                  >
                    Really delete?
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setConfirmDeleteTrack(selectedTrack.id)}
                    onBlur={() => setConfirmDeleteTrack(null)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </aside>

        <main className="grid-area">
          {selectedTrack && activeScene ? (
            (() => {
              const clip = activeScene.clipsByTrackId[selectedTrack.id];
              if (!clip) return <p className="hint">This track has no clip in this scene yet.</p>;
              return clip.kind === "drums" ? (
                <DrumGrid track={selectedTrack} clip={clip} sceneId={activeScene.id} />
              ) : (
                <MelodyGrid
                  project={project}
                  track={selectedTrack}
                  clip={clip}
                  sceneId={activeScene.id}
                />
              );
            })()
          ) : (
            <p className="hint">Pick a track to start planting sounds.</p>
          )}
        </main>
      </div>

      <footer className="studio-foot">
        <p>
          Keys: Space play · Esc stop · 1-6 drum pads · A S D F G H J K notes · Ctrl/Cmd+Z undo
        </p>
      </footer>
    </div>
  );
}
