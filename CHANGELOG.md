# Changelog

These are functional changes to the package, worthy of note to users.  
More details for developers are provided in `docs/DEVELOPER_CHANGELOG.md`.

### 2026-05-12 / v1.1.1

- Dynamic HTML report styling, currently with two available files, one light and one dark.
- Added the `DATETIME_FORMAT` `.env` value, now used to standardize the output format of all date/time values in the HTML report. See `docs/datetime.md`.
- Models and Events tables use user-friendly column headers and fit columns to the available report width.
- Top Events cards display the session on its own line above the event metric columns.

### 2026-05-11 / v1.1.0

Summary: This is a roll-up from 1.0.x.

- Windows is now supported.
- Output is no longer hardcoded to specific folders.
- .env is auto-generated and now defaults write operations under `/tmp/codex-usage`.
- CLI overrides allow runtime overrides.
- Documentation has been cleaned up a bit.
- Filename-only output and history paths now write under `DATA_PATH`.

### 2026-05-11 / v1.0.5

#### Enhanced

- Support for Windows: Added Windows-compatible path handling for configured folders, CLI paths, and package linking.
- Added MIT License file.
- Significant refactoring of report-html.js into smaller maintainable modules.
- The command creates `.env` from `.env.example` when `.env` is not present.
- First-run `.env` creation uses `C:\Temp\codex-usage` as `DATA_PATH` on Windows.
- `--out` path handling now uses `DATA_PATH` for filename-only values and direct paths when a folder is included.
- The default history file now writes directly under `DATA_PATH`.

#### Fixed

- Output generation stops with a runtime error when an output folder path is formatted for the wrong OS.

### 2026-05-11 / v1.0.4

#### Enhanced

- Added `CODEX_HOME` configuration for the default Codex session folder.

### 2026-05-11 / v1.0.3

#### Enhanced

- Added `--data-path` to override `DATA_PATH` for a single run.
- Trimmed README to essentials, now refers to `docs/getting-started.md` for details.

### 2026-05-11 / v1.0.2

#### Enhanced

- Added .env.example with `DATA_PATH=/tmp/codex-usage` configuration for the default local history storage location. Copy to .env and modify.
- Added DEVELOPER_CHANGELOG.md to docs and index.

### 2026-05-11 / v1.0.1

#### Changed

- Removed the fixed workspace allow-list for history output paths.

### 2026-04-27 / v1.0.0

#### Changed

- Updated development dependencies to current available releases.
- Moved current PNPM install policy to workspace configuration.
- Corrected project configuration comment typography.
- Prep for v1.0.0

#### Enhanced

- Added newcomer docs

#### Fixed

-
