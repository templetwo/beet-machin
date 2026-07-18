# Beet Machin

Grow a groove. A playful browser music studio for kids: drum grids, scale-locked melodies, scenes, songs, and a real WAV you can keep. No accounts, no tracking, no samples to download. Everything is synthesized live.

Built for a very cool 10-year-old.

## Quickstart

Requires Node 22.12+ and pnpm 10 (`corepack enable` gets you pnpm).

```bash
pnpm install
pnpm dev
```

- Web app: http://localhost:5173
- API (health stub for the future family vault): http://localhost:8787/api/v1/health

First sound needs one tap ("Tap to wake the beets"). That is a browser autoplay rule.

## Scripts

```bash
pnpm dev          # web + api together
pnpm test         # all unit tests
pnpm typecheck    # strict TS across the workspace
pnpm build        # production build (web dist + api dist)
pnpm lint         # eslint
```

## Where your jams live

Everything saves locally in the browser, in IndexedDB (`beet-machin` database):

- `projects`: your jams, autosaved 600 ms after each change and flushed when the tab hides
- `snapshots`: the last 10 recovery snapshots per jam
- Use "Save file" for a `.beet.json` you can keep anywhere, "Save all jams" for a full backup, and "Open a jam file" to bring one back. Importing a jam that already exists comes in as a copy, never overwriting.

Browser storage is a cache, not a vault. Export files you care about.

## What's here (v0.1, core studio)

- Library: jam cards, 5 starter templates plus blank, rename, duplicate, delete with undo, import and export
- Studio: up to 8 tracks, 4 drum kits x 6 pads with a 3-level velocity cycle, 5 melody instruments on an 8-row scale-locked grid with note lengths 1/2/4/8 and octave shift
- 4 scenes (A-D) with copy, clear, rename; song arrangement up to 16 blocks with move, duplicate, remove
- Transport: play, pause, stop, tempo 60-180, swing 0-60%, key and scale (changing them snaps existing notes so nothing goes missing or sour), master volume, loop or song mode
- Live record: arm Record, play pads (1-6) or keys (A-K), hits quantize to the nearest sixteenth
- Undo/redo (50 levels), autosave with save-state badge
- Offline WAV export: 16-bit stereo 44.1 kHz, with reverb tail, same swing math as live playback
- Keyboard access throughout, visible focus, reduced-motion respected

## Verified in this build

- 28/28 unit tests pass (schema, migration, scales, snapping, swing math, quantization, WAV encoding, store mutations, undo/redo)
- `tsc --noEmit` clean across all packages, ESLint clean
- Production build succeeds; built app serves and the API health endpoint answers

Not yet verified: actual sound in a real browser (this build environment has no audio device). The audio engine follows the researched Tone.js 15 patterns closely, but ears are the real test. See the listening checklist in the docs.

## Not built yet (honest list)

- Family vault backend (Fastify + Drizzle + SQLite, revision conflicts, sync queue). The API is a health stub today; the app is fully usable without it.
- PWA install/offline caching (vite-plugin-pwa)
- Parent Zone with PIN
- Surprise Me randomizer, Beet Buddy groove tips, version history browser UI
- Playwright + axe end-to-end tests, Docker packaging
- Drag-and-drop for song blocks (move buttons work today)

## Structure

```
apps/web        React 19 + Vite 7 + Tone.js 15 + Zustand + Dexie
apps/api        Fastify 5 stub (vault comes later)
packages/shared Zod schema, music math, timing, WAV encoder, templates
```

`docs/AUDIO_ARCHITECTURE.md` explains the engine design.
