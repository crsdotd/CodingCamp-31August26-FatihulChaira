# Requirements Document

## Introduction

The Todo Life Dashboard is a client-side web application built with HTML, CSS, and Vanilla JavaScript. It serves as a personal productivity hub that combines a greeting panel, a Pomodoro-style focus timer, a to-do list, quick-access links, and display preferences — all persisted via the browser's Local Storage API. The app requires no backend server and can run as a standalone web page or browser extension.

## Glossary

- **Dashboard**: The single-page web application described in this document.
- **Local_Storage**: The browser's `localStorage` API used to persist all user data client-side.
- **Greeting_Panel**: The UI section displaying the user's name, current time, and time-of-day greeting.
- **Focus_Timer**: The 25-minute countdown timer component inspired by the Pomodoro technique.
- **Task_List**: The to-do list component where the user manages tasks.
- **Task**: A single to-do item consisting of a text description and a completion status.
- **Quick_Links**: The component containing user-defined shortcut buttons that open external URLs.
- **Link**: A user-defined entry consisting of a label and a URL stored in the Quick_Links component.
- **Theme**: The visual color scheme of the Dashboard, either `light` or `dark`.
- **User_Name**: The custom name entered by the user, displayed in the Greeting_Panel.
- **Duplicate_Task**: A Task whose text description, after trimming whitespace and ignoring case, matches an existing Task in the Task_List.

---

## Requirements

### Requirement 1: Greeting Panel — Time and Date Display

**User Story:** As a user, I want to see the current time and date when I open the Dashboard, so that I can quickly orient myself without switching tabs.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Greeting_Panel SHALL display the current local time in HH:MM format (24-hour or 12-hour with AM/PM indicator).
2. WHEN the Dashboard loads, THE Greeting_Panel SHALL display the current local date in a human-readable format showing the day of the week, day number, month name, and year (e.g., "Wednesday, 3 September 2026").
3. WHILE the Dashboard is open, THE Greeting_Panel SHALL update the displayed time every 60 seconds to reflect the current local time.
4. IF the device's local time or date cannot be retrieved, THEN THE Greeting_Panel SHALL display a placeholder indicating that the time and date are unavailable, and SHALL NOT display a stale or incorrect value.

---

### Requirement 2: Greeting Panel — Time-of-Day Greeting

**User Story:** As a user, I want the Dashboard to greet me based on the time of day, so that the experience feels personal and contextual.

#### Acceptance Criteria

1. WHEN the local hour is between 05:00 and 11:59 inclusive, THE Greeting_Panel SHALL display the greeting "Good Morning".
2. WHEN the local hour is between 12:00 and 17:59 inclusive, THE Greeting_Panel SHALL display the greeting "Good Afternoon".
3. WHEN the local hour is between 18:00 and 20:59 inclusive, THE Greeting_Panel SHALL display the greeting "Good Evening".
4. WHEN the local hour is between 21:00 and 04:59 (next day) inclusive, THE Greeting_Panel SHALL display the greeting "Good Night".
5. WHEN the User_Name has been saved, THE Greeting_Panel SHALL append the User_Name to the greeting message in the format "[Greeting], [User_Name]" (e.g., "Good Morning, Fatih"), where User_Name is truncated to 50 characters if longer.
6. WHEN the User_Name has not been saved or is empty, THE Greeting_Panel SHALL display only the greeting without a name suffix (e.g., "Good Morning").
7. WHILE the Dashboard is open, THE Greeting_Panel SHALL automatically update the greeting text when the local time crosses a period boundary (05:00, 12:00, 18:00, or 21:00) without requiring a page reload.

---

### Requirement 3: Custom Name in Greeting

**User Story:** As a user, I want to set my name in the Dashboard, so that the greeting addresses me personally.

#### Acceptance Criteria

1. THE Dashboard SHALL provide an input field for the User_Name that accepts between 1 and 50 characters.
2. WHEN the user submits a non-empty, non-whitespace-only User_Name, THE Dashboard SHALL save the User_Name to Local_Storage and display the updated User_Name in the Greeting_Panel without requiring a page reload.
3. WHEN the Dashboard loads and a User_Name exists in Local_Storage, THE Greeting_Panel SHALL retrieve and display the saved User_Name without requiring re-entry.
4. WHEN the user submits an empty or whitespace-only User_Name, THE Dashboard SHALL retain the previously saved User_Name, SHALL NOT overwrite Local_Storage, and SHALL display an error message indicating the name cannot be empty.
5. IF Local_Storage is unavailable or returns an error when saving the User_Name, THEN THE Dashboard SHALL display an error message indicating the name could not be saved and SHALL NOT update the displayed User_Name in the Greeting_Panel.

---

### Requirement 4: Focus Timer — Countdown Behavior

**User Story:** As a user, I want a 25-minute countdown timer, so that I can apply the Pomodoro technique to stay focused.

#### Acceptance Criteria

1. WHEN the Dashboard loads, THE Focus_Timer SHALL display an initial countdown value of 25 minutes and 00 seconds (25:00).
2. WHEN the user activates the Start control, THE Focus_Timer SHALL begin counting down in one-second intervals.
3. WHILE the Focus_Timer is counting down, THE Focus_Timer SHALL update the displayed time every second in MM:SS format, where MM is the remaining minutes (00–24) and SS is the remaining seconds (00–59).
4. WHEN the Focus_Timer countdown reaches 00:00, THE Focus_Timer SHALL stop counting and SHALL notify the user with a visible on-screen alert message and, where the browser grants audio permission, an audible signal lasting no more than 3 seconds.
5. WHEN the user activates the Stop control, THE Focus_Timer SHALL pause the countdown and retain the current remaining time displayed at the moment of activation.
6. WHEN the user activates the Reset control, THE Focus_Timer SHALL stop any active countdown and restore the displayed time to 25:00.
7. IF the user activates the Start control while the Focus_Timer is already counting down, THEN THE Focus_Timer SHALL ignore the activation and continue the current countdown without interruption.
8. IF the user activates the Stop control while the Focus_Timer is not counting down, THEN THE Focus_Timer SHALL ignore the activation and retain the currently displayed time without change.

---

### Requirement 5: Focus Timer — Controls

**User Story:** As a user, I want Start, Stop, and Reset controls on the timer, so that I can manage my focus sessions freely.

#### Acceptance Criteria

1. THE Focus_Timer SHALL display a Start control, a Stop control, and a Reset control simultaneously.
2. WHILE the Focus_Timer is counting down, THE Focus_Timer SHALL disable the Start control to prevent multiple concurrent countdowns.
3. WHILE the Focus_Timer is not counting down, THE Focus_Timer SHALL disable the Stop control.
4. WHEN the user activates the Start control, THE Focus_Timer SHALL begin counting down from the current configured duration.
5. WHEN the user activates the Stop control while the Focus_Timer is counting down, THE Focus_Timer SHALL pause the countdown and preserve the remaining time.
6. WHEN the user activates the Reset control, THE Focus_Timer SHALL stop the countdown and restore the displayed time to the configured session duration.

---

### Requirement 6: To-Do List — Task Creation

**User Story:** As a user, I want to add tasks to my to-do list, so that I can track what I need to accomplish.

#### Acceptance Criteria

1. THE Task_List SHALL provide an input field (accepting up to 200 characters) and a submission control for adding a new Task.
2. WHEN the user submits a non-empty task description, THE Task_List SHALL add the Task to the list with a default status of incomplete and save the updated Task_List to Local_Storage.
3. WHEN the user submits a task description that, after trimming whitespace and applying case-insensitive comparison, matches an existing Task in the Task_List (a Duplicate_Task), THE Task_List SHALL reject the submission and SHALL display an inline error message indicating the task already exists.
4. WHEN the user submits an empty or whitespace-only task description, THE Task_List SHALL reject the submission, SHALL NOT add a Task to the list, and SHALL display an inline error message.
5. WHEN a new Task is added successfully, THE Task_List SHALL clear the input field and dismiss any stale inline error messages.
6. IF Local_Storage is unavailable or the save operation fails when adding a Task, THEN THE Task_List SHALL display an error message indicating that the task could not be saved and SHALL NOT add the Task to the displayed list.

---

### Requirement 7: To-Do List — Task Editing

**User Story:** As a user, I want to edit existing tasks, so that I can correct or update task descriptions without deleting and re-adding them.

#### Acceptance Criteria

1. THE Task_List SHALL provide an Edit control for each Task.
2. WHEN the user activates the Edit control for a Task, THE Task_List SHALL replace the task description text with an editable input field (accepting up to 200 characters) pre-filled with the current task description, along with Save and Cancel controls.
3. WHEN the user activates the Save control or presses the Enter key while the edit field is focused, and the edited description is non-empty and does not match a Duplicate_Task, THE Task_List SHALL update the Task description, close the edit field, and save the updated Task_List to Local_Storage.
4. WHEN the user activates the Save control or presses the Enter key while the edit field is focused, and the edited description matches a Duplicate_Task (other than the Task being edited), THE Task_List SHALL reject the update, keep the edit field open, and display an inline error message.
5. WHEN the user activates the Save control or presses the Enter key while the edit field is focused, and the edited description is empty or whitespace-only, THE Task_List SHALL reject the update, keep the edit field open, and display an inline error message.
6. WHEN the user activates the Cancel control or presses the Escape key while the edit field is focused, THE Task_List SHALL discard all unsaved changes and restore the original task description text.

---

### Requirement 8: To-Do List — Task Completion and Deletion

**User Story:** As a user, I want to mark tasks as done and delete tasks, so that I can manage my list as I make progress.

#### Acceptance Criteria

1. THE Task_List SHALL provide a completion toggle control for each Task.
2. WHEN the user activates the completion toggle for an incomplete Task, THE Task_List SHALL mark the Task as complete, apply a strikethrough style to the task description text, and save the updated Task_List to Local_Storage within 500 milliseconds.
3. WHEN the user activates the completion toggle for a complete Task, THE Task_List SHALL mark the Task as incomplete, remove the strikethrough style from the task description text, and save the updated Task_List to Local_Storage within 500 milliseconds.
4. THE Task_List SHALL provide a Delete control for each Task.
5. WHEN the user activates the Delete control for a Task, THE Task_List SHALL remove that Task from the list, leave all other Tasks unchanged, and save the updated Task_List to Local_Storage.
6. IF the Local_Storage save operation fails during completion toggle or deletion, THEN THE Task_List SHALL display an error message and retain the previous visual state of the affected Task without persisting the change.

---

### Requirement 9: To-Do List — Persistence

**User Story:** As a user, I want my tasks to be saved automatically, so that my list is preserved when I close and reopen the browser.

#### Acceptance Criteria

1. WHEN the Dashboard loads and Task data exists in Local_Storage, THE Task_List SHALL retrieve and render all saved Tasks including their completion status, preserving the original order in which Tasks were saved.
2. WHEN the Dashboard loads and no Task data exists in Local_Storage, THE Task_List SHALL render an empty list with no Task items displayed.
3. WHEN any Task_List modification occurs (add, edit, complete, delete), THE Task_List SHALL persist the full updated Task_List to Local_Storage, and the UI SHALL reflect the change only after the persist operation completes successfully.
4. IF the persist operation to Local_Storage fails during any Task_List modification, THEN THE Task_List SHALL retain the previous Task_List state in the UI and display an error message indicating that the changes could not be saved.
5. IF Task data retrieved from Local_Storage is malformed or cannot be parsed, THEN THE Task_List SHALL discard the corrupted data, render an empty list, and display an error message indicating that saved tasks could not be loaded.

---

### Requirement 10: Quick Links — Link Management

**User Story:** As a user, I want to save and manage shortcut buttons to my favorite websites, so that I can open them quickly from the Dashboard.

#### Acceptance Criteria

1. THE Quick_Links component SHALL provide an input form with a label field accepting 1–50 characters and a URL field accepting 1–2048 characters for adding a new Link.
2. WHEN the user submits a new Link with a non-empty label of 1–50 characters and a URL that begins with `http://` or `https://` and is at most 2048 characters, THE Quick_Links component SHALL add the Link to the displayed collection and save the updated link collection to Local_Storage.
3. IF the user submits a new Link with an empty label, a label exceeding 50 characters, an empty URL, a URL that does not begin with `http://` or `https://`, or a URL exceeding 2048 characters, THEN THE Quick_Links component SHALL reject the submission without modifying Local_Storage and SHALL display an inline error message adjacent to the invalid field indicating the validation rule that was violated.
4. WHEN the user activates a Link button, THE Quick_Links component SHALL open the associated URL in a new browser tab without navigating away from the Dashboard.
5. THE Quick_Links component SHALL provide a Delete control for each rendered Link.
6. WHEN the user activates the Delete control for a Link, THE Quick_Links component SHALL remove that Link from the displayed collection and save the updated link collection to Local_Storage.
7. WHEN the Dashboard loads and a non-empty link collection exists in Local_Storage, THE Quick_Links component SHALL retrieve and render all saved Links within 500 milliseconds of the Dashboard becoming interactive.
8. WHEN the Dashboard loads and no link collection exists in Local_Storage, THE Quick_Links component SHALL render an empty link collection with the add-link form visible.

---

### Requirement 11: Light / Dark Mode

**User Story:** As a user, I want to toggle between light and dark display modes, so that I can choose a visual style that suits my environment and preference.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a Theme toggle control that is visible and interactable within every section of the page without scrolling or navigating away.
2. WHEN the user activates the Theme toggle, THE Dashboard SHALL switch the active Theme between `light` and `dark` and apply the corresponding color scheme to all Dashboard components within 300 milliseconds.
3. WHEN the user activates the Theme toggle, THE Dashboard SHALL update the toggle control's visual state to reflect the currently active Theme (`light` or `dark`).
4. WHEN the Theme is changed, THE Dashboard SHALL save the selected Theme value to Local_Storage under a dedicated Theme key, overwriting any previously stored value.
5. WHEN the Dashboard loads and a Theme value exists in Local_Storage, THE Dashboard SHALL apply the saved Theme to all components before the first visible render, without requiring user interaction.
6. WHEN the Dashboard loads and no Theme value exists in Local_Storage, THE Dashboard SHALL apply the `light` Theme as the default and save `light` to Local_Storage.
7. IF Local_Storage is unavailable or read fails during Dashboard load, THEN THE Dashboard SHALL apply the `light` Theme as the fallback and continue loading without displaying an error to the user.

---

### Requirement 12: File and Code Structure

**User Story:** As a developer, I want a clean, single-file-per-type structure, so that the codebase is easy to maintain and understand.

#### Acceptance Criteria

1. THE Dashboard SHALL be structured with exactly one HTML file at the project root as the entry point, and that HTML file SHALL reference all CSS and JavaScript assets using relative paths.
2. THE Dashboard SHALL contain exactly one CSS file located inside a `css/` directory; all visual styling SHALL reside in this file with no inline styles or `<style>` blocks in the HTML.
3. THE Dashboard SHALL contain exactly one JavaScript file located inside a `js/` directory; all interactivity SHALL reside in this file with no inline event handlers or `<script>` blocks in the HTML.
4. THE Dashboard SHALL implement all interactivity using Vanilla JavaScript with no external JavaScript frameworks or libraries, verifiable by the absence of third-party `<script src>` tags or module imports.
5. THE Dashboard SHALL require no backend server and SHALL function entirely when opened via a `file://` URI, making no network requests to a backend runtime.
6. IF a required asset file (CSS or JS) is missing or fails to load, THEN THE Dashboard SHALL degrade gracefully by displaying the core HTML structure without crashing or displaying an unhandled error to the user.
