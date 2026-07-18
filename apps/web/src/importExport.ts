import { importAsProject, sanitizeFilename, type Project } from "@beet/shared";

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a beat before revoking so the download starts cleanly.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Download one jam as .beet.json. */
export function exportProjectFile(project: Project): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${sanitizeFilename(project.title)}.beet.json`);
}

/** Download every jam in one backup file. */
export function exportBackupFile(projects: Project[]): void {
  const payload = { app: "beet-machin", exportedAt: new Date().toISOString(), projects };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  downloadBlob(blob, "beet-machin-backup.json");
}

export function downloadWav(blob: Blob, filename: string): void {
  downloadBlob(blob, filename);
}

/** Read a .beet.json file; on id collision the jam comes in as a copy. */
export async function importProjectFromFile(
  file: File,
  existingIds: ReadonlySet<string>
): Promise<{ project: Project; wasCopy: boolean }> {
  const text = await file.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't a Beet Machin project.");
  }
  return importAsProject(raw, existingIds);
}
