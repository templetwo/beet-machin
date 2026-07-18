import { create } from "zustand";
import type { NoteLength } from "@beet/shared";
import type { TransportState } from "../audio/engine";

export type View = "library" | "studio";

interface Toast {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface UiState {
  view: View;
  audioReady: boolean;
  playing: TransportState;
  currentStep: number; // -1 when stopped
  playingSceneId: string | null;
  selectedTrackId: string | null;
  recordArmed: boolean;
  noteLength: NoteLength;
  exporting: boolean;
  toast: Toast | null;
  setView: (v: View) => void;
  setAudioReady: (ready: boolean) => void;
  setPlaying: (p: TransportState) => void;
  setStep: (step: number, sceneId: string) => void;
  selectTrack: (id: string | null) => void;
  setRecordArmed: (armed: boolean) => void;
  setNoteLength: (len: NoteLength) => void;
  setExporting: (busy: boolean) => void;
  showToast: (message: string, actionLabel?: string, onAction?: () => void) => void;
  clearToast: () => void;
}

let toastSeq = 0;

export const useUiStore = create<UiState>()((set) => ({
  view: "library",
  audioReady: false,
  playing: "stopped",
  currentStep: -1,
  playingSceneId: null,
  selectedTrackId: null,
  recordArmed: false,
  noteLength: 1,
  exporting: false,
  toast: null,
  setView: (view) => set({ view }),
  setAudioReady: (audioReady) => set({ audioReady }),
  setPlaying: (playing) =>
    set(playing === "stopped" ? { playing, currentStep: -1, playingSceneId: null } : { playing }),
  setStep: (currentStep, sceneId) => set({ currentStep, playingSceneId: sceneId }),
  selectTrack: (selectedTrackId) => set({ selectedTrackId }),
  setRecordArmed: (recordArmed) => set({ recordArmed }),
  setNoteLength: (noteLength) => set({ noteLength }),
  setExporting: (exporting) => set({ exporting }),
  showToast: (message, actionLabel, onAction) =>
    set({ toast: { id: ++toastSeq, message, actionLabel, onAction } }),
  clearToast: () => set({ toast: null })
}));
