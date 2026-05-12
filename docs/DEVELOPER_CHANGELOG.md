# Developer Changelog

These are details about other changes, and trivial details that don't warrant a changelog entry. This is optional and for-reference-only reading.

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
