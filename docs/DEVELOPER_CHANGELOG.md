# Developer Changelog

These are details about other changes, and trivial details that don't warrant a changelog entry. This is optional and for-reference-only reading.

### 2026-05-11 / v1.0.5

#### Enhanced

- Added path helpers that preserve Windows drive, UNC, and backslash semantics for configured file and folder paths.
- Updated configured path joins and path display helpers to use OS-aware path handling.
- Changed the package `bin` entry from an absolute workspace path to a relative executable path.
- Refactored runtime report generation, renderer selection, history writing, and interval loop handling out of `src/codex-usage.js` into focused modules.

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
