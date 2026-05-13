# Developer Changelog

These are details about other changes, and trivial details that don't warrant a changelog entry. This is optional and for-reference-only reading.

### 2026-05-13 / v1.1.2

#### Changed

- Changed the HTML Models section to render as By Model, grouping browser-side report rows by model and intelligence level.
- Added nested event tables under each By Model group and omitted repeated model and intelligence columns from the nested rows.
- Added nested table styling across the default, light, and dark HTML stylesheets.
- Added browser localStorage persistence for By Model expanded row state.
- Updated analytics and implementation docs for the By Model report layout.
- Added browser-side session reference formatting and a Session Paths card to keep full source file paths available in HTML reports.
- Added reusable HTML table column classes and column sizing hints for numeric header alignment, compact Turn Index display, and combined Events model and intelligence values.
- Reduced duplicated report reference content in `docs/details.md` and routed detailed report behavior to `docs/analytics-report.md`.
- Reduced duplicated configuration reference content in `docs/getting-started.md` and routed detailed option behavior to the CLI and datetime docs.
- Temporarily commented out the HTML Top Sessions and Top Events dashboard markup and render calls.
- Removed Raw Total Tokens from the By Model summary columns, moved Input Tokens into Events table main rows, relabeled observed event volume as Total Tokens in Events, and reduced Events detail rows to a Detail header.
- Removed the Sessions column from collapsed By Model rows and added compact `hash/turn` formatting for event Session columns.
- Removed the dedicated Turn Index column from Events and expanded By Model event tables while retaining turn index in compact Session values.
- Moved the HTML Warnings and Insights placeholder below the Session Paths section.

### 2026-05-12 / v1.1.1

#### Enhanced

- Added HTML stylesheet selection through `STYLES`, `--styles`, and the `--style` synonym.
- Added stylesheet path resolution for aliases, extensionless filenames, `src/html` filename defaults, direct paths, OS path validation, and read-access errors.
- Added `src/html/styles-light-01.css` and `src/html/styles-dark-01.css` as selectable report styles.

#### Changed

- Routed HTML rendering through a runtime `stylesPath` option instead of reading one fixed stylesheet in the renderer.
- Changed Models and Events table headers to common-cased field labels and adjusted report table layout to size columns against available panel width.

### 2026-05-11 / v1.0.5

#### Enhanced

- Added path helpers that preserve Windows drive, UNC, and backslash semantics for configured file and folder paths.
- Updated configured path joins and path display helpers to use OS-aware path handling.
- Changed the package `bin` entry from an absolute workspace path to a relative executable path.
- Refactored runtime report generation, renderer selection, history writing, and interval loop handling out of `src/codex-usage.js` into focused modules.
- Updated `renderHtmlReport()` to assemble the standalone dashboard from `src/html` template, CSS, and browser script assets.
- Added `.env` creation from `.env.example` inside the dotenv loader when the local file is missing.
- Added `DATA_PATH_WINDOWS_DEFAULT` and platform-aware `.env` template preparation so Windows first-run data storage defaults to `C:\Temp\codex-usage`.
- Changed managed output path handling so filename-only `--out` values write under `DATA_PATH`, while values with a folder path are used directly.
- Changed default app-managed history writes to use `DATA_PATH/history.jsonl` directly.

#### Changed

- Moved aggregate.md to docs to avoid Codex wanting to modify it.
- Moved README source file summaries into docs/details.md and removed the duplicate README project file section.

#### Fixed

- Added runtime write-destination validation so Windows volume and UNC output paths are rejected outside Windows before any directory or file write occurs.
- Added Windows output path normalization so valid drive and UNC output paths convert forward slashes to backslashes before writes.
- Routed `DATA_PATH`, `--out`, and history destinations through OS-aware output path validation.

### 2026-05-11 / v1.0.4

#### Enhanced

- Added `CODEX_HOME` parsing to the dotenv environment loader, including default fallback and `.codex` suffix normalization.

### 2026-05-11 / v1.0.3

#### Enhanced

- Added CLI parsing and documentation for `--data-path`, with CLI values taking precedence over `.env` and process `DATA_PATH` values.
-

### 2026-05-11 / v1.0.2

#### Changed

- In README.md, moved screenshots out of collapsed detail/summary sections so that people can see them without having to click.

#### Enhanced

- Added dotenv-style `DATA_PATH` loading and routed default history writes through the configured data folder. No dependency, dotenv is not required.

### 2026-05-11 / v1.0.1

#### Changed

- Removed `ALLOWED_WORKSPACE_ROOTS` and the history path allow-list validation from the CLI. This was an initial development restriction that prevented codex from writing outside of a system-specific sandbox. It's not necessary with the new DATA_PATH.
- Updated the source aggregate and history path documentation for unrestricted explicit history destinations.
