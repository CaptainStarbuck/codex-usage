# codex-usage details

## Data Source

The command reads local Codex JSONL session files from `sessions` and `archived_sessions` under the configured Codex home. A different Codex home can be provided with `--codex-home`.

## Usage Events

Token consumption is read from JSONL records where `type` is `event_msg` and `payload.type` is `token_count`. The report uses `payload.info.last_token_usage` for events in the selected time window only when `payload.info.total_token_usage` advances within the session. Rate limit status events can repeat a previous nonzero `last_token_usage`, so repeated cumulative totals are treated as quota updates rather than additional token usage.

## Quota Snapshots

Account quota information is read from non-null `payload.rate_limits` objects on `token_count` events. The parser attaches the event timestamp, source JSONL file, and session id derived from the rollout filename to each snapshot. The report displays the latest snapshot inside the selected window, or the latest earlier snapshot found in the scanned files.

The quota report normalizes primary and secondary windows with `remaining_percent = 100 - used_percent`, clamped to `0` through `100`. A `300` minute window is labeled `5h limit`, and a `10080` minute window is labeled `7d limit`. Other windows are labeled `Primary limit` or `Secondary limit`. `resets_at` is kept as a Unix timestamp in seconds and also rendered as a local display string.

Credits are displayed when present in `payload.rate_limits.credits`. Unlimited credits are shown as `Credits: unlimited`; otherwise a provided balance is rounded for display.

## Model Metadata

The parser reads `turn_context` records for `model` and `effort`. If a session file does not include those fields, the parser falls back to `config.toml` values for `model` and `model_reasoning_effort`. Missing values are printed as `unknown`.

## Totals

The structured report keeps Codex-provided raw totals separate from derived aggregate display values. It sums each raw token column independently:

- `input_tokens`
- `cached_input_tokens`
- `output_tokens`
- `reasoning_output_tokens`
- `raw_total_tokens`

The report also computes derived metrics:

- `observed_token_volume = input_tokens + output_tokens`
- `effective_input_tokens = input_tokens - cached_input_tokens`
- `visible_output_tokens = output_tokens - reasoning_output_tokens`
- `cache_hit_rate = cached_input_tokens / input_tokens`
- `reasoning_output_rate = reasoning_output_tokens / output_tokens`

Rate calculations use zero when the denominator is zero or unavailable.

## Insights

Insights include no-event windows, unavailable quota data, stale quota snapshots, multiple active sessions, unknown model metadata, unknown intelligence metadata, low cache hit rate for large input events, events over 100k observed token volume, model or intelligence changes inside a session, and ignored duplicate token count events.

## Output Formats

The command supports `--format text|json|html`. The default `text` format preserves the fixed-width event table and includes a corrected summary section. The `json` format emits the structured report object. The `html` format emits a standalone static browser dashboard and can be written with `--out`. Filename-only output values are written under `DATA_PATH`; output values with a folder path are used directly.

The browser dashboard includes quota cards, summary cards, a stacked SVG timeline, warnings and notices, top sessions, top events, model-level summaries, collapsible event details, and a session path reference card. HTML report styling is read from the configured CSS file. Filename-only style values are read from `src/html`; values with a folder path are used directly.

The By Model table groups event rows by model and intelligence level. Each primary row summarizes token totals for one model and level, using a Model value such as `gpt-5.5/low`. Rows are sorted by ascending model name and then by intelligence level in this order: `low`, `medium`, `high`, `xhigh`. Expanding a row shows a nested event table for that model and level without model or intelligence level columns. Expanded By Model rows are stored in browser `localStorage`, scoped to the report file path, Codex home, and report window length.

Session IDs in HTML table cells display as the first hash section after the rollout filename timestamp. The Events table stores its expanded detail rows and active sort order in browser `localStorage`, scoped to the report file path, Codex home, and report window length. This lets browser refreshes keep expanded rows open when the same event row is present in the regenerated report.

## Interval Mode

The command supports `--interval <seconds>` with `--out`. Interval mode runs one report immediately, writes the configured output file, waits the requested number of seconds, and repeats. Any terminal keypress records a stop request; the command exits instead of running again when the next interval boundary is reached.

Each interval run uses a fresh `now` and cutoff time, so a command such as `--minutes 15 --interval 15` keeps the output focused on the latest rolling 15 minute window. If history capture is enabled, each interval run appends one history snapshot.

`--force-refresh` can be used with `--format html --interval <seconds>`. The generated HTML includes a browser timer that reloads the page after `interval - 2` seconds. The interval must be at least 3 seconds.

## History

History capture is opt-in. `--save-history` appends one compact JSON object per run to `history.jsonl` under `DATA_PATH`. Filename-only `--history` values are written under `DATA_PATH`; history values with a folder path are used directly.

## Configuration

The CLI reads `.env` from the project root. When `.env` is not present, the CLI creates `.env` from `.env.example` before reading settings. On Windows, `.env` creation copies `DATA_PATH_WINDOWS_DEFAULT` to `DATA_PATH` so app-managed data defaults to `C:\Temp\codex-usage`; other platforms default to `/tmp/codex-usage`. `DATA_PATH` supplies the base folder for app-managed data files, including the default local history file, and is created when the command starts. `CODEX_HOME` supplies the Codex home folder to scan and appends `.codex` when the configured value does not include it. `STYLES` supplies the HTML report stylesheet selection. The `--data-path`, `--codex-home`, and `--styles` CLI options override these settings for a single run.

Configured paths are joined, resolved, and displayed with native path rules. Windows drive, UNC, and backslash paths use Windows path rules so `.env` and CLI values such as `C:\Users\example` remain valid. Invalid OS paths for output folders result in a runtime error.

## Runtime

The project uses Node.js built-in modules only. `package.json` exposes the `codex-usage` command with a `bin` entry that points directly at `src/codex-usage.js`.

The project source is organized into focused files:

- `.env.example` shows the supported local configuration values and seeds `.env` when the local file is not present.
- `src/codex-usage.js` is the direct CLI entry point for argument parsing, help text, environment defaults, and startup mode selection.
- `src/usage-runner.js` coordinates report generation for one-time and interval runs.
- `src/report-renderer.js` selects the text, JSON, or HTML report renderer for the structured report.
- `src/history-writer.js` resolves history destinations and writes optional compact JSONL history snapshots.
- `src/session-files.js` finds recent Codex session files in the configured Codex home.
- `src/session-parser.js` extracts token usage events, rate limit snapshots, and model metadata from Codex JSONL session records.
- `src/quota-snapshot.js` normalizes Codex rate limit snapshots for report output.
- `src/usage-loader.js`, `src/usage-normalizer.js`, `src/usage-metrics.js`, `src/usage-groups.js`, and `src/usage-insights.js` load, normalize, summarize, group, and annotate usage data.
- `src/report-text.js`, `src/report-json.js`, and `src/report-html.js` render the structured report model as terminal text, JSON, or standalone HTML.
- `docs/` contains the user and maintainer documentation.

HTML report rendering uses template assets under `src/html`. `src/report-html.js` reads `base.html`, replaces full-line stub comments with the refresh script, selected CSS, escaped report JSON, and browser JavaScript, then returns the complete standalone document.

## Source Aggregate Utility

`src/aggregate.js` builds `docs/aggregate.md`, a markdown document containing the JavaScript source files in `src`. The aggregate places `codex-usage.js` and `constants.js` first, then lists the remaining JavaScript files alphabetically. It is not needed for runtime and is not linked from the docs index. It is a convenience artifact for source review, documentation, external analysis, comparison, and archiving. See [source-aggregate.md](./source-aggregate.md) for the command.
