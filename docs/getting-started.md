# Getting Started

## Purpose

`codex-usage` reports local Codex token usage from Codex session JSONL files. It is read-only for Codex session data: it scans session files, builds a structured report, and writes output to standard output or a file that you choose.

## Requirements

- Node.js 22 or newer.
- A Codex home folder that contains `sessions` or `archived_sessions`.
- Permission to read the Codex session files being scanned.

The direct CLI entry point uses only Node.js built-in modules.

## Configuration

Copy `.env.example` to `.env` if the file is not present, then set `DATA_PATH` to the folder used for app-managed data files:

```bash
DATA_PATH=/tmp
```

History capture uses this folder when `--history` is not provided. Use `--data-path` to override `DATA_PATH` for a single run.

## First Run

From the project root, run:

```bash
node src/codex-usage.js
```

The default report scans the current user's Codex home folder and shows usage from the previous 15 minutes in text format.

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

HTML output writes a standalone browser dashboard when used with `--out`. The default path for output is the current project folder, not DATA_PATH. Specify a folder path if desired:

```bash
node src/codex-usage.js --format html --out codex-usage.html
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

The default history file is `data/codex-usage/history.jsonl` under `DATA_PATH`. Use `--history` to choose another path:

```bash
node src/codex-usage.js --minutes 60 --history /tmp/codex-usage-history.jsonl
```

Use `--data-path` to choose the configured data folder for one run:

```bash
node src/codex-usage.js --minutes 60 --save-history --data-path /tmp/codex-usage
```

## Next Reading

- [CLI reference](./cli-reference.md) documents every option, default, and constraint.
- [Usage analytics report](./analytics-report.md) explains every report section and metric.
- [Implementation details](./details.md) describes how files are parsed and normalized.
