# codex-usage details

## Data Source

The command reads local Codex JSONL session files from `sessions` and `archived_sessions` under the configured Codex home. A different Codex home can be provided with `--codex-home`.

## Usage Events

Token consumption is read from JSONL records where `type` is `event_msg` and `payload.type` is `token_count`. The parser keeps valid token usage events from candidate session files, and the report applies the normalized range after parsing. A row is included only when `payload.info.total_token_usage` advances within the session. Rate limit status events can repeat a previous nonzero `last_token_usage`, so repeated cumulative totals are treated as quota updates rather than additional token usage.

## Quota Snapshots

Account quota information is read from non-null `payload.rate_limits` objects on `token_count` events. The parser attaches source context to each snapshot so the report can display the latest relevant quota state.

## Model Metadata

The parser reads `turn_context` records for `model` and `effort`. If a session file does not include those fields, the parser falls back to `config.toml` values for `model` and `model_reasoning_effort`. Missing values are printed as `unknown`.

## Totals

The structured report keeps Codex-provided raw token totals separate from derived display values. Derived totals cover observed token volume, effective input, visible output, cache hit rate, and reasoning output rate. See [analytics-report.md](./analytics-report.md) for field definitions.

## Range Filtering

Range options normalize to an inclusive start time, exclusive end time, scope, and complete-session flag before parsed rows are summarized. `--scope events` keeps matching events and computes session totals from those events. `--scope sessions` keeps whole sessions that intersect the selected range. `--in-scope` removes any session whose first or last usage event falls outside the selected range.

Detail limits are checked during file scanning and after the structured report is built. The command throws a runtime error instead of truncating data when a configured file, event, session, turn, or model limit would be exceeded.

## Insights

Insights are report annotations that call attention to missing data, stale quota data, active session patterns, unknown metadata, large events, cache behavior, metadata changes inside a session, and ignored duplicate token count events. See [analytics-report.md](./analytics-report.md) for the current insight list.

## Output Formats

The command supports `--format text|json|html`. Text output is intended for terminal review, JSON output emits the structured report object, and HTML output emits a standalone static browser dashboard. The report includes the selected window, quota status, token totals, insights, session summaries, model summaries, event rows, and optional session path references depending on the renderer. See [analytics-report.md](./analytics-report.md) for report model fields, derived metrics, HTML dashboard behavior, sorting, expansion state, and renderer-specific details.

## Interval Mode

The command supports `--interval <seconds>` with `--out`. Interval mode runs one report immediately, writes the configured output file, waits the requested number of seconds, and repeats. Any terminal keypress records a stop request; the command exits instead of running again when the next interval boundary is reached.

Each interval run uses a fresh `now` and normalized range, so a command such as `--minutes 15 --interval 15` keeps the output focused on the latest rolling 15 minute window. If history capture is enabled, each interval run appends one history snapshot.

`--force-refresh` can be used with `--format html --interval <seconds>`. The generated HTML includes a browser timer that reloads the page after `interval - 2` seconds. Force-refresh reports include a Refresh button above the report content that toggles the browser timer off and on. The interval must be at least 3 seconds.

## History

History capture is opt-in. `--save-history` appends one compact JSON object per run to `history.jsonl` under `DATA_PATH`. Filename-only `--history` values are written under `DATA_PATH`; history values with a folder path are used directly.

## Configuration

The CLI reads `.env` from the project root. When `.env` is not present, the CLI creates `.env` from `.env.example` before reading settings. On Windows, `.env` creation copies `DATA_PATH_WINDOWS_DEFAULT` to `DATA_PATH` so app-managed data defaults to `C:\Temp\codex-usage`; other platforms default to `/tmp/codex-usage`. `DATA_PATH` supplies the base folder for app-managed data files, including the default local history file, and is created when the command starts. `CODEX_HOME` supplies the Codex home folder to scan and appends `.codex` when the configured value does not include it. `STYLES` supplies the HTML report stylesheet selection. `RANGE_SCOPE`, `IN_SCOPE`, and detail limit settings supply range defaults. The `--data-path`, `--codex-home`, `--styles`, and range-related CLI options override these settings for a single run.

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
- `src/range-options.js` validates and normalizes range-related CLI and environment settings.
- `src/usage-range.js` applies event, session, and complete-session range filtering to parsed rows.
- `src/report-limits.js` enforces detail table row limits before rendering.
- `src/usage-loader.js`, `src/usage-normalizer.js`, `src/usage-metrics.js`, `src/usage-groups.js`, and `src/usage-insights.js` load, normalize, summarize, group, and annotate usage data.
- `src/report-text.js`, `src/report-json.js`, and `src/report-html.js` render the structured report model as terminal text, JSON, or standalone HTML.
- `docs/` contains the user and maintainer documentation.

HTML report rendering uses template assets under `src/html`. `src/report-html.js` reads `base.html`, adds HTML display metadata, replaces full-line stub comments with selected CSS, escaped report JSON, and browser JavaScript, then returns the complete standalone document. Browser JavaScript uses the refresh metadata to render controls and schedule page reloads when `--force-refresh` is active.

## Source Aggregate Utility

`src/aggregate.js` builds `docs/aggregate.md`, a markdown document containing the JavaScript source files in `src`. The aggregate places `codex-usage.js` and `constants.js` first, then lists the remaining JavaScript files alphabetically. It is not needed for runtime and is not linked from the docs index. It is a convenience artifact for source review, documentation, external analysis, comparison, and archiving. See [source-aggregate.md](./source-aggregate.md) for the command.
