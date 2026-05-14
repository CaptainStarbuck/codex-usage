# CLI Reference

## Usage

```bash
node src/codex-usage.js [--minutes 15] [--codex-home /home/codex/.codex] [--data-path /tmp/codex-usage] [--format text|json|html] [--out path] [--styles light|dark|path] [--interval seconds] [--force-refresh] [--save-history] [--history path]
```

Use `--help` or `-h` to print command help.

## Options

| Option            | Value                     | Default                                                     | Description                                                                                                                                                                                                                                                     |
| ----------------- | ------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--minutes`       | Positive integer minutes  | `15`                                                        | Selects the report window. The command includes usage events from the previous N minutes.                                                                                                                                                                       |
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

## Configuration

The command reads `.env` from the project root. When `.env` is not present, the command copies `.env.example` to `.env` before reading settings. `.env.example` contains the supported configuration values:

```bash
DATA_PATH=/tmp/codex-usage
DATA_PATH_WINDOWS_DEFAULT=C:\Temp\codex-usage
CODEX_HOME=
STYLES=styles-dark-01.css
DATETIME_FORMAT=MMM D, h:mm AP
```

`DATA_PATH` is the base folder for app-managed data and is created when the command starts. When `.env` is created on Windows, `DATA_PATH_WINDOWS_DEFAULT` is copied to `DATA_PATH`. Filename-only `--out` and `--history` values are written under `DATA_PATH`; use a path such as `./report.html` to write to the current folder. Use `--data-path` to override `DATA_PATH` for a single run.

`CODEX_HOME` selects the Codex home folder to scan. Leave it empty to use the current user's `.codex` folder. If the configured value does not include `.codex`, the command appends `.codex`. Use `--codex-home` to override `CODEX_HOME` for a single run.

`STYLES` selects the theme CSS file for HTML reports. Filename-only values are read from `src/html`; use a path such as `./report-styles.css` to read from the current folder. The selected theme CSS is embedded before the shared report rules from `src/html/styles-common.css`. Use `--styles` or `--style` to override `STYLES` for a single run.

`DATETIME_FORMAT` is available as an `.env` value.

Windows drive paths are supported in `.env` and CLI options. Quotes are required when a path contains spaces:

```bash
DATA_PATH="C:\Users\example\Codex Usage"
CODEX_HOME="C:\Users\example"
```

## Validation

- `--minutes` must be a positive integer.
- `--format` must be `text`, `json`, or `html`.
- `--interval` must be a positive integer number of seconds.
- `--interval` requires `--out`.
- `--force-refresh` requires `--format html`.
- `--force-refresh` requires `--interval`.
- `--force-refresh` requires an interval of at least 3 seconds.
- Invalid OS paths for output folders result in a runtime error and no output is generated.
- Inaccessible stylesheet files result in a runtime error and no output is generated.

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
