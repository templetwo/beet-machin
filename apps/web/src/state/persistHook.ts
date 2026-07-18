import type { Project } from "@beet/shared";

/**
 * Indirection so the project store never imports Dexie (keeps store unit
 * tests pure Node). main.tsx swaps in the real IndexedDB saver at boot.
 */
export interface PersistHook {
  schedule: (project: Project) => void;
  flush: () => void;
}

export const persistHook: PersistHook = {
  schedule: () => {},
  flush: () => {}
};

export function setPersistHook(impl: PersistHook): void {
  persistHook.schedule = impl.schedule;
  persistHook.flush = impl.flush;
}
