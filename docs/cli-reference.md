# CLI Reference

## Usage

```bash
node src/codex-usage.js [--minutes 15] [--codex-home /home/codex/.codex] [--format text|json|html] [--out path] [--interval seconds] [--force-refresh] [--save-history] [--history path]
```

Use `--help` or `-h` to print command help.

## Options

| Option            | Value                     | Default                                                           | Description                                                                                                                                                        |
| ----------------- | ------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--minutes`       | Positive integer minutes  | `15`                                                              | Selects the report window. The command includes usage events from the previous N minutes.                                                                          |
| `--codex-home`    | Folder path               | Current user's `.codex` folder                                    | Selects the Codex home folder to scan for session JSONL files.                                                                                                     |
| `--format`        | `text`, `json`, or `html` | `text`                                                            | Selects the output renderer.                                                                                                                                       |
| `--out`           | File path                 | Standard output                                                   | Writes the rendered report to a file instead of standard output.                                                                                                   |
| `--interval`      | Positive integer seconds  | Disabled                                                          | Regenerates the report repeatedly. Requires `--out` so each run has a destination file.                                                                            |
| `--force-refresh` | Flag                      | Disabled                                                          | For HTML interval output, embeds a browser refresh timer of `interval - 2` seconds. Requires `--format html`, `--interval`, and an interval of at least 3 seconds. |
| `--save-history`  | Flag                      | Disabled                                                          | Appends a compact JSONL history snapshot to `/opt/codex/data/codex-usage/history.jsonl`.                                                                           |
| `--history`       | File path                 | `/opt/codex/data/codex-usage/history.jsonl` when history is saved | Appends history to a specific path and enables history capture.                                                                                                    |
| `--help`, `-h`    | Flag                      | Disabled                                                          | Prints command usage and exits.                                                                                                                                    |

## Validation

- `--minutes` must be a positive integer.
- `--format` must be `text`, `json`, or `html`.
- `--interval` must be a positive integer number of seconds.
- `--interval` requires `--out`.
- `--force-refresh` requires `--format html`.
- `--force-refresh` requires `--interval`.
- `--force-refresh` requires an interval of at least 3 seconds.

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

Write a standalone browser report:

```bash
node src/codex-usage.js --minutes 15 --format html --out codex-usage.html
```

Regenerate a browser report every 10 seconds until a terminal keypress stops the loop at the next interval:

```bash
node src/codex-usage.js --minutes 15 --format html --out codex-usage.html --interval 10
```

Regenerate a browser report and make the open page refresh itself:

```bash
node src/codex-usage.js --minutes 15 --format html --out codex-usage.html --interval 10 --force-refresh
```

Append a compact local history snapshot:

```bash
node src/codex-usage.js --minutes 60 --save-history
```

Write history to an explicit path:

```bash
node src/codex-usage.js --minutes 60 --history /tmp/codex-usage-history.jsonl
```
