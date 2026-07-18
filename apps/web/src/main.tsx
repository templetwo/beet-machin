import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { Project } from "@beet/shared";
import App from "./App";
import "./styles.css";
import { engine } from "./audio/engine";
import { setPersistHook } from "./state/persistHook";
import { createPersist } from "./db";
import { useProjectStore } from "./state/projectStore";
import { useUiStore } from "./state/uiStore";

// Wire persistence (IndexedDB autosave) into the store.
setPersistHook(createPersist());

// Engine -> UI: playhead and transport state.
engine.onStep = (step, sceneId) => useUiStore.getState().setStep(step, sceneId);
engine.onTransport = (state) => useUiStore.getState().setPlaying(state);

// Store -> engine: every project snapshot flows to the audio graph.
let lastSynced: Project | null = null;
useProjectStore.subscribe((s) => {
  if (s.project && s.project !== lastSynced) {
    lastSynced = s.project;
    engine.sync(s.project);
  }
});

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
