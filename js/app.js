/**
 * Todo Life Dashboard — app.js
 *
 * Single JavaScript file for all Dashboard interactivity.
 * Modules use the Revealing Module Pattern (IIFE / plain objects).
 * No ES module syntax, no classes, no external libraries — works via file:// URI.
 *
 * Module structure:
 *   StorageService      — thin localStorage wrapper
 *   GreetingModule      — clock, date, greeting, user name
 *   TimerModule         — Pomodoro countdown state machine
 *   TaskModule          — task CRUD, duplicate detection, rendering
 *   QuickLinksModule    — link CRUD, URL validation, rendering
 *   ThemeModule         — theme toggle, persistence
 *   init()              — wires everything on DOMContentLoaded
 */

/* =============================================================
   StorageService
   Thin wrapper around localStorage with JSON serialisation.
   All keys are prefixed with "tld_" to avoid collisions.

   Keys used:
     tld_userName  — string
     tld_tasks     — Task[]
     tld_links     — Link[]
     tld_theme     — "light" | "dark"
   ============================================================= */
var StorageService = (function () {

  /**
   * Read and JSON-parse a value from localStorage.
   * @param {string} key
   * @returns {any|null} Parsed value, or null on missing key / parse error / SecurityError.
   */
  function get(key) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null) {
        return null;
      }
      return JSON.parse(raw);
    } catch (e) {
      // Covers SecurityError (access denied) and SyntaxError (malformed JSON)
      return null;
    }
  }

  /**
   * JSON-stringify a value and write it to localStorage.
   * @param {string} key
   * @param {any} value
   * @returns {{ ok: boolean }}
   */
  function set(key, value) {
    try {
      var json = JSON.stringify(value);
      localStorage.setItem(key, json);
      return { ok: true };
    } catch (e) {
      // Covers QuotaExceededError and SecurityError
      return { ok: false };
    }
  }

  /**
   * Remove a key from localStorage, silently ignoring any errors.
   * @param {string} key
   */
  function remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // Swallow silently — callers do not need to handle removal failures
    }
  }

  return { get: get, set: set, remove: remove };
}());


/* =============================================================
   Pure helper functions — exposed on window._tld for testing
   (no ES module export; app must work via file:// without a bundler)
   ============================================================= */

/**
 * Map a local hour (integer 0–23) to one of the four time-of-day greeting strings.
 *
 * Boundary table (from design):
 *   05 – 11  →  "Good Morning"
 *   12 – 17  →  "Good Afternoon"
 *   18 – 20  →  "Good Evening"
 *   21 – 23, 0 – 04  →  "Good Night"
 *
 * @param {number} hour  Integer in the range 0–23.
 * @returns {"Good Morning"|"Good Afternoon"|"Good Evening"|"Good Night"}
 */
function getGreetingPeriod(hour) {
  if (hour >= 5 && hour <= 11) { return 'Good Morning'; }
  if (hour >= 12 && hour <= 17) { return 'Good Afternoon'; }
  if (hour >= 18 && hour <= 20) { return 'Good Evening'; }
  return 'Good Night'; // 21–23 and 0–4
}

/**
 * Format a Date object as a human-readable string:
 *   "Wednesday, 3 September 2026"
 *
 * Returns a placeholder string when the argument is null, undefined,
 * or an invalid Date (i.e. isNaN(date.getTime())).
 *
 * @param {Date|null|undefined} date
 * @returns {string}
 */
function formatDate(date) {
  var DAYS   = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (date === null || date === undefined || !(date instanceof Date) || isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  var dayName   = DAYS[date.getDay()];
  var dayNumber = date.getDate();      // no leading zero
  var monthName = MONTHS[date.getMonth()];
  var year      = date.getFullYear();

  return dayName + ', ' + dayNumber + ' ' + monthName + ' ' + year;
}

/**
 * Format a total number of seconds as a zero-padded MM:SS string.
 *
 * Designed for the Focus Timer display (Requirement 4.3).
 *   formatTime(1500) → "25:00"
 *   formatTime(65)   → "01:05"
 *   formatTime(0)    → "00:00"
 *
 * @param {number} totalSeconds  Integer in the range 0–1500.
 * @returns {string}             Zero-padded "MM:SS" string.
 */
function formatTime(totalSeconds) {
  var seconds = totalSeconds % 60;
  var minutes = Math.floor(totalSeconds / 60);
  return (minutes < 10 ? '0' + minutes : String(minutes)) +
         ':' +
         (seconds < 10 ? '0' + seconds : String(seconds));
}

/**
 * Normalise a task description for comparison purposes.
 * Applies trim() and toLowerCase() so duplicate detection is
 * case-insensitive and whitespace-agnostic.
 *
 * @param {string} str  Raw task description string.
 * @returns {string}    Trimmed, lower-cased version of str.
 */
function normaliseTaskDescription(str) {
  return str.trim().toLowerCase();
}

/**
 * Determine whether a description would be a duplicate within an existing
 * task list, optionally excluding one task (used when editing — a task
 * should not be considered a duplicate of itself).
 *
 * @param {Array<{id: string, description: string}>} tasks  Current task list.
 * @param {string}  desc       The candidate description to check.
 * @param {string=} excludeId  Optional id of the task to skip (edit scenario).
 * @returns {boolean}  true if a duplicate exists, false otherwise.
 */
function isDuplicateTask(tasks, desc, excludeId) {
  var normDesc = normaliseTaskDescription(desc);
  for (var i = 0; i < tasks.length; i++) {
    if (excludeId !== undefined && tasks[i].id === excludeId) {
      continue; // Skip the task being edited
    }
    if (normaliseTaskDescription(tasks[i].description) === normDesc) {
      return true;
    }
  }
  return false;
}

/**
 * Validate a URL for use in QuickLinks.
 *
 * A URL is valid if it starts with "http://" or "https://" (case-insensitive)
 * and its total length does not exceed 2048 characters.
 *
 * @param {string} url  The URL string to validate.
 * @returns {boolean}   true if valid, false otherwise.
 *
 * Requirements: 10.1, 10.2, 10.3
 */
function isValidUrl(url) {
  if (typeof url !== 'string') return false;
  return /^https?:\/\//i.test(url) && url.length <= 2048;
}

/**
 * Validate a link label for use in QuickLinks.
 *
 * A label is valid if its trimmed length is between 1 and 50 characters
 * (inclusive).
 *
 * @param {string} str  The label string to validate.
 * @returns {boolean}   true if valid, false otherwise.
 *
 * Requirements: 10.1, 10.3
 */
function isValidLabel(str) {
  if (typeof str !== 'string') return false;
  var trimLen = str.trim().length;
  return trimLen >= 1 && trimLen <= 50;
}

// Expose pure helpers for testing (no ES module export needed)
window._tld = window._tld || {};
window._tld.getGreetingPeriod        = getGreetingPeriod;
window._tld.formatDate               = formatDate;
window._tld.formatTime               = formatTime;
window._tld.normaliseTaskDescription = normaliseTaskDescription;
window._tld.isDuplicateTask          = isDuplicateTask;
window._tld.isValidUrl               = isValidUrl;
window._tld.isValidLabel             = isValidLabel;


/* =============================================================
   ThemeModule
   Manages light/dark theme: reads/writes tld_theme in localStorage,
   applies data-theme="dark" attribute to <html>, and keeps the
   toggle button UI in sync.

   Public interface:
     init()   — reads storage, defaults to 'light' if absent/invalid,
                applies theme, updates toggle UI (Requirements 11.5–11.7)
     toggle() — flips active theme, persists, updates UI (Requirements 11.2–11.4)
   ============================================================= */
var ThemeModule = (function () {

  /** Currently active theme; kept in sync with the DOM. */
  var currentTheme = 'light';

  /**
   * Apply `theme` to the document and update the module-level variable.
   * @param {'light'|'dark'} theme
   */
  function _applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    currentTheme = theme;
  }

  /**
   * Reflect the active theme in the toggle button's accessible state,
   * label text, and CSS modifier class.
   * @param {'light'|'dark'} theme
   */
  function _updateToggleUI(theme) {
    var btn = document.getElementById('theme-toggle-btn');
    if (!btn) { return; }

    var labelSpan = btn.querySelector('.theme-label');

    if (theme === 'dark') {
      btn.setAttribute('aria-pressed', 'true');
      btn.classList.add('theme-toggle-btn--active');
      if (labelSpan) { labelSpan.textContent = 'Light Mode'; }
    } else {
      btn.setAttribute('aria-pressed', 'false');
      btn.classList.remove('theme-toggle-btn--active');
      if (labelSpan) { labelSpan.textContent = 'Dark Mode'; }
    }
  }

  /**
   * Initialise the theme module.
   * Reads tld_theme from StorageService; defaults to 'light' when the
   * stored value is absent, invalid, or unreadable (Req 11.6, 11.7).
   * Applies the resolved theme and syncs the toggle button UI (Req 11.5).
   */
  function init() {
    var stored = StorageService.get('tld_theme');

    var theme;
    if (stored === 'light' || stored === 'dark') {
      theme = stored;
    } else {
      // Absent, null, unrecognised value, or read error — default to light.
      // Do not surface an error to the user (Req 11.7).
      theme = 'light';
      StorageService.set('tld_theme', 'light');
    }

    _applyTheme(theme);
    _updateToggleUI(theme);
  }

  /**
   * Toggle the active theme between 'light' and 'dark'.
   * Applies the new theme, persists it, and updates the button UI.
   * Fully synchronous — completes well within 300 ms (Req 11.2).
   */
  function toggle() {
    var newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    _applyTheme(newTheme);
    StorageService.set('tld_theme', newTheme);
    _updateToggleUI(newTheme);
  }

  return { init: init, toggle: toggle };
}());


/* =============================================================
   GreetingModule
   Manages the greeting panel: current time/date display, time-of-day
   greeting text, and user name input.

   Public interface:
     init()              — reads saved name, renders initial state, starts clock
     setUserName(str)    — validates, persists, and re-renders greeting

   DOM targets (from index.html):
     #greeting-text      — full greeting string, e.g. "Good Morning, Fatih"
     #greeting-time      — HH:MM formatted time
     #greeting-date      — human-readable date string
     #name-input         — text input for user name
     #name-form          — form wrapping the name input
     #name-error         — inline error for name validation
     #greeting-error     — error banner for storage failures
   ============================================================= */
var GreetingModule = (function () {

  /** Currently saved user name (empty string when not set). */
  var _userName = '';

  /** Greeting period string from the last render, used to detect period changes. */
  var _lastPeriod = null;

  /** Formatted HH:MM string from the last render, used to detect minute changes. */
  var _lastFormattedTime = null;

  /** setInterval handle — kept so we could clear it if needed. */
  var _intervalId = null;

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Pad a number to at least two digits with a leading zero.
   * @param {number} n
   * @returns {string}
   */
  function _pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /**
   * Format a Date as HH:MM (24-hour).
   * @param {Date} date
   * @returns {string}
   */
  function _formatTime(date) {
    return _pad(date.getHours()) + ':' + _pad(date.getMinutes());
  }

  /**
   * Build the full greeting string combining the period and the user name.
   * @param {string} period   e.g. "Good Morning"
   * @param {string} name     current saved user name (may be empty)
   * @returns {string}
   */
  function _buildGreeting(period, name) {
    if (name && name.length > 0) {
      // Name is already capped at 50 chars at save time; display as-is.
      return period + ', ' + name;
    }
    return period;
  }

  /**
   * Show an inline validation error in #name-error and hide #greeting-error.
   * @param {string} msg
   */
  function _showInlineError(msg) {
    var el = document.getElementById('name-error');
    if (!el) { return; }
    el.textContent = msg;
    el.hidden = false;
  }

  /**
   * Clear the inline validation error in #name-error.
   */
  function _clearInlineError() {
    var el = document.getElementById('name-error');
    if (!el) { return; }
    el.textContent = '';
    el.hidden = true;
  }

  /**
   * Show a storage-failure error banner in #greeting-error.
   * Auto-dismisses after 5 seconds.
   * @param {string} msg
   */
  function _showBanner(msg) {
    var el = document.getElementById('greeting-error');
    if (!el) { return; }
    el.textContent = msg;
    el.hidden = false;
    setTimeout(function () {
      el.hidden = true;
      el.textContent = '';
    }, 5000);
  }

  /**
   * Write the greeting string to #greeting-text.
   * @param {string} period
   */
  function _renderGreeting(period) {
    var el = document.getElementById('greeting-text');
    if (!el) { return; }
    el.textContent = _buildGreeting(period, _userName);
  }

  /**
   * Write the HH:MM string to #greeting-time.
   * @param {string} formattedTime
   */
  function _renderTime(formattedTime) {
    var el = document.getElementById('greeting-time');
    if (!el) { return; }
    el.textContent = formattedTime;
  }

  /**
   * Write the human-readable date string to #greeting-date.
   * @param {string} dateString
   */
  function _renderDate(dateString) {
    var el = document.getElementById('greeting-date');
    if (!el) { return; }
    el.textContent = dateString;
  }

  /**
   * Core tick function — called on init and every 10 seconds.
   * Always re-renders time; only re-renders greeting and date when they change.
   * Falls back to placeholder text if the current Date is invalid (Req 1.4).
   */
  function _tick() {
    var now;
    try {
      now = new Date();
      if (isNaN(now.getTime())) { throw new Error('Invalid date'); }
    } catch (e) {
      // Device time unavailable — show placeholders (Req 1.4)
      _renderTime('--:--');
      _renderDate('Date unavailable');
      _renderGreeting('Good Morning'); // safest fallback; no time info available
      return;
    }

    // Always update the time display
    var formattedTime = _formatTime(now);
    _renderTime(formattedTime);

    // Only re-render date and greeting when something meaningful has changed
    var period = getGreetingPeriod(now.getHours());

    if (formattedTime !== _lastFormattedTime) {
      // The displayed minute changed — date might have changed too
      _renderDate(formatDate(now));
      _lastFormattedTime = formattedTime;
    }

    if (period !== _lastPeriod) {
      _renderGreeting(period);
      _lastPeriod = period;
    }
  }

  // -----------------------------------------------------------------------
  // Public interface
  // -----------------------------------------------------------------------

  /**
   * Initialise the Greeting panel.
   * Reads tld_userName from StorageService, performs an immediate render,
   * then starts a 10-second interval tick (Req 1.1, 1.2, 1.3, 2.7).
   */
  function init() {
    var stored = StorageService.get('tld_userName');
    _userName = (typeof stored === 'string' && stored.length > 0) ? stored : '';

    // Render immediately — do not wait for the first tick
    _tick();

    // Also render date immediately (tick only re-renders date on minute change)
    try {
      var now = new Date();
      if (!isNaN(now.getTime())) {
        _renderDate(formatDate(now));
      }
    } catch (e) {
      _renderDate('Date unavailable');
    }

    // Render the initial greeting with the correct period
    try {
      var initNow = new Date();
      if (!isNaN(initNow.getTime())) {
        var initPeriod = getGreetingPeriod(initNow.getHours());
        _renderGreeting(initPeriod);
        _lastPeriod = initPeriod;
        _lastFormattedTime = _formatTime(initNow);
      }
    } catch (e) {
      // Fallback already handled in _tick()
    }

    // Start the clock — every 10 seconds (Req 1.3, 2.7)
    _intervalId = setInterval(_tick, 10000);
  }

  /**
   * Validate, persist, and apply a new user name.
   * @param {string} str  Raw value from the input field
   */
  function setUserName(str) {
    var trimmed = (typeof str === 'string') ? str.trim() : '';

    // Reject empty / whitespace-only input (Req 3.4)
    if (trimmed.length === 0) {
      _showInlineError('Name cannot be empty.');
      return;
    }

    // Reject names exceeding 50 characters (Req 3.1)
    if (trimmed.length > 50) {
      _showInlineError('Name must be 50 characters or fewer.');
      return;
    }

    // Attempt to persist (Req 3.2, 3.5)
    var result = StorageService.set('tld_userName', trimmed);
    if (!result.ok) {
      _showBanner('Your name could not be saved. Please try again.');
      return;
    }

    // Success — update in-memory state, clear errors, re-render (Req 3.2)
    _userName = trimmed;
    _clearInlineError();

    try {
      var now = new Date();
      if (!isNaN(now.getTime())) {
        _renderGreeting(getGreetingPeriod(now.getHours()));
      }
    } catch (e) {
      // If date is unavailable, render greeting with current cached period
      _renderGreeting(_lastPeriod || 'Good Morning');
    }
  }

  return { init: init, setUserName: setUserName };
}());


/* =============================================================
   TimerModule
   Manages the Pomodoro-style 25-minute countdown timer.

   State machine:
     idle    → running  (start)
     running → paused   (stop)
     running → done     (reaches 00:00)
     paused  → running  (start)
     any     → idle     (reset)

   Public interface:
     init()   — renders 25:00, wires buttons, applies idle button rules
     start()  — idle/paused → running; ignores if already running
     stop()   — running → paused; ignores if not running
     reset()  — any → idle; restores 25:00

   DOM targets:
     #timer-display      — MM:SS output element
     #timer-start-btn    — Start control
     #timer-stop-btn     — Stop control
     #timer-reset-btn    — Reset control
     #timer-done-alert   — on-screen alert shown at 00:00
   ============================================================= */
var TimerModule = (function () {

  /** Internal timer state object. */
  var _timerState = {
    state: 'idle',       // 'idle' | 'running' | 'paused' | 'done'
    remaining: 1500,     // seconds remaining (1500 = 25 min)
    intervalId: null     // setInterval handle
  };

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Update #timer-display with the formatted time string.
   */
  function _renderDisplay() {
    var el = document.getElementById('timer-display');
    if (el) {
      el.textContent = formatTime(_timerState.remaining);
    }
  }

  /**
   * Apply button enabled/disabled rules based on the current state.
   *
   * State   | Start    | Stop     | Reset
   * --------|----------|----------|-------
   * idle    | enabled  | disabled | enabled
   * running | disabled | enabled  | enabled
   * paused  | enabled  | disabled | enabled
   * done    | enabled  | disabled | enabled
   */
  function _applyButtonRules() {
    var startBtn = document.getElementById('timer-start-btn');
    var stopBtn  = document.getElementById('timer-stop-btn');
    var resetBtn = document.getElementById('timer-reset-btn');

    if (!startBtn || !stopBtn || !resetBtn) { return; }

    var s = _timerState.state;

    startBtn.disabled = (s === 'running');
    stopBtn.disabled  = (s !== 'running');
    resetBtn.disabled = false; // Reset is always enabled
  }

  /**
   * Show the on-screen done alert (#timer-done-alert).
   */
  function _showDoneAlert() {
    var el = document.getElementById('timer-done-alert');
    if (el) {
      el.hidden = false;
    }
  }

  /**
   * Hide the on-screen done alert (#timer-done-alert).
   */
  function _hideDoneAlert() {
    var el = document.getElementById('timer-done-alert');
    if (el) {
      el.hidden = true;
    }
  }

  /**
   * Play a short beep using Web Audio API if AudioContext is available.
   * Beep duration is ≤ 3 seconds (Req 4.4).
   */
  function _playBeep() {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      try {
        var ctx = new AudioCtx();
        var oscillator = ctx.createOscillator();
        var gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 2); // ≤ 3 s
      } catch (e) {
        // Ignore audio errors — audio is a best-effort enhancement
      }
    }
  }

  /**
   * One-second tick callback — decrement remaining and check for completion.
   */
  function _tick() {
    _timerState.remaining -= 1;
    _renderDisplay();

    if (_timerState.remaining <= 0) {
      // Transition to done state
      clearInterval(_timerState.intervalId);
      _timerState.intervalId = null;
      _timerState.state = 'done';

      _showDoneAlert();
      _playBeep();
      _applyButtonRules();
    }
  }

  // -----------------------------------------------------------------------
  // Public interface
  // -----------------------------------------------------------------------

  /**
   * Initialise the timer module.
   * Renders the initial 25:00, wires button events, applies idle button rules.
   * Per Requirements 4.1, 5.1, 5.2, 5.3.
   */
  function init() {
    _renderDisplay();
    _applyButtonRules();

    var startBtn = document.getElementById('timer-start-btn');
    var stopBtn  = document.getElementById('timer-stop-btn');
    var resetBtn = document.getElementById('timer-reset-btn');

    if (startBtn) { startBtn.addEventListener('click', start); }
    if (stopBtn)  { stopBtn.addEventListener('click', stop); }
    if (resetBtn) { resetBtn.addEventListener('click', reset); }
  }

  /**
   * Transition idle/paused → running.
   * Ignores the call if the timer is already running (Req 4.7).
   * Per Requirements 4.2, 4.4, 5.4.
   */
  function start() {
    if (_timerState.state === 'running') {
      return; // Already running — ignore (Req 4.7)
    }

    // Transition idle, paused, or done → running (Start is enabled in all three)
    _timerState.state = 'running';
    _applyButtonRules();
    _timerState.intervalId = setInterval(_tick, 1000);
  }

  /**
   * Transition running → paused.
   * Clears the interval, retains remaining time.
   * Ignores if not currently running (Req 4.8).
   * Per Requirements 4.5, 5.5.
   */
  function stop() {
    if (_timerState.state !== 'running') {
      return; // Not running — ignore (Req 4.8)
    }

    clearInterval(_timerState.intervalId);
    _timerState.intervalId = null;
    _timerState.state = 'paused';
    _applyButtonRules();
  }

  /**
   * Transition any state → idle.
   * Clears the interval, restores remaining to 1500, updates display.
   * Per Requirements 4.6, 5.6.
   */
  function reset() {
    clearInterval(_timerState.intervalId);
    _timerState.intervalId = null;
    _timerState.state = 'idle';
    _timerState.remaining = 1500;

    _renderDisplay();
    _hideDoneAlert();
    _applyButtonRules();
  }

  return { init: init, start: start, stop: stop, reset: reset };
}());


/* =============================================================
   TaskModule
   Manages the to-do task list: add, render, and stub handlers for
   edit/delete/toggle (which will be fleshed out in later tasks).

   Public interface:
     init()                       — initialises _tasks array, wires form events
     addTask(description: string) — validates and adds a new task

   DOM targets:
     #task-form          — form wrapping the add-task input + button
     #task-input         — text input for new task description
     #task-add-btn       — fallback add button
     #task-add-error     — inline error element for add validation
     #task-list          — <ul> where tasks are rendered as <li> items
     #task-error-banner  — error banner for storage failures
   ============================================================= */
var TaskModule = (function () {

  /** In-memory task array — source of truth at runtime. */
  var _tasks = [];

  // -----------------------------------------------------------------------
  // Private error display helpers
  // -----------------------------------------------------------------------

  /**
   * Show a validation error in #task-add-error.
   * @param {string} msg
   */
  function _showTaskError(msg) {
    var el = document.getElementById('task-add-error');
    if (!el) { return; }
    el.textContent = msg;
    el.hidden = false;
  }

  /**
   * Clear and hide #task-add-error.
   */
  function _clearTaskError() {
    var el = document.getElementById('task-add-error');
    if (!el) { return; }
    el.textContent = '';
    el.hidden = true;
  }

  /**
   * Show a storage-failure banner in #task-error-banner.
   * Auto-dismisses after 5 seconds.
   * @param {string} msg
   */
  function _showTaskBanner(msg) {
    var el = document.getElementById('task-error-banner');
    if (!el) { return; }
    el.textContent = msg;
    el.hidden = false;
    setTimeout(function () {
      el.hidden = true;
      el.textContent = '';
    }, 5000);
  }

  // -----------------------------------------------------------------------
  // Private render helper
  // -----------------------------------------------------------------------

  /**
   * Re-render the entire task list in #task-list.
   * Each task is rendered as an <li> with a description span and
   * toggle/edit/delete controls. Completed tasks get the task-item--done class.
   */
  function _renderTaskList() {
    var listEl = document.getElementById('task-list');
    if (!listEl) { return; }

    // Clear existing items
    listEl.innerHTML = '';

    for (var i = 0; i < _tasks.length; i++) {
      (function (task) {
        var li = document.createElement('li');
        li.className = 'task-item' + (task.completed ? ' task-item--done' : '');
        li.setAttribute('data-task-id', task.id);

        // Completion toggle checkbox
        var toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.className = 'task-toggle-btn';
        toggle.id = 'task-toggle-' + task.id;
        toggle.checked = task.completed;
        toggle.setAttribute('aria-label', 'Mark task complete');
        toggle.addEventListener('change', function (e) {
          var tid = e.target.closest('[data-task-id]').getAttribute('data-task-id');
          toggleTask(tid);
        });

        // Description label (associated with the checkbox)
        var label = document.createElement('label');
        label.htmlFor = 'task-toggle-' + task.id;
        label.className = 'task-description';
        label.textContent = task.description;

        // Edit button — wired to _activateEditMode
        var editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn--ghost task-edit-btn';
        editBtn.id = 'task-edit-' + task.id;
        editBtn.textContent = 'Edit';
        editBtn.setAttribute('aria-label', 'Edit task');
        editBtn.addEventListener('click', function () {
          _activateEditMode(task.id);
        });

        // Delete button — stub
        var deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn btn--ghost task-delete-btn';
        deleteBtn.id = 'task-delete-' + task.id;
        deleteBtn.textContent = 'Delete';
        deleteBtn.setAttribute('aria-label', 'Delete task');
        deleteBtn.addEventListener('click', function (e) {
          var tid = e.currentTarget.closest('[data-task-id]').getAttribute('data-task-id');
          deleteTask(tid);
        });

        li.appendChild(toggle);
        li.appendChild(label);
        li.appendChild(editBtn);
        li.appendChild(deleteBtn);
        listEl.appendChild(li);
      }(_tasks[i]));
    }
  }

  // -----------------------------------------------------------------------
  // Private edit-mode helpers
  // -----------------------------------------------------------------------

  /**
   * Switch the given task <li> into inline edit mode.
   * Hides the description label and Edit button; injects an <input>,
   * Save button, and Cancel button; focuses the input.
   *
   * @param {string} id  The task id to activate edit mode for.
   */
  function _activateEditMode(id) {
    var li = document.querySelector('[data-task-id="' + id + '"]');
    if (!li) { return; }

    // Find the task object for the current description
    var task = null;
    for (var i = 0; i < _tasks.length; i++) {
      if (_tasks[i].id === id) { task = _tasks[i]; break; }
    }
    if (!task) { return; }

    // Hide description label and Edit button
    var descLabel = li.querySelector('.task-description');
    var editBtn   = li.querySelector('.task-edit-btn');
    if (descLabel) { descLabel.hidden = true; }
    if (editBtn)   { editBtn.hidden = true; }

    // Inline error element
    var errorEl = document.createElement('span');
    errorEl.className = 'task-edit-error';
    errorEl.hidden = true;
    errorEl.setAttribute('role', 'alert');

    // Edit input
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-edit-input';
    input.value = task.description;
    input.maxLength = 200;
    input.setAttribute('aria-label', 'Edit task description');

    // Save button
    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn--primary task-edit-save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.setAttribute('aria-label', 'Save task edit');

    // Cancel button
    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn--ghost task-edit-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.setAttribute('aria-label', 'Cancel task edit');

    // Wire Save: button click and Enter keydown
    function _handleSave() {
      editTask(id, input.value);
    }
    saveBtn.addEventListener('click', _handleSave);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { _handleSave(); }
      if (e.key === 'Escape') { _cancelEditMode(id); }
    });

    // Wire Cancel: button click
    cancelBtn.addEventListener('click', function () {
      _cancelEditMode(id);
    });

    li.appendChild(errorEl);
    li.appendChild(input);
    li.appendChild(saveBtn);
    li.appendChild(cancelBtn);

    input.focus();
  }

  /**
   * Restore the given task <li> from inline edit mode back to normal view.
   * Removes the edit input, Save/Cancel controls, and any inline error.
   * Re-shows the description label and Edit button.
   *
   * @param {string} id  The task id to cancel edit mode for.
   */
  function _cancelEditMode(id) {
    var li = document.querySelector('[data-task-id="' + id + '"]');
    if (!li) { return; }

    // Remove injected edit controls
    var editInput  = li.querySelector('.task-edit-input');
    var saveBtn    = li.querySelector('.task-edit-save-btn');
    var cancelBtn  = li.querySelector('.task-edit-cancel-btn');
    var errorEl    = li.querySelector('.task-edit-error');

    if (editInput)  { li.removeChild(editInput); }
    if (saveBtn)    { li.removeChild(saveBtn); }
    if (cancelBtn)  { li.removeChild(cancelBtn); }
    if (errorEl)    { li.removeChild(errorEl); }

    // Restore hidden elements
    var descLabel = li.querySelector('.task-description');
    var editBtn   = li.querySelector('.task-edit-btn');
    if (descLabel) { descLabel.hidden = false; }
    if (editBtn)   { editBtn.hidden = false; }
  }

  // -----------------------------------------------------------------------
  // Public interface
  // -----------------------------------------------------------------------

  /**
   * Add a new task to the list.
   *
   * Validation rules (Requirements 6.1–6.6):
   *   - Empty / whitespace-only description → inline error (Req 6.4)
   *   - Description exceeds 200 chars → inline error (Req 6.1)
   *   - Duplicate (case-insensitive, after trim) → inline error "Task already exists." (Req 6.3)
   *
   * On valid input:
   *   - Generates a UUID (or fallback) for the task id
   *   - Pushes to _tasks and persists via StorageService
   *   - On persist failure: removes from _tasks, shows banner, does NOT render (Req 6.6)
   *   - On persist success: re-renders list, clears input + error (Req 6.5)
   *
   * @param {string} description  Raw value from the input field
   * @returns {{ ok: boolean, error?: string }}
   */
  function addTask(description) {
    var trimmed = (typeof description === 'string') ? description.trim() : '';

    // Reject empty / whitespace-only (Req 6.4)
    if (trimmed.length === 0) {
      _showTaskError('Task description cannot be empty.');
      return { ok: false, error: 'Task description cannot be empty.' };
    }

    // Reject descriptions exceeding 200 characters (Req 6.1)
    if (trimmed.length > 200) {
      _showTaskError('Task description must be 200 characters or fewer.');
      return { ok: false, error: 'Task description must be 200 characters or fewer.' };
    }

    // Reject duplicates (Req 6.3)
    if (isDuplicateTask(_tasks, description)) {
      _showTaskError('Task already exists.');
      return { ok: false, error: 'Task already exists.' };
    }

    // Build the new task object
    var id;
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      id = crypto.randomUUID();
    } else {
      id = Date.now() + '-' + Math.random();
    }

    var newTask = {
      id: id,
      description: trimmed,
      completed: false,
      createdAt: Date.now()
    };

    // Optimistic push — will roll back if persist fails
    _tasks.push(newTask);

    // Persist (Req 6.2, 6.6)
    var result = StorageService.set('tld_tasks', _tasks);
    if (!result.ok) {
      // Roll back — remove the task we just pushed
      _tasks.pop();
      _showTaskBanner('Could not save task — storage full or unavailable.');
      return { ok: false, error: 'Storage failure.' };
    }

    // Success — update UI (Req 6.5)
    _renderTaskList();
    _clearTaskError();

    var inputEl = document.getElementById('task-input');
    if (inputEl) { inputEl.value = ''; }

    return { ok: true };
  }

  /**
   * Edit an existing task's description.
   *
   * Validation rules (Requirements 7.3–7.5):
   *   - Empty / whitespace-only description → show inline error, keep field open (Req 7.5)
   *   - Description exceeds 200 chars → inline error, keep field open
   *   - Duplicate (case-insensitive, trimmed), excluding the task being edited → inline error (Req 7.4)
   *
   * On valid input:
   *   - Updates task.description in _tasks; persists via StorageService
   *   - On persist failure: rolls back description, shows banner, keeps edit field open
   *   - On persist success: calls _cancelEditMode(id) then _renderTaskList() (Req 7.6)
   *
   * @param {string} id           The task id to edit.
   * @param {string} description  Raw value from the edit input field.
   * @returns {{ ok: boolean, error?: string }}
   */
  function editTask(id, description) {
    var trimmed = (typeof description === 'string') ? description.trim() : '';

    // Helper: show inline error inside the edit area
    function _showEditError(msg) {
      var li = document.querySelector('[data-task-id="' + id + '"]');
      if (!li) { return; }
      var errorEl = li.querySelector('.task-edit-error');
      if (!errorEl) { return; }
      errorEl.textContent = msg;
      errorEl.hidden = false;
    }

    // Reject empty / whitespace-only (Req 7.5)
    if (trimmed.length === 0) {
      _showEditError('Task description cannot be empty.');
      return { ok: false, error: 'Task description cannot be empty.' };
    }

    // Reject descriptions exceeding 200 characters
    if (trimmed.length > 200) {
      _showEditError('Task description must be 200 characters or fewer.');
      return { ok: false, error: 'Task description must be 200 characters or fewer.' };
    }

    // Reject duplicates, excluding the task being edited (Req 7.4)
    if (isDuplicateTask(_tasks, description, id)) {
      _showEditError('Task already exists.');
      return { ok: false, error: 'Task already exists.' };
    }

    // Find the task in _tasks
    var task = null;
    for (var i = 0; i < _tasks.length; i++) {
      if (_tasks[i].id === id) { task = _tasks[i]; break; }
    }
    if (!task) {
      return { ok: false, error: 'Task not found.' };
    }

    // Save previous description for rollback
    var previousDescription = task.description;

    // Update in-memory description
    task.description = trimmed;

    // Attempt to persist
    var result = StorageService.set('tld_tasks', _tasks);
    if (!result.ok) {
      // Roll back
      task.description = previousDescription;
      _showTaskBanner('Could not save changes — storage full or unavailable.');
      return { ok: false, error: 'Storage failure.' };
    }

    // Success — close edit mode and re-render (Req 7.6)
    _cancelEditMode(id);
    _renderTaskList();

    return { ok: true };
  }

  /**
   * Toggle the completed state of a task.
   *
   * Flips task.completed, updates the <li> class and checkbox immediately,
   * then persists. On persist failure: reverts all three (task, class,
   * checkbox) and shows the error banner (Requirement 8.6).
   * The full operation is synchronous (localStorage.setItem), so it
   * completes well within the 500 ms window (Req 8.2, 8.3).
   *
   * @param {string} id  The task id to toggle.
   * @returns {{ ok: boolean }}
   */
  function toggleTask(id) {
    // Find the task in the in-memory array
    var task = null;
    for (var i = 0; i < _tasks.length; i++) {
      if (_tasks[i].id === id) { task = _tasks[i]; break; }
    }
    if (!task) {
      return { ok: false, error: 'Task not found.' };
    }

    // Save previous state for potential rollback
    var previousCompleted = task.completed;

    // Apply the toggle in memory
    task.completed = !task.completed;

    // Update the DOM immediately (optimistic UI within the same tick)
    var li = document.querySelector('[data-task-id="' + id + '"]');
    var checkbox = document.getElementById('task-toggle-' + id);

    if (li) {
      if (task.completed) {
        li.classList.add('task-item--done');
      } else {
        li.classList.remove('task-item--done');
      }
    }
    if (checkbox) {
      checkbox.checked = task.completed;
    }

    // Persist (Req 8.2, 8.3)
    var result = StorageService.set('tld_tasks', _tasks);
    if (!result.ok) {
      // Roll back in-memory state
      task.completed = previousCompleted;

      // Roll back DOM state
      if (li) {
        if (previousCompleted) {
          li.classList.add('task-item--done');
        } else {
          li.classList.remove('task-item--done');
        }
      }
      if (checkbox) {
        checkbox.checked = previousCompleted;
      }

      _showTaskBanner('Could not save changes — storage full or unavailable.');
      return { ok: false, error: 'Storage failure.' };
    }

    return { ok: true };
  }

  /**
   * Delete a task by id.
   *
   * Removes the task from _tasks, persists the updated array, and
   * re-renders the list. On persist failure: re-inserts the task at its
   * original index and shows the error banner without re-rendering,
   * retaining the previous visual state (Requirement 8.6).
   *
   * @param {string} id  The task id to delete.
   * @returns {{ ok: boolean }}
   */
  function deleteTask(id) {
    // Find the task's index
    var index = -1;
    for (var i = 0; i < _tasks.length; i++) {
      if (_tasks[i].id === id) { index = i; break; }
    }
    if (index === -1) {
      return { ok: false, error: 'Task not found.' };
    }

    // Remove from array (keep a reference for rollback)
    var removedTask = _tasks.splice(index, 1)[0];

    // Persist
    var result = StorageService.set('tld_tasks', _tasks);
    if (!result.ok) {
      // Roll back — re-insert at the same position (Req 8.6)
      _tasks.splice(index, 0, removedTask);
      _showTaskBanner('Could not delete task — storage full or unavailable.');
      return { ok: false, error: 'Storage failure.' };
    }

    // Success — re-render to reflect the removal
    _renderTaskList();
    return { ok: true };
  }

  /**
   * Initialise the TaskModule.
   * Loads tasks from LocalStorage, renders the list, and wires form events.
   *
   * Load behaviour (Requirements 9.1, 9.2, 9.5):
   *   - null returned by StorageService → absent or read error → empty list (Req 9.2)
   *   - non-array value returned       → malformed data → discard, empty list,
   *                                       show error banner (Req 9.5)
   *   - valid array returned           → use saved tasks and render in order (Req 9.1)
   */
  function init() {
    // Load tasks from LocalStorage (Requirements 9.1, 9.2, 9.5)
    var stored = StorageService.get('tld_tasks');

    if (stored === null) {
      // Absent or StorageService read error — start with empty list (Req 9.2)
      _tasks = [];
    } else if (!Array.isArray(stored)) {
      // Malformed data — discard, show error banner (Req 9.5)
      _tasks = [];
      _showTaskBanner('Saved tasks could not be loaded.');
    } else {
      // Valid array — use saved tasks (Req 9.1)
      _tasks = stored;
    }

    // Render tasks (applies strikethrough for completed tasks automatically)
    _renderTaskList();

    // Wire form submit (primary path)
    var form = document.getElementById('task-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = document.getElementById('task-input');
        addTask(input ? input.value : '');
      });
    }

    // Wire direct button click as fallback (no wrapping form)
    var addBtn = document.getElementById('task-add-btn');
    if (addBtn && !form) {
      addBtn.addEventListener('click', function () {
        var input = document.getElementById('task-input');
        addTask(input ? input.value : '');
      });
    }
  }

  return { init: init, addTask: addTask, editTask: editTask, toggleTask: toggleTask, deleteTask: deleteTask };
}());

// Expose TaskModule methods on window._tld for testing
window._tld.addTask    = TaskModule.addTask;
window._tld.editTask   = TaskModule.editTask;
window._tld.toggleTask = TaskModule.toggleTask;
window._tld.deleteTask = TaskModule.deleteTask;


/* =============================================================
   QuickLinksModule
   Manages user-defined shortcut links: validates, persists, and
   renders link buttons.  All link data is stored in localStorage
   under the key `tld_links`.

   Public interface:
     init()                       — loads saved links, renders them,
                                    wires the add-link form
     addLink(label, url)          — validates, creates, persists, renders
     deleteLink(id)               — removes, persists, re-renders
   ============================================================= */
var QuickLinksModule = (function () {

  /** In-memory link collection — source of truth at runtime. */
  var _links = [];

  // ---------------------------------------------------------------------------
  // DOM helpers — show/hide inline errors and the error banner
  // ---------------------------------------------------------------------------

  /**
   * Show an inline error beneath the label input.
   * @param {string} msg
   */
  function _showLabelError(msg) {
    var el = document.getElementById('link-label-error');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }

  /** Clear the label inline error. */
  function _clearLabelError() {
    var el = document.getElementById('link-label-error');
    if (!el) return;
    el.textContent = '';
    el.hidden = true;
  }

  /**
   * Show an inline error beneath the URL input.
   * @param {string} msg
   */
  function _showUrlError(msg) {
    var el = document.getElementById('link-url-error');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }

  /** Clear the URL inline error. */
  function _clearUrlError() {
    var el = document.getElementById('link-url-error');
    if (!el) return;
    el.textContent = '';
    el.hidden = true;
  }

  /**
   * Show a transient error banner for storage failures.
   * Auto-dismisses after 5 seconds.
   * @param {string} msg
   */
  function _showBanner(msg) {
    var el = document.getElementById('links-error-banner');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(el._dismissTimer);
    el._dismissTimer = setTimeout(function () {
      el.hidden = true;
      el.textContent = '';
    }, 5000);
  }

  /** Dismiss the error banner immediately (used on next success). */
  function _hideBanner() {
    var el = document.getElementById('links-error-banner');
    if (!el) return;
    clearTimeout(el._dismissTimer);
    el.hidden = true;
    el.textContent = '';
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  /**
   * Fully re-render the links-container from the current _links array.
   * Each link is rendered as a clickable button plus a Delete control.
   *
   * Requirements: 10.4, 10.5, 10.7, 10.8
   */
  function _renderLinks() {
    var container = document.getElementById('links-container');
    if (!container) return;

    // Clear existing content
    container.innerHTML = '';

    if (_links.length === 0) {
      // Empty state — container is empty; the add-form below it is always visible
      return;
    }

    _links.forEach(function (link) {
      // Outer wrapper
      var item = document.createElement('div');
      item.className = 'link-item';
      item.setAttribute('data-link-id', link.id);

      // Clickable link button (Req 10.4)
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'link-btn';
      btn.textContent = link.label;
      btn.title = link.url;
      btn.setAttribute('aria-label', link.label + ' — ' + link.url);
      btn.addEventListener('click', function () {
        window.open(link.url, '_blank', 'noopener,noreferrer');
      });

      // Delete control (Req 10.5)
      var delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'link-delete-btn';
      delBtn.textContent = 'Delete';
      delBtn.setAttribute('aria-label', 'Delete link ' + link.label);
      delBtn.setAttribute('data-id', link.id);
      delBtn.addEventListener('click', function () {
        deleteLink(link.id);
      });

      item.appendChild(btn);
      item.appendChild(delBtn);
      container.appendChild(item);
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Add a new link after validating label and URL.
   *
   * Validation rules (Requirements 10.1, 10.2, 10.3):
   *   - label: 1–50 chars after trim
   *   - url: must match /^https?:\/\//i and be ≤ 2048 chars
   *
   * On success: create Link object, push to _links, persist, render.
   * On invalid input: show per-field inline errors, return failure result.
   * On persist failure: show error banner, do NOT mutate _links or render.
   *
   * @param {string} label
   * @param {string} url
   * @returns {{ ok: boolean, error?: string }}
   */
  function addLink(label, url) {
    var labelVal = typeof label === 'string' ? label : '';
    var urlVal   = typeof url   === 'string' ? url   : '';

    // Validate both fields; collect errors
    var labelOk = isValidLabel(labelVal);
    var urlOk   = isValidUrl(urlVal);

    if (!labelOk) {
      var labelMsg = labelVal.trim().length === 0
        ? 'Label cannot be empty.'
        : 'Label must be 50 characters or fewer.';
      _showLabelError(labelMsg);
    } else {
      _clearLabelError();
    }

    if (!urlOk) {
      var urlMsg = urlVal.trim().length === 0
        ? 'URL cannot be empty.'
        : !/^https?:\/\//i.test(urlVal)
          ? 'URL must start with http:// or https://.'
          : 'URL must be 2048 characters or fewer.';
      _showUrlError(urlMsg);
    } else {
      _clearUrlError();
    }

    if (!labelOk || !urlOk) {
      return { ok: false, error: 'Validation failed.' };
    }

    // Build Link object (Requirements: Link data model in design.md)
    var newLink = {
      id: (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : String(Date.now()) + String(Math.random()),
      label: labelVal.trim(),
      url: urlVal,
      createdAt: Date.now(),
    };

    // Persist BEFORE mutating the in-memory array (Req 9.3 pattern)
    var snapshot = _links.slice();
    snapshot.push(newLink);
    var result = StorageService.set('tld_links', snapshot);
    if (!result.ok) {
      _showBanner('Could not save the link — storage full or unavailable.');
      return { ok: false, error: 'Storage failure.' };
    }

    // Commit to in-memory state and render
    _links = snapshot;
    _renderLinks();
    _hideBanner();

    // Clear input fields
    var labelInput = document.getElementById('link-label-input');
    var urlInput   = document.getElementById('link-url-input');
    if (labelInput) labelInput.value = '';
    if (urlInput)   urlInput.value   = '';

    return { ok: true };
  }

  /**
   * Remove the link with the given id from _links, persist, and re-render.
   *
   * Requirements: 10.5, 10.6
   *
   * @param {string} id
   * @returns {{ ok: boolean, error?: string }}
   */
  function deleteLink(id) {
    var updated = _links.filter(function (link) { return link.id !== id; });

    var result = StorageService.set('tld_links', updated);
    if (!result.ok) {
      _showBanner('Could not delete the link — storage full or unavailable.');
      return { ok: false, error: 'Storage failure.' };
    }

    _links = updated;
    _renderLinks();
    _hideBanner();
    return { ok: true };
  }

  /**
   * Initialise QuickLinksModule:
   *   1. Load saved links from `tld_links`.
   *   2. If absent → render empty collection, form visible (Req 10.8).
   *   3. If malformed → discard, render empty, form visible, show banner (Req 10.8).
   *   4. If valid array → render all links within 500 ms (Req 10.7).
   *   5. Wire the add-link form's submit event.
   *
   * Requirements: 10.7, 10.8
   */
  function init() {
    var stored = StorageService.get('tld_links');

    if (stored === null) {
      // Absent or read error — start with empty collection (Req 10.8)
      _links = [];
    } else if (!Array.isArray(stored)) {
      // Malformed — discard and show error banner (Req 10.8)
      _links = [];
      _showBanner('Saved links could not be loaded.');
    } else {
      // Valid array — use saved links (Req 10.7)
      _links = stored;
    }

    _renderLinks();

    // Wire add-link form (Req 10.2, 10.3)
    var form = document.getElementById('link-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var labelInput = document.getElementById('link-label-input');
        var urlInput   = document.getElementById('link-url-input');
        addLink(labelInput ? labelInput.value : '', urlInput ? urlInput.value : '');
      });
    }

    // Clear per-field errors when the user starts typing again
    var labelInput = document.getElementById('link-label-input');
    if (labelInput) {
      labelInput.addEventListener('input', _clearLabelError);
    }
    var urlInput = document.getElementById('link-url-input');
    if (urlInput) {
      urlInput.addEventListener('input', _clearUrlError);
    }
  }

  return { init: init, addLink: addLink, deleteLink: deleteLink };
}());

// Expose QuickLinksModule methods on window._tld for testing
window._tld.addLink    = QuickLinksModule.addLink;
window._tld.deleteLink = QuickLinksModule.deleteLink;


/* =============================================================
   DOMContentLoaded — top-level init
   Additional modules will be wired here in later tasks.
   ============================================================= */
function init() {
  ThemeModule.init();
  GreetingModule.init();
  TimerModule.init();
  TaskModule.init();
  QuickLinksModule.init();

  // Wire theme toggle button
  var themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      ThemeModule.toggle();
    });
  }

  // Wire name form — prevent default and delegate to GreetingModule (Req 3.1–3.5)
  var nameForm = document.getElementById('name-form');
  if (nameForm) {
    nameForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('name-input');
      GreetingModule.setUserName(input ? input.value : '');
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
