# CLI Reference

## Usage

```bash
node src/codex-usage.js [--minutes 15] [--from-date date] [--from-minutes minutes] [--to-date date] [--to-minutes minutes] [--scope events|sessions] [--in-scope] [--max-events count] [--max-sessions count] [--max-files count] [--max-turns count] [--max-models count] [--codex-home /home/codex/.codex] [--data-path /tmp/codex-usage] [--format text|json|html] [--out path] [--styles light|dark|path] [--interval seconds] [--force-refresh] [--save-history] [--history path]
```

Use `--help` or `-h` to print command help.

## Options

| Option            | Value                     | Default                                                     | Description                                                                                                                                                                                                                                                     |
| ----------------- | ------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--minutes`       | Positive integer minutes  | `15`                                                        | Selects a rolling report window. This is shorthand for `--from-minutes N` with no explicit ending period.                                                                                                                                                       |
| `--from-date`     | Date or datetime          | Disabled                                                    | Selects the inclusive start of the report range. Local datetime values without an offset are evaluated in local runtime time. Month/day values without a year infer the current or prior year.                                                                  |
| `--from-minutes`  | Positive integer minutes  | Disabled                                                    | Selects the inclusive start of the report range as `now - from-minutes`.                                                                                                                                                                                        |
| `--to-date`       | Date or datetime          | Disabled                                                    | Selects the exclusive end of the report range. Requires a from option. Month/day values without a year infer the current or prior year.                                                                                                                         |
| `--to-minutes`    | Positive integer minutes  | Disabled                                                    | Selects the exclusive end of the report range as `now - to-minutes`. Requires a from option.                                                                                                                                                                    |
| `--scope`         | `events` or `sessions`    | `RANGE_SCOPE` from `.env`, or `events`                      | Selects whether range matching is based on event timestamps or whole-session timestamps.                                                                                                                                                                        |
| `--in-scope`      | Flag                      | `IN_SCOPE` from `.env`, or `false`                          | Only includes sessions that are fully contained within the selected range.                                                                                                                                                                                      |
| `--max-events`    | Positive integer, or `0`  | `MAX_EVENTS` from `.env`, or `500`                          | Maximum events allowed in any generated detail table. Use `0` for unlimited.                                                                                                                                                                                    |
| `--max-sessions`  | Positive integer, or `0`  | `MAX_SESSIONS` from `.env`, or `500`                        | Maximum sessions allowed in any generated table or expandable table section. Use `0` for unlimited.                                                                                                                                                             |
| `--max-files`     | Positive integer, or `0`  | `MAX_FILES` from `.env`, or `0`                             | Maximum session JSONL files allowed after file scanning. Use `0` for unlimited.                                                                                                                                                                                 |
| `--max-turns`     | Positive integer, or `0`  | `MAX_TURNS` from `.env`, or `0`                             | Maximum unique session turns allowed in any generated detail table. Use `0` for unlimited.                                                                                                                                                                      |
| `--max-models`    | Positive integer, or `0`  | `MAX_MODELS` from `.env`, or `0`                            | Maximum model groups allowed in generated grouped tables. Use `0` for unlimited.                                                                                                                                                                                |
| `--codex-home`    | Folder path               | `CODEX_HOME` from `.env`, or current user's `.codex` folder | Selects the Codex home folder to scan for session JSONL files.                                                                                                                                                                                                  |
| `--data-path`     | Folder path               | `DATA_PATH` from `.env`, or `/tmp/codex-usage`              | Overrides `DATA_PATH` for app-managed data files, including the default local history file. First-run Windows `.env` creation uses `C:\Temp\codex-usage`.                                                                                                       |
| `--format`        | `text`, `json`, or `html` | `text`                                                      | Selects the output renderer.                                                                                                                                                                                                                                    |
| `--out`           | File path                 | Standard output                                             | Writes the rendered report to a file. Filename-only values are written under `DATA_PATH`; paths such as `./report.html` or `/tmp/report.html` are used directly.                                                                                                |
| `--styles`        | `light`, `dark`, or path  | `STYLES` from `.env`, or `styles-dark-01.css`               | Selects the HTML report theme CSS file. `--style` is a synonym. `--styles light` uses `styles-light-01.css`; `--styles dark` uses `styles-dark-01.css`. Filename-only values read from `src/html`; extensionless filenames add `.css`; paths are used directly. |
| `--interval`      | Positive integer seconds  | Disabled                                                    | Regenerates the report repeatedly. Requires `--out` so each run has a destination file.                                                                                                                                                                         |
| `--force-refresh` | Flag                      | Disabled                                                    | For HTML interval output, embeds a browser refresh timer of `interval - 2` seconds and adds a Refresh control for toggling browser auto-refresh off and on. Requires `--format html`, `--interval`, and an interval of at least 3 seconds.                      |
| `--save-history`  | Flag                      | Disabled                                                    | Appends a compact JSONL history snapshot to `history.jsonl` under `DATA_PATH`.                                                                                                                                                                                  |
| `--history`       | File path                 | `DATA_PATH/history.jsonl` when history is saved             | Appends history and enables history capture. Filename-only values are written under `DATA_PATH`; paths such as `./history.jsonl` or `/tmp/history.jsonl` are used directly.                                                                                     |
| `--help`, `-h`    | Flag                      | Disabled                                                    | Prints command usage and exits.                                                                                                                                                                                                                                 |

## Range Selection

The command normalizes range options before session files are parsed:

- `fromDate` is inclusive.
- `toDate` is exclusive.
- A from option without a to option uses the current run time as the end of the range.
- In interval mode, each interval run captures a fresh current time.

`--minutes N` remains available as the rolling-window shorthand for `--from-minutes N`.

Date values can be full dates, datetimes, or short month/day values. Short values such as `5/11` and `5-11` are interpreted at local midnight. The year defaults to the current year unless that month/day is after the current date, in which case the prior year is used. For example, when the current date is May 14, 2026, `5/11` means May 11, 2026, and `7/8` means July 8, 2025.

Valid combinations:

| From option      | To option      | Handling                                                            |
| ---------------- | -------------- | ------------------------------------------------------------------- |
| none             | none           | Uses `--minutes 15`: `fromDate = now - 15 minutes`, `toDate = now`. |
| `--minutes`      | none           | `fromDate = now - minutes`, `toDate = now`.                         |
| `--from-date`    | none           | `fromDate = parsed from-date`, `toDate = now`.                      |
| `--from-minutes` | none           | `fromDate = now - from-minutes`, `toDate = now`.                    |
| `--from-date`    | `--to-date`    | Parses both dates directly.                                         |
| `--from-date`    | `--to-minutes` | `toDate = now - to-minutes`.                                        |
| `--from-minutes` | `--to-minutes` | `fromDate = now - from-minutes`, `toDate = now - to-minutes`.       |

`--scope events` includes individual usage events whose timestamps are inside the range. Session totals are computed from included events only.

`--scope sessions` includes whole sessions whose session timestamp range intersects the report range. Included sessions contribute all of their usage events to report totals.

`--in-scope` keeps only sessions whose first and last usage event timestamps are fully inside the report range. With `--scope events`, a session that is not fully in scope is removed even when some of its events match the range.

## Configuration

The command reads `.env` from the project root. When `.env` is not present, the command copies `.env.example` to `.env` before reading settings. `.env.example` contains the supported configuration values:

```bash
DATA_PATH=/tmp/codex-usage
DATA_PATH_WINDOWS_DEFAULT=C:\Temp\codex-usage
CODEX_HOME=
STYLES=styles-dark-01.css
DATETIME_FORMAT=MMM D, h:mm AP
RANGE_SCOPE=events
IN_SCOPE=false
MAX_EVENTS=500
MAX_SESSIONS=500
MAX_FILES=0
MAX_TURNS=0
MAX_MODELS=0
```

`DATA_PATH` is the base folder for app-managed data and is created when the command starts. When `.env` is created on Windows, `DATA_PATH_WINDOWS_DEFAULT` is copied to `DATA_PATH`. Filename-only `--out` and `--history` values are written under `DATA_PATH`; use a path such as `./report.html` to write to the current folder. Use `--data-path` to override `DATA_PATH` for a single run.

`CODEX_HOME` selects the Codex home folder to scan. Leave it empty to use the current user's `.codex` folder. If the configured value does not include `.codex`, the command appends `.codex`. Use `--codex-home` to override `CODEX_HOME` for a single run.

`STYLES` selects the theme CSS file for HTML reports. Filename-only values are read from `src/html`; use a path such as `./report-styles.css` to read from the current folder. The selected theme CSS is embedded before the shared report rules from `src/html/styles-common.css`. Use `--styles` or `--style` to override `STYLES` for a single run.

`DATETIME_FORMAT` is available as an `.env` value.

`RANGE_SCOPE`, `IN_SCOPE`, `MAX_EVENTS`, `MAX_SESSIONS`, `MAX_FILES`, `MAX_TURNS`, and `MAX_MODELS` provide defaults for range scope, complete-session filtering, and detail table limits. CLI options override these settings for a single run.

Windows drive paths are supported in `.env` and CLI options. Quotes are required when a path contains spaces:

```bash
DATA_PATH="C:\Users\example\Codex Usage"
CODEX_HOME="C:\Users\example"
```

## Validation

- `--minutes` must be a positive integer.
- `--from-minutes` and `--to-minutes` must be positive integers.
- `--from-date` and `--to-date` must parse as valid dates.
- `--from-date` and `--from-minutes` cannot be combined.
- `--to-date` and `--to-minutes` cannot be combined.
- `--to-date` or `--to-minutes` requires a from option.
- `--from-minutes` cannot be combined with `--to-date`.
- `--minutes` cannot be combined with explicit range options.
- The normalized from time must be earlier than the normalized to time.
- `--scope` must be `events` or `sessions`.
- `IN_SCOPE` must be one of `true`, `false`, `1`, `0`, `yes`, or `no`.
- Detail limit CLI options and `.env` values must be positive integers or `0`.
- `--format` must be `text`, `json`, or `html`.
- `--interval` must be a positive integer number of seconds.
- `--interval` requires `--out`.
- `--force-refresh` requires `--format html`.
- `--force-refresh` requires `--interval`.
- `--force-refresh` requires an interval of at least 3 seconds.
- Invalid OS paths for output folders result in a runtime error and no output is generated.
- Inaccessible stylesheet files result in a runtime error and no output is generated.
- Reports fail before rendering when any generated event detail table would include more than `--max-events` events, unless the limit is `0`.
- Reports fail before rendering when any generated session table would include more than `--max-sessions` sessions, unless the limit is `0`.
- Reports fail before parsing when the session file scan finds more than `--max-files` files, unless the limit is `0`.
- Reports fail before rendering when generated model or turn details exceed `--max-models` or `--max-turns`, unless the relevant limit is `0`.

## Examples

Run the default text report:

```bash
node src/codex-usage.js
```

Use a different Codex home folder:

```bash
node src/codex-usage.js --codex-home /home/codex/.codex
```

Render JSON to standard output:

```bash
node src/codex-usage.js --minutes 15 --format json
```

Use an absolute bounded range:

```bash
node src/codex-usage.js --from-date 2026-05-14T09:00:00 --to-date 2026-05-14T10:00:00
```

Use short month/day dates:

```bash
node src/codex-usage.js --from-date 5/11 --to-date 5/12
```

Use a relative historical range:

```bash
node src/codex-usage.js --from-minutes 500 --to-minutes 200
```

Only include complete sessions inside a range:

```bash
node src/codex-usage.js --from-minutes 500 --to-minutes 200 --in-scope
```

Select whole sessions that intersect a range:

```bash
node src/codex-usage.js --from-date 2026-05-14T09:00:00 --to-date 2026-05-14T17:00:00 --scope sessions
```

Write a standalone browser report under `DATA_PATH`:

```bash
node src/codex-usage.js --minutes 15 --format html --out codex-usage.html
```

Write a standalone browser report to the current folder:

```bash
node src/codex-usage.js --minutes 15 --format html --out ./codex-usage.html
```

Write a standalone browser report to another explicit path:

```bash
node src/codex-usage.js --minutes 15 --format html --out /tmp/reports/codex-usage.html
```

Regenerate a browser report every 10 seconds until a terminal keypress stops the loop at the next interval:

```bash
node src/codex-usage.js --minutes 15 --format html --out codex-usage.html --interval 10
```

Regenerate a browser report and make the open page refresh itself:

```bash
node src/codex-usage.js --minutes 15 --format html --out codex-usage.html --interval 10 --force-refresh
```

The generated page includes a Refresh button above the report content. Use it to pause browser reloads while inspecting the current data, then resume browser reloads when live updates are wanted again.

Append a compact local history snapshot:

```bash
node src/codex-usage.js --minutes 60 --save-history
```

Write history to an explicit path:

```bash
node src/codex-usage.js --minutes 60 --history /tmp/codex-usage-history.jsonl
```

Override `DATA_PATH` for one run:

```bash
node src/codex-usage.js --minutes 60 --save-history --data-path /tmp/codex-usage
```

Use Windows paths for one run:

```bash
node src/codex-usage.js --minutes 60 --save-history --data-path "C:\Users\example\Codex Usage" --codex-home "C:\Users\example"
```
