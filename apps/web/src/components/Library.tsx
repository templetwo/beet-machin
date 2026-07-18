import { useEffect, useRef, useState } from "react";
import { STARTER_TEMPLATES, uid, type Project, type StarterTemplate } from "@beet/shared";
import { deleteProjectDeep, listProjects, putProject } from "../db";
import { exportBackupFile, exportProjectFile, importProjectFromFile } from "../importExport";
import { useProjectStore } from "../state/projectStore";
import { useUiStore } from "../state/uiStore";
import { BeetBuddy, Wordmark } from "./Brand";

function friendlyDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString();
}

export function Library() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [starterQuery, setStarterQuery] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);

  const loadProject = useProjectStore((s) => s.loadProject);
  const setView = useUiStore((s) => s.setView);
  const selectTrack = useUiStore((s) => s.selectTrack);
  const showToast = useUiStore((s) => s.showToast);

  const refresh = async () => {
    setProjects(await listProjects());
  };

  useEffect(() => {
    void refresh();
  }, []);

  const open = (p: Project) => {
    loadProject(p);
    selectTrack(p.tracks[0]?.id ?? null);
    setView("studio");
  };

  const createFromTemplate = async (t: StarterTemplate) => {
    const p = t.make();
    await putProject(p);
    setChooserOpen(false);
    setStarterQuery("");
    open(p);
  };

  const openChooser = () => {
    setStarterQuery("");
    setChooserOpen(true);
  };

  const closeChooser = () => {
    setChooserOpen(false);
    setStarterQuery("");
  };

  const q = starterQuery.trim().toLowerCase();
  const filteredTemplates = q
    ? STARTER_TEMPLATES.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.blurb.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      )
    : STARTER_TEMPLATES;

  const rename = async (p: Project, title: string) => {
    const clean = title.trim().slice(0, 60);
    if (clean && clean !== p.title) {
      await putProject({ ...p, title: clean, updatedAt: new Date().toISOString() });
      await refresh();
    }
    setEditingId(null);
  };

  const duplicate = async (p: Project) => {
    const copy: Project = {
      ...structuredClone(p),
      id: uid(),
      title: `${p.title} copy`.slice(0, 60),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revision: 0
    };
    await putProject(copy);
    await refresh();
    showToast(`Made a copy of ${p.title}.`);
  };

  const remove = async (p: Project) => {
    setConfirmId(null);
    const keep = structuredClone(p);
    await deleteProjectDeep(p.id);
    await refresh();
    showToast(`Deleted ${p.title}.`, "Undo", () => {
      void putProject(keep).then(refresh);
    });
  };

  const onImportFile = async (file: File) => {
    try {
      const ids = new Set((projects ?? []).map((p) => p.id));
      const { project, wasCopy } = await importProjectFromFile(file, ids);
      await putProject(project);
      await refresh();
      showToast(wasCopy ? `Imported as a copy: ${project.title}` : `Imported ${project.title}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "That file isn't a Beet Machin project.");
    }
  };

  return (
    <div className="library">
      <header className="lib-hero">
        <BeetBuddy size={72} />
        <Wordmark />
        <div className="spacer" />
        <div className="lib-actions">
          <button type="button" className="btn big pink" onClick={openChooser}>
            New Jam
          </button>
          <button type="button" className="btn ghost" onClick={() => fileInput.current?.click()}>
            Open a jam file
          </button>
          {projects && projects.length > 0 && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => exportBackupFile(projects)}
            >
              Save all jams
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImportFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </header>

      {projects === null ? (
        <p className="hint">Looking for your jams…</p>
      ) : projects.length === 0 ? (
        <div className="empty">
          <p>No jams yet. Plant your first one!</p>
          <button type="button" className="btn lime" onClick={openChooser}>
            Start a jam
          </button>
        </div>
      ) : (
        <div className="cards">
          {projects.map((p) => (
            <article className="card" key={p.id}>
              {editingId === p.id ? (
                <input
                  className="card-title-input"
                  defaultValue={p.title}
                  maxLength={60}
                  autoFocus
                  aria-label="Jam title"
                  onBlur={(e) => void rename(p, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
              ) : (
                <h3 className="card-title">{p.title}</h3>
              )}
              <p className="card-meta">
                {friendlyDate(p.updatedAt)} · {p.bpm} BPM · {p.tracks.length}{" "}
                {p.tracks.length === 1 ? "track" : "tracks"}
              </p>
              <div className="card-actions">
                <button type="button" className="btn pink" onClick={() => open(p)}>
                  Open
                </button>
                <button type="button" className="btn ghost" onClick={() => setEditingId(p.id)}>
                  Rename
                </button>
                <button type="button" className="btn ghost" onClick={() => void duplicate(p)}>
                  Duplicate
                </button>
                <button type="button" className="btn ghost" onClick={() => exportProjectFile(p)}>
                  Save file
                </button>
                {confirmId === p.id ? (
                  <button
                    type="button"
                    className="btn danger"
                    onBlur={() => setConfirmId(null)}
                    onClick={() => void remove(p)}
                  >
                    Really delete?
                  </button>
                ) : (
                  <button type="button" className="btn ghost" onClick={() => setConfirmId(p.id)}>
                    Delete
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {chooserOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeChooser();
          }}
        >
          <div className="modal" role="dialog" aria-modal="true" aria-label="Pick a starter">
            <h2>Pick a starter</h2>
            <input
              className="tpl-search"
              type="text"
              value={starterQuery}
              autoFocus
              placeholder="Search beats, melodies, vocals…"
              aria-label="Search starters"
              onChange={(e) => setStarterQuery(e.target.value)}
            />
            {filteredTemplates.length === 0 ? (
              <p className="empty-inline">No beats found. Try a different word!</p>
            ) : (
              <div className="tpl-grid">
                {filteredTemplates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="tpl-card"
                    onClick={() => void createFromTemplate(t)}
                  >
                    <strong>{t.name}</strong>
                    <span>{t.blurb}</span>
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="btn ghost" onClick={closeChooser}>
              Never mind
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
