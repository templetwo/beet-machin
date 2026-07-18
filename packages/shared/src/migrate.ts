import { ProjectSchema, uid, type Project } from "./schema";

export class ProjectImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectImportError";
  }
}

/**
 * Validate and migrate raw JSON into the current Project shape.
 * schemaVersion 1 is current; future versions add upgrade steps here so old
 * jams are never destroyed.
 */
export function migrateProject(raw: unknown): Project {
  if (raw === null || typeof raw !== "object") {
    throw new ProjectImportError("That file isn't a Beet Machin project.");
  }
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (version === 1) {
    const parsed = ProjectSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ProjectImportError("That file isn't a Beet Machin project.");
    }
    return parsed.data;
  }
  throw new ProjectImportError(
    "This jam was made with a newer Beet Machin. Update the app to open it."
  );
}

export interface ImportResult {
  project: Project;
  wasCopy: boolean;
}

/**
 * Import a project, never silently overwriting an existing id.
 * On collision the import becomes a fresh copy with its own id.
 */
export function importAsProject(raw: unknown, existingIds: ReadonlySet<string>): ImportResult {
  const project = migrateProject(raw);
  if (!existingIds.has(project.id)) {
    return { project, wasCopy: false };
  }
  const now = new Date().toISOString();
  return {
    wasCopy: true,
    project: {
      ...project,
      id: uid(),
      title: `${project.title} (copy)`.slice(0, 60),
      updatedAt: now,
      revision: 0
    }
  };
}
