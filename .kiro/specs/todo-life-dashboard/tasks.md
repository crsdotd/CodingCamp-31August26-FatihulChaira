# Implementation Plan: Todo Life Dashboard

## Overview

Implement a single-page, client-side productivity dashboard using plain HTML, CSS, and Vanilla JavaScript with no external libraries or build tools. All state is persisted via `localStorage`. The app must run directly from a `file://` URI.

The implementation follows the module decomposition defined in the design: `StorageService`, `GreetingModule`, `TimerModule`, `TaskModule`, `QuickLinksModule`, `ThemeModule`, and a top-level `init()` function — all housed in `js/app.js` using the Revealing Module Pattern.

---

## Tasks

- [x] 1. Scaffold project structure and HTML skeleton
  - [x] 1.1 Create `index.html` at the project root
    - Write the full HTML document with semantic sectioning elements for each panel: Greeting Panel, Focus Timer, Task List, Quick Links, and Theme toggle
    - Include `<link rel="stylesheet" href="css/style.css">` in `<head>` and `<script defer src="js/app.js"></script>` before `</body>`
    - Add all required input fields, buttons, and output containers with descriptive `id` and `class` attributes that the JS modules will target
    - Add no inline styles, no `<style>` blocks, no inline event handlers, and no `<script>` blocks — per Requirement 12.2 and 12.3
    - _Requirements: 12.1, 12.3, 12.4, 12.5_
  - [x] 1.2 Create `css/style.css` with base layout and CSS custom properties
    - Define CSS custom properties for both light and dark themes under `:root` and `[data-theme="dark"]` selectors
    - Write base layout (grid or flexbox) so all five panels are visible without scrolling on a typical viewport
    - Add all component-level styles: timer display, task list items (including strikethrough for completed), quick-link buttons, input fields, inline error messages, and error banner
    - _Requirements: 11.2, 12.2_

- [x] 2. Implement `StorageService`
  - [x] 2.1 Write `StorageService` module in `js/app.js`
    - Implement `get(key)` — wraps `localStorage.getItem` + `JSON.parse`; returns `null` on missing key, parse error, or `SecurityError`
    - Implement `set(key, value)` — wraps `JSON.stringify` + `localStorage.setItem`; returns `{ ok: true }` on success and `{ ok: false }` on `QuotaExceededError` or `SecurityError`
    - Implement `remove(key)` — wraps `localStorage.removeItem`; swallows errors silently
    - Use the key prefix `tld_` for all four keys: `tld_userName`, `tld_tasks`, `tld_links`, `tld_theme`
    - _Requirements: 3.5, 6.6, 8.6, 9.3, 9.4, 9.5, 10.2, 11.4_
 

- [x] 3. Implement `ThemeModule`
  - [x] 3.1 Write `ThemeModule` in `js/app.js`
    - Implement `init()` — reads `tld_theme` from `StorageService`; if absent or read fails, defaults to `'light'` and writes it; applies theme by setting/removing `data-theme="dark"` on `<html>`; updates toggle control's visual state; per Requirements 11.5, 11.6, 11.7
    - Implement `toggle()` — switches active theme between `'light'` and `'dark'`, applies `data-theme` attribute to `<html>`, saves new value via `StorageService`, updates toggle control visual state; theme switch completes within 300 ms; per Requirements 11.2, 11.3, 11.4
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_


- [x] 4. Implement `GreetingModule`
  - [x] 4.1 Write pure helper functions: `getGreetingPeriod(hour)` and `formatDate(date)`
    - `getGreetingPeriod(hour)`: map integer 0–23 to one of the four greeting strings using the boundary table in the design; export or expose for testing
    - `formatDate(date)`: return a human-readable string in the format "Wednesday, 3 September 2026"; handle `null`/invalid date by returning a placeholder string
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 1.2_
  
  - [x] 4.3 Write `GreetingModule` in `js/app.js`
    - Implement `init()` — reads saved `tld_userName`, starts the clock tick with `setInterval` at 10-second intervals, renders initial time/date/greeting
    - Implement `setUserName(str)` — validates input (non-empty, non-whitespace-only, max 50 chars); on valid input saves via `StorageService` and re-renders greeting; on empty/whitespace input retains saved name and shows inline error; on `StorageService` failure shows error banner without updating display; per Requirements 3.1–3.5
    - Clock tick logic: re-render time every tick; re-render greeting only when the formatted time string or greeting period changes; if `Date` is unavailable show placeholder; per Requirements 1.1, 1.3, 1.4, 2.7
    - Name display: append `, [User_Name]` (truncated at 50 chars) when name is saved; show greeting alone when name is absent; per Requirements 2.5, 2.6
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1–2.7, 3.1–3.5_

- [x] 5. Implement `TimerModule`
  - [x] 5.1 Write pure helper function `formatTime(totalSeconds)`
    - Return a zero-padded `MM:SS` string for any integer 0–1500
    - _Requirements: 4.3_

  - [x] 5.3 Write `TimerModule` in `js/app.js`
    - Hold state in `{ state: 'idle'|'running'|'paused'|'done', remaining: number, intervalId }` as described in the design
    - Implement `init()` — renders `25:00`, wires Start/Stop/Reset button events, applies initial button enable/disable rules
    - Implement `start()` — transitions `idle`/`paused` → `running`; sets `setInterval` ticking every 1 second; decrements `remaining`; updates display; on reaching 0 enters `done` state (clears interval, shows on-screen alert, plays Web Audio beep ≤ 3 s if `AudioContext` is available); ignores call if already `running`; per Requirements 4.2, 4.4, 4.7, 5.4
    - Implement `stop()` — transitions `running` → `paused`; clears interval; retains current `remaining`; ignores call if not `running`; per Requirements 4.5, 4.8, 5.5
    - Implement `reset()` — transitions any state → `idle`; clears interval; restores `remaining` to 1500; updates display to `25:00`; per Requirements 4.6, 5.6
    - Apply button enable/disable rules from the design's state table after every state transition; per Requirements 5.1, 5.2, 5.3
    - _Requirements: 4.1–4.8, 5.1–5.6_

- [ ] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement `TaskModule`
  - [x] 7.1 Write pure helper functions: `normaliseTaskDescription(str)` and `isDuplicateTask(tasks, desc, excludeId?)`
    - `normaliseTaskDescription`: apply `str.trim().toLowerCase()`
    - `isDuplicateTask`: compare normalised description against all existing tasks; skip the task whose id matches `excludeId`
    - _Requirements: 6.3, 7.3, 7.4_
 
  - [x] 7.3 Implement `TaskModule.addTask(description)` in `js/app.js`
    - Validate: reject empty/whitespace-only (Requirement 6.4), reject duplicates (Requirement 6.3), enforce max 200 chars (Requirement 6.1)
    - On valid input: create `Task` with `crypto.randomUUID()` (fallback to `Date.now() + Math.random()`), `completed: false`, `createdAt: Date.now()`; push to in-memory array; persist via `StorageService`; on persist failure show error banner and do NOT add to the displayed list (Requirement 6.6); clear input field and dismiss stale errors on success (Requirement 6.5)
    - _Requirements: 6.1–6.6_
  
  - [x] 7.6 Implement `TaskModule.editTask(id, description)` in `js/app.js`
    - Validate: reject empty/whitespace-only (Requirement 7.5), reject duplicates excluding self (Requirement 7.4), enforce max 200 chars
    - On valid input: update in-memory task description, persist, close edit field; on persist failure show error banner and roll back to previous description
    - Replace task text with an editable input pre-filled with current description + Save/Cancel controls on edit activation; Cancel/Escape restores original text (Requirement 7.6)
    - _Requirements: 7.1–7.6_
  - [x] 7.7 Implement `TaskModule.toggleTask(id)` and `TaskModule.deleteTask(id)` in `js/app.js`
    - `toggleTask`: flip `completed` boolean; apply/remove strikethrough CSS class; persist within 500 ms; on persist failure show error and revert visual state (Requirement 8.6)
    - `deleteTask`: remove task from in-memory array by id; leave all other tasks unchanged; persist; render updated list
    - _Requirements: 8.1–8.6_
  
  - [~] 7.10 Implement `TaskModule.init()` and rendering in `js/app.js`
    - On init: read `tld_tasks` from `StorageService`; if data is malformed/unparseable discard it, render empty list, show error banner (Requirement 9.5); if absent render empty list (Requirement 9.2); otherwise render all tasks in saved order with correct completion state (Requirement 9.1)
    - Render each task as a list item with: task description text, Edit control, completion toggle control, Delete control
    - Apply strikethrough style to completed tasks immediately on render
    - _Requirements: 9.1–9.5_
  

- [x] 8. Implement `QuickLinksModule`
  - [x] 8.1 Write pure helper functions: `isValidUrl(url)` and `isValidLabel(str)`
    - `isValidUrl(url)`: return `true` iff url matches `/^https?:\/\//i` and `url.length <= 2048`
    - `isValidLabel(str)`: return `true` iff `str.trim().length` is in [1, 50]
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [x] 8.3 Implement `QuickLinksModule.addLink(label, url)` in `js/app.js`
    - Validate label (1–50 chars after trim) and url (`/^https?:\/\//i`, ≤ 2048 chars); show per-field inline error adjacent to the invalid field indicating the specific rule violated (Requirement 10.3); reject without modifying storage
    - On valid input: create `Link` with unique id, `createdAt`; push to in-memory array; persist via `StorageService`; render new link button
    - _Requirements: 10.1, 10.2, 10.3_
  - [x] 8.4 Implement `QuickLinksModule.deleteLink(id)` in `js/app.js`
    - Remove link from in-memory array by id; persist; re-render link collection
    - _Requirements: 10.5, 10.6_
  - [x] 8.5 Implement `QuickLinksModule.init()` and rendering in `js/app.js`
    - On init: read `tld_links` from `StorageService`; if malformed discard and render empty with form visible; if absent render empty with form visible (Requirement 10.8); otherwise render all saved links within 500 ms of DOM ready (Requirement 10.7)
    - Render each link as a button that calls `window.open(url, '_blank', 'noopener,noreferrer')` (Requirement 10.4)
    - Render a Delete control for each link (Requirement 10.5)
    - _Requirements: 10.4, 10.5, 10.7, 10.8_

- [ ] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Wire all modules together in `init()`
  - [~] 10.1 Write the top-level `init()` function in `js/app.js`
    - Call on `DOMContentLoaded`: `ThemeModule.init()`, `GreetingModule.init()`, `TimerModule.init()`, `TaskModule.init()`, `QuickLinksModule.init()`
    - `ThemeModule.init()` MUST be called first so the theme is applied before other modules render content
    - Wire the Theme toggle button's click event to `ThemeModule.toggle()`
    - Wire the user-name form's submit event to `GreetingModule.setUserName()`
    - Confirm no global variables leak outside modules (Revealing Module Pattern enforced)
    - _Requirements: 12.1, 12.3, 12.4, 12.5_

- [ ] 11. Final checkpoint — Ensure all tests pass and application is complete
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests require Vitest + fast-check (`npm install -D vitest fast-check`); alternatively copy `fast-check.min.js` into a `test/` directory and run tests via a plain `test.html` as described in the design's Testing Strategy section
- All modules must use the Revealing Module Pattern (IIFE or named object) — no `class`, no ES module `export` syntax — so the single `app.js` file works via `file://` without a bundler
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation between major module boundaries
- The `ThemeModule` must always be initialised before other modules to prevent a flash of unstyled content

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "4.1", "5.1", "7.1", "8.1"] },
    { "id": 3, "tasks": ["3.2", "4.2", "5.2", "7.2", "8.2", "4.3", "5.3"] },
    { "id": 4, "tasks": ["5.4", "7.3", "8.3", "8.4"] },
    { "id": 5, "tasks": ["7.4", "7.5", "7.6", "8.5"] },
    { "id": 6, "tasks": ["7.7", "7.8", "7.9"] },
    { "id": 7, "tasks": ["7.10"] },
    { "id": 8, "tasks": ["7.11"] },
    { "id": 9, "tasks": ["10.1"] },
    { "id": 10, "tasks": ["10.2"] }
  ]
}
```
