import Dexie, { type EntityTable } from "dexie";
import type { Project } from "@beet/shared";
import { useProjectStore } from "./state/projectStore";
import { useUiStore } from "./state/uiStore";
import type { PersistHook } from "./state/persistHook";

interface SnapshotRow {
  id: number;
  projectId: string;
  createdAt: string;
  data: Project;
}

interface PreferenceRow {
  key: string;
  value: unknown;
}

interface SyncQueueRow {
  id: number;
  projectId: string;
  createdAt: string;
  payload: unknown;
}

const SNAPSHOTS_PER_PROJECT = 10;
const AUTOSAVE_DEBOUNCE_MS = 600;

class BeetDb extends Dexie {
  projects!: EntityTable<Project, "id">;
  snapshots!: EntityTable<SnapshotRow, "id">;
  preferences!: EntityTable<PreferenceRow, "key">;
  syncQueue!: EntityTable<SyncQueueRow, "id">;

  constructor() {
    super("beet-machin");
    this.version(1).stores({
      projects: "id, updatedAt",
      snapshots: "++id, projectId, createdAt",
      preferences: "key",
      syncQueue: "++id, projectId"
    });
  }
}

export const db = new BeetDb();

export async function listProjects(): Promise<Project[]> {
  return db.projects.orderBy("updatedAt").reverse().toArray();
}

export async function putProject(project: Project): Promise<void> {
  await db.projects.put(project);
}

export async function deleteProjectDeep(projectId: string): Promise<void> {
  await db.transaction("rw", db.projects, db.snapshots, async () => {
    await db.projects.delete(projectId);
    const keys = await db.snapshots.where("projectId").equals(projectId).primaryKeys();
    await db.snapshots.bulkDelete(keys);
  });
}

async function saveWithSnapshot(project: Project): Promise<void> {
  await db.transaction("rw", db.projects, db.snapshots, async () => {
    await db.projects.put(project);
    await db.snapshots.add({
      projectId: project.id,
      createdAt: project.updatedAt,
      data: project
    } as SnapshotRow);
    const keys = (await db.snapshots
      .where("projectId")
      .equals(project.id)
      .primaryKeys()) as number[];
    if (keys.length > SNAPSHOTS_PER_PROJECT) {
      keys.sort((a, b) => a - b);
      await db.snapshots.bulkDelete(keys.slice(0, keys.length - SNAPSHOTS_PER_PROJECT));
    }
  });
}

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === "QuotaExceededError" || err.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

/**
 * Debounced autosave (600 ms after the last edit) with an immediate flush when
 * the page hides, because mobile browsers may kill the tab without another tick.
 */
export function createPersist(): PersistHook {
  let pending: Project | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let writing = Promise.resolve();

  const write = (project: Project) => {
    writing = writing
      .then(() => saveWithSnapshot(project))
      .then(() => {
        useProjectStore.getState().setSaveState("saved");
      })
      .catch((err) => {
        useProjectStore.getState().setSaveState("error");
        const ui = useUiStore.getState();
        if (isQuotaError(err)) {
          ui.showToast("Storage is full. Export your jams to free up space.");
        } else {
          ui.showToast("Couldn't save just now. Your jam is still open.");
        }
      });
  };

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending) {
      const p = pending;
      pending = null;
      write(p);
    }
  };

  const schedule = (project: Project) => {
    pending = project;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, AUTOSAVE_DEBOUNCE_MS);
  };

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flush();
  });
  window.addEventListener("pagehide", flush);

  return { schedule, flush };
}
