# Getting Started

## Purpose

`codex-usage` reports local Codex token usage from Codex session JSONL files. It is read-only for Codex session data: it scans session files, builds a structured report, and writes output to standard output or a file that you choose.

## Requirements

- Node.js 22 or newer.
- A Codex home folder that contains `sessions` or `archived_sessions`.
- Permission to read the Codex session files being scanned.

The direct CLI entry point uses only Node.js built-in modules.

## Configuration

The command creates `.env` from `.env.example` when `.env` is not present. Set local folder preferences in `.env`:

```bash
DATA_PATH=/tmp/codex-usage
DATA_PATH_WINDOWS_DEFAULT=C:\Temp\codex-usage
CODEX_HOME=
```

Output and history filenames use `DATA_PATH` when no folder path is included. The configured `DATA_PATH` folder is created when the command starts. When `.env` is created on Windows, `DATA_PATH_WINDOWS_DEFAULT` is copied to `DATA_PATH` so the default data folder is `C:\Temp\codex-usage`. Codex sessions are read from the current user's `.codex` folder when `CODEX_HOME` is empty. When `CODEX_HOME` is set to a folder that does not include `.codex`, the command appends `.codex`. Use `--data-path` or `--codex-home` to override these settings for a single run.

Windows drive paths can be used in `.env`. Quote paths that contain spaces:

```bash
DATA_PATH="C:\Users\example\Codex Usage"
CODEX_HOME="C:\Users\example"
```

## First Run

From the project root, run:

```bash
node src/codex-usage.js
```

The default report scans the configured Codex home folder and shows usage from the previous 15 minutes in text format.

## Choose A Time Window

Use `--minutes` to choose a rolling time window:

```bash
node src/codex-usage.js --minutes 60
```

The report includes token usage events whose timestamps fall inside the selected window of the previous N minutes. Quota snapshots may come from the selected window or from the latest earlier snapshot found in scanned files.

## Choose An Output Format

Text output is designed for terminals. JSON output emits the structured report object:

```bash
node src/codex-usage.js --format text
node src/codex-usage.js --format json
```

HTML output writes a standalone browser dashboard when used with `--out`. A filename-only value is written under `DATA_PATH`; use `./filename` to write to the current folder:

```bash
node src/codex-usage.js --format html --out codex-usage.html
node src/codex-usage.js --format html --out ./codex-usage.html
```

Open the generated HTML file in a browser to review quota cards, summary cards, warnings, timeline, top sessions, top events, model summaries, and the sortable Events table.

## Keep A Browser Report Current

Use interval mode to regenerate an output file every N seconds:

```bash
node src/codex-usage.js --minutes 15 --format html --out codex-usage.html --interval 10
```

Add `--force-refresh` so the generated HTML asks the browser to reload shortly before the next file update:

```bash
node src/codex-usage.js --minutes 15 --format html --out codex-usage.html --interval 10 --force-refresh
```

Any terminal keypress causes interval mode to stop at the next interval boundary.

## Save Data Snapshot to Local History

History capture appends one compact JSON object per run:

```bash
node src/codex-usage.js --minutes 60 --save-history
```

The default history file is `history.jsonl` under `DATA_PATH`. Filename-only `--history` values are also written under `DATA_PATH`; use `./history.jsonl` to write to the current folder:

```bash
node src/codex-usage.js --minutes 60 --history /tmp/codex-usage-history.jsonl
node src/codex-usage.js --minutes 60 --history ./history.jsonl
```

Use `--data-path` to choose the configured data folder for one run:

```bash
node src/codex-usage.js --minutes 60 --save-history --data-path /tmp/codex-usage
```

On Windows, quote CLI paths that contain spaces:

```bash
node src/codex-usage.js --minutes 60 --save-history --data-path "C:\Users\example\Codex Usage" --codex-home "C:\Users\example"
```

## Next Reading

- [CLI reference](./cli-reference.md) documents every option, default, and constraint.
- [Usage analytics report](./analytics-report.md) explains every report section and metric.
- [Implementation details](./details.md) describes how files are parsed and normalized.
