# Design Document: Todo Life Dashboard

## Overview

The Todo Life Dashboard is a **single-page, client-side web application** that provides a personal productivity hub. It runs entirely in the browser with no backend — all data is persisted via the `localStorage` API — and can be opened directly as a `file://` URI.

The application is composed of five functional panels:

| Panel | Responsibility |
|---|---|
| Greeting Panel | Displays current time, date, time-of-day greeting, and user name |
| Focus Timer | Pomodoro-style 25-minute countdown with Start / Stop / Reset |
| Task List | Full CRUD to-do list with duplicate detection and completion toggling |
| Quick Links | User-defined shortcut buttons that open URLs in new tabs |
| Theme Toggle | Persistent light/dark color scheme switch |

The tech stack is intentionally constrained: **one HTML file**, **one CSS file** (`css/style.css`), **one JavaScript file** (`js/app.js`), no external libraries, no build tools.

---

## Architecture

### High-Level Structure

```
index.html          ← single entry point; links to CSS and JS with relative paths
css/
  style.css         ← all styling; no inline styles or <style> blocks in HTML
js/
  app.js            ← all interactivity; no inline handlers or <script> blocks in HTML
```

### Module Decomposition (within `app.js`)

Because the app ships as a single JS file, the internal structure uses the **Revealing Module Pattern** — each logical area is an IIFE or named object that exposes only the functions the rest of the app needs. This avoids global-scope pollution while staying framework-free.

```
app.js
├── StorageService      — thin wrapper around localStorage (get/set/remove + error handling)
├── GreetingModule      — clock tick, date formatting, greeting text, name persistence
├── TimerModule         — countdown state machine (idle → running → paused → done)
├── TaskModule          — task CRUD, duplicate detection, rendering
├── QuickLinksModule    — link CRUD, URL validation, rendering
├── ThemeModule         — theme toggle, persistence, initial-load application
└── init()              — wires everything together on DOMContentLoaded
```

### Data Flow

```
User interaction
      │
      ▼
DOM event handler (inside module)
      │
      ├─► Update in-memory state
      │
      ├─► StorageService.set(key, value)   ── localStorage
      │         │
      │         └─► On failure → show error, roll back UI state
      │
      └─► Re-render affected DOM nodes
```

All state reads happen from in-memory JS objects after the initial load; LocalStorage is the write-through persistence layer, not the source of truth at runtime.

### Timer State Machine

```
      ┌─────────────────────────────────┐
      │              IDLE               │◄── Reset (from any state)
      │  displays configured duration   │
      └──────────┬──────────────────────┘
                 │ Start
                 ▼
      ┌─────────────────────────────────┐
      │            RUNNING              │
      │  setInterval ticking each 1 s   │
      └──────┬────────────┬─────────────┘
             │ Stop       │ reaches 00:00
             ▼            ▼
      ┌──────────┐  ┌─────────────────┐
      │  PAUSED  │  │      DONE       │
      │ retains  │  │ alert + sound   │
      │ time     │  └─────────────────┘
      └──────┬───┘
             │ Start
             └──► RUNNING
```

---

## Components and Interfaces

### StorageService

```js
StorageService = {
  get(key)        → any | null      // JSON.parse; returns null on error/missing
  set(key, value) → { ok: boolean } // JSON.stringify; catches QuotaExceededError
  remove(key)     → void
}
```

**LocalStorage keys:**

| Key | Type | Description |
|---|---|---|
| `tld_userName` | `string` | User-entered display name (max 50 chars) |
| `tld_tasks` | `Task[]` | Serialised array of task objects |
| `tld_links` | `Link[]` | Serialised array of quick-link objects |
| `tld_theme` | `"light" \| "dark"` | Current theme preference |

All keys are prefixed with `tld_` to avoid collisions with other apps on the same origin.

### GreetingModule

**Public interface:**

```js
GreetingModule = {
  init()           → void   // reads name from storage, starts clock tick
  setUserName(str) → void   // validates, saves, re-renders
}
```

**Internal clock tick:** `setInterval` fires every **10 seconds** (not 60) so the display stays in sync even if the tab was in the background. The display only re-renders when the formatted MM or the greeting period actually changes, avoiding unnecessary DOM writes.

**Greeting period mapping:**

| Hour range | Greeting |
|---|---|
| 05:00 – 11:59 | Good Morning |
| 12:00 – 17:59 | Good Afternoon |
| 18:00 – 20:59 | Good Evening |
| 21:00 – 04:59 | Good Night |

### TimerModule

```js
TimerModule = {
  init()    → void   // renders initial 25:00, wires button events
  start()   → void   // transitions IDLE/PAUSED → RUNNING
  stop()    → void   // transitions RUNNING → PAUSED
  reset()   → void   // transitions any → IDLE
}
```

State is held in a plain object: `{ state: 'idle'|'running'|'paused'|'done', remaining: number }`. `remaining` is in whole seconds. The `setInterval` handle is stored in a module-scoped variable so it can be cleared on stop/reset.

Button enable/disable rules (derived from state):

| State | Start | Stop | Reset |
|---|---|---|---|
| idle | enabled | disabled | enabled |
| running | **disabled** | enabled | enabled |
| paused | enabled | **disabled** | enabled |
| done | enabled | disabled | enabled |

### TaskModule

```js
TaskModule = {
  init()                        → void
  addTask(description: string)  → Result
  editTask(id, description)     → Result
  toggleTask(id)                → Result
  deleteTask(id)                → Result
}
// Result = { ok: boolean, error?: string }
```

Each task is given a unique id via `crypto.randomUUID()` (available in all modern browsers; falls back to `Date.now() + Math.random()` if unavailable).

Duplicate detection: before add or edit, `description.trim().toLowerCase()` is compared against all existing task descriptions processed the same way. The task being edited is excluded from the comparison on edit.

### QuickLinksModule

```js
QuickLinksModule = {
  init()                             → void
  addLink(label: string, url: string) → Result
  deleteLink(id)                     → Result
}
```

URL validation: the `url` must match `/^https?:\/\//i` and have total length ≤ 2048 characters. Label must be 1–50 characters (after trim). Links open with `window.open(url, '_blank', 'noopener,noreferrer')`.

### ThemeModule

```js
ThemeModule = {
  init()   → void   // reads storage, applies theme, NO flash
  toggle() → void   // switches active theme, saves
}
```

Theme is applied by adding/removing a `data-theme="dark"` attribute on `<html>`. CSS custom properties (variables) keyed off `[data-theme="dark"]` handle all color switching. This ensures the theme is applied before the first paint when called in `<head>` or via a blocking inline check — but since inline scripts are prohibited by Requirement 12.3, the script is loaded deferred and a brief flash is acceptable.

---

## Data Models

### Task

```js
/**
 * @typedef {Object} Task
 * @property {string}  id          - Unique identifier (UUID or fallback)
 * @property {string}  description - Task text, 1–200 chars (trimmed before save)
 * @property {boolean} completed   - Completion status
 * @property {number}  createdAt   - Unix timestamp (ms) for stable ordering
 */
```

### Link

```js
/**
 * @typedef {Object} Link
 * @property {string} id        - Unique identifier
 * @property {string} label     - Display label, 1–50 chars
 * @property {string} url       - Full URL starting with http:// or https://, max 2048 chars
 * @property {number} createdAt - Unix timestamp (ms) for stable ordering
 */
```

### AppState (in-memory only)

```js
const appState = {
  userName: '',           // string | ''
  tasks: [],              // Task[]
  links: [],              // Link[]
  theme: 'light',         // 'light' | 'dark'
  timer: {
    state: 'idle',        // 'idle' | 'running' | 'paused' | 'done'
    remaining: 1500,      // seconds remaining (1500 = 25 min)
    intervalId: null,     // setInterval handle
  }
};
```

### LocalStorage Serialisation

Tasks and links are stored as JSON arrays. Example task storage:

```json
[
  {
    "id": "a1b2c3d4-...",
    "description": "Read chapter 3",
    "completed": false,
    "createdAt": 1725350400000
  }
]
```

On load, if `JSON.parse` throws (malformed data), the module discards the value, renders an empty list, and shows an error banner.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Greeting period mapping is exhaustive and non-overlapping

*For any* integer hour in the range 0–23, the greeting function SHALL return exactly one of the four strings "Good Morning", "Good Afternoon", "Good Evening", or "Good Night", with no hour left unclassified and no hour mapping to more than one greeting. The boundaries 05:00, 12:00, 18:00, and 21:00 SHALL be respected such that adjacent periods share no hour.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

---

### Property 2: User name round-trip through LocalStorage

*For any* string of 1–50 characters that is not purely whitespace, saving the name via `StorageService.set` and immediately reading it back via `StorageService.get` SHALL produce a value strictly equal to the original string.

**Validates: Requirements 3.2, 3.3**

---

### Property 3: Task addition grows the task list by exactly one

*For any* non-empty, non-whitespace-only task description that does not duplicate an existing task (after trim + lowercase normalisation), calling `addTask` SHALL increase the task array length by exactly 1, and the new task SHALL be appended at the end with `completed = false`.

**Validates: Requirements 6.2, 9.1**

---

### Property 4: Duplicate task rejection leaves the list unchanged

*For any* task description that, after trimming and lowercasing, equals an existing task's normalised description, calling `addTask` SHALL return a failure result and the task array SHALL remain unchanged in length and content.

**Validates: Requirements 6.3**

---

### Property 5: Whitespace-only description is always invalid

*For any* string composed entirely of whitespace characters (spaces, tabs, newlines), calling `addTask` or `editTask` with that string SHALL return a failure result and the task list SHALL remain unchanged.

**Validates: Requirements 6.4, 7.5**

---

### Property 6: Task completion toggle is an involution

*For any* task, toggling its completion status twice SHALL return the task to its original completion state — i.e., `toggle(toggle(task)).completed === task.completed`.

**Validates: Requirements 8.2, 8.3**

---

### Property 7: Task deletion removes exactly the targeted task

*For any* task list containing at least one task, calling `deleteTask(id)` SHALL reduce the list length by exactly 1, and no task with the given `id` SHALL appear in the resulting list; all other tasks SHALL remain present and unchanged.

**Validates: Requirements 8.5**

---

### Property 8: Task list persistence round-trip preserves order and all fields

*For any* ordered list of Task objects, serialising the list to LocalStorage via `StorageService.set` and deserialising it via `StorageService.get` SHALL produce a list with the same number of tasks, in the same order, where each task's `id`, `description`, `completed`, and `createdAt` fields are deeply equal to the original.

**Validates: Requirements 9.1, 9.3**

---

### Property 9: Quick Link validation enforces label length and URL scheme together

*For any* pair `(label, url)`, calling `addLink` SHALL succeed if and only if `label.trim().length` is in [1, 50] **and** `url` matches `/^https?:\/\//i` **and** `url.length` ≤ 2048; for any pair that violates at least one of these conditions, `addLink` SHALL return a failure result and the link collection SHALL remain unchanged.

**Validates: Requirements 10.1, 10.2, 10.3**

---

### Property 10: Theme toggle is an involution

*For any* starting theme value (`"light"` or `"dark"`), calling `ThemeModule.toggle()` twice SHALL return the active theme to its original value.

**Validates: Requirements 11.2**

---

### Property 11: Timer countdown is monotonically non-increasing

*For any* sequence of clock ticks while the timer is in `running` state, each successive `remaining` value SHALL be exactly 1 second less than the previous value, and `remaining` SHALL never decrease below 0.

**Validates: Requirements 4.2, 4.3**

---

## Error Handling

### LocalStorage Failure Strategy

All `StorageService` calls are wrapped in try/catch. The failure response is surfaced via a **transient error banner** shown at the top of the affected panel. The banner auto-dismisses after 5 seconds or on the next successful operation.

On write failure, the UI rolls back to the pre-operation in-memory state (optimistic updates are NOT used; the UI only updates after a successful write).

On read failure at startup (e.g., malformed JSON), the affected module starts from an empty/default state.

| Scenario | User-facing message | Recovery |
|---|---|---|
| `localStorage.setItem` quota exceeded | "Could not save changes — storage full." | User must free space |
| `localStorage.getItem` returns malformed JSON | "Saved [tasks/links/name] could not be loaded." | Module starts fresh |
| `localStorage` unavailable (SecurityError) | "Storage unavailable — changes will not be saved." | Graceful degradation, in-memory only |

### Input Validation Errors

Validation errors are shown as **inline error messages** beneath the relevant input field, not via `alert()`. Error messages are cleared when the user begins typing again or on a successful submission.

### Timer at 00:00

On reaching 00:00 the timer enters `done` state:
1. `clearInterval` is called immediately.
2. A visible on-screen alert element is displayed (not `window.alert()`).
3. If the `AudioContext` API is available and permission is granted, a short beep is played (≤ 3 seconds using the Web Audio API).
4. The audio is created programmatically (no audio file dependency) to avoid network requests.

### Missing Assets

If `style.css` or `app.js` fails to load, the browser renders the raw HTML structure. No JavaScript error handler is needed; the HTML must be meaningful without styles or scripts (semantic markup, visible headings, legible text).

---

## Testing Strategy

### Overview

Given that this is a **UI-heavy, single-file, Vanilla JS application** with no build system or test runner configured, the testing strategy combines:

1. **Unit tests** for pure business logic functions (greeting period calculation, duplicate detection, validation, serialisation)
2. **Property-based tests** for universal invariants (see Correctness Properties above)
3. **Integration / example-based tests** for UI interactions and LocalStorage round-trips
4. **Manual smoke tests** for visual rendering, theme switching, and audio feedback

### Recommended Tooling

Since no build tool exists, a **browser-native test runner** is appropriate:
- **[Vitest](https://vitest.dev/)** (with jsdom environment) for unit and property tests, runnable via CLI without a browser
- **[fast-check](https://fast-check.io/)** for property-based testing (installable as a dev dependency; tests run outside the browser in jsdom)

> If adding npm is undesirable, a minimal alternative is copying `fast-check.min.js` into a `test/` directory and running tests in a browser via a plain `test.html` file.

### Unit Tests

Target the exported (or extractable) pure functions:

| Function | What to test |
|---|---|
| `getGreetingPeriod(hour)` | All 24 hour values produce the correct greeting |
| `formatTime(totalSeconds)` | Edge cases: 0, 60, 1499, 1500 |
| `formatDate(date)` | Day-of-week, month name, year for known dates |
| `isValidUrl(url)` | Valid and invalid URL patterns |
| `isValidLabel(str)` | Boundary lengths (0, 1, 50, 51) |
| `normaliseTaskDescription(str)` | Trim + lowercase |
| `isDuplicateTask(tasks, desc, excludeId?)` | With and without excluded ID |

### Property-Based Tests

Each property from the Correctness Properties section maps to one property-based test. Each test runs a minimum of **100 iterations**.

Tag format: `// Feature: todo-life-dashboard, Property {N}: {property_text}`

Example skeleton:

```js
import fc from 'fast-check';
import { getGreetingPeriod } from '../js/app.js';

// Feature: todo-life-dashboard, Property 1: Greeting period covers every hour
test('greeting period covers every hour', () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 23 }), (hour) => {
      const result = getGreetingPeriod(hour);
      return ['Good Morning', 'Good Afternoon', 'Good Evening', 'Good Night']
        .includes(result);
    }),
    { numRuns: 100 }
  );
});
```

Property-to-test mapping:

| Property | Generator(s) | Assertion |
|---|---|---|
| P1: Greeting exhaustive & non-overlapping | `integer(0, 23)` | result is one of 4 strings; distinct hours with same result share the same boundary range |
| P2: Name round-trip | `string(1–50)` filtered non-whitespace | `get(set(k, v)) === v` |
| P3: Add task grows list by 1 | `string(1–200)` + task array (no dup) | `length === before + 1`, `completed === false` |
| P4: Duplicate rejected | existing task array + matching description | `result.ok === false`, array unchanged |
| P5: Whitespace-only rejected | `string().filter(s => s.trim() === '')` | `result.ok === false` |
| P6: Toggle is involution | task object | `toggle(toggle(t)).completed === t.completed` |
| P7: Delete removes exactly one task | task array + valid ID | `length === before − 1`, target ID absent, others unchanged |
| P8: Task list persistence round-trip | `array(taskArbitrary)` | same order and all fields equal after set→get |
| P9: Link validation (label + URL combined) | `string(0–100)` × `string(0–3000)` | ok iff label in [1,50] and url is http(s) and ≤ 2048 |
| P10: Theme toggle is involution | `constantFrom('light', 'dark')` | `toggle(toggle(t)) === t` |
| P11: Timer decrement monotone | sequence of tick counts (1–1500) | each remaining = prev − 1, ≥ 0 |

### Integration / Example-Based Tests

These test the full component behaviour with a jsdom DOM environment:

- Adding a task renders a new `<li>` with the correct text
- Deleting a task removes the `<li>` and updates LocalStorage
- Editing a task updates the displayed text and LocalStorage
- Toggle completion applies/removes the strikethrough CSS class
- Theme toggle adds/removes `data-theme="dark"` on `<html>`
- Clicking a Quick Link calls `window.open` with the correct URL and `_blank`
- Loading with pre-populated LocalStorage renders all saved items
- Loading with malformed LocalStorage JSON shows an error and renders empty

### Manual Smoke Tests

These require a real browser:

1. Open `index.html` via `file://` URI — all panels render, no console errors
2. Time display updates within 10 seconds
3. Greeting changes at the correct hour boundaries
4. Timer completes: audio beep plays, on-screen alert appears
5. Theme toggle has no visible flash on load (or acceptable flash noted)
6. Quick Link opens in new tab without leaving the Dashboard
7. Missing `app.js` — HTML structure remains visible without crash
