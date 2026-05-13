# Usage Analytics Report

## Feature Overview

The report turns local Codex session JSONL data into usage analytics for a rolling time window. It supports text, JSON, and standalone HTML output; optional interval regeneration; optional browser auto-refresh for HTML output; quota snapshot reporting; usage insights; model and session summaries; and opt-in local history capture.

## Report Model

The CLI builds one structured report object before rendering text, JSON, or HTML. The model contains:

- `window` with `cutoff`, `now`, and `minutes`
- `rows` with normalized event rows
- `totals` with raw token totals, derived aggregate metrics, and derived rates
- `quota` with the latest Codex rate limit snapshot when available
- `sessions` with grouped session summaries
- `models` with grouped model summaries
- `insights` with warnings and notices
- `metadata` with report generation details

## Normalized Rows

Each row includes the parsed event timestamp, model, intelligence level, source file, token fields, and derived metrics. Session identity comes from the JSONL filename. `turn_index` is the event position within the session and `seconds_since_previous` records elapsed seconds from the previous event in the same session.

Rows are emitted only when `payload.info.total_token_usage` advances within a session. This keeps rate limit status refreshes that repeat the previous `last_token_usage` from increasing usage totals.

## Quota

The quota section is built from `event_msg` records whose `payload.type` is `token_count` and whose `payload.rate_limits` value is non-null. Each snapshot records the source file, session id, and event timestamp. The report displays the latest snapshot in the selected window, or the latest earlier snapshot from the scanned files.

Quota limits include normalized used and remaining percentages, the raw `resets_at` Unix timestamp in seconds, and a local reset display string. Known windows are labeled `5h limit` for `300` minutes and `7d limit` for `10080` minutes.

## Derived Metrics

The report uses raw numeric fields in structured data and leaves rounding to renderers.

- `raw_total_tokens` is the Codex-provided row total when available.
- `observed_token_volume` sums input and output tokens for aggregate display.
- `effective_input_tokens` subtracts cached input tokens from input tokens.
- `visible_output_tokens` subtracts reasoning output tokens from output tokens.
- `cache_hit_rate` divides cached input tokens by input tokens.
- `reasoning_output_rate` divides reasoning output tokens by output tokens.

## HTML Report

The HTML report is a standalone static dashboard. It embeds the structured report JSON in a `script` tag, uses local CSS and JavaScript, and opens directly from the filesystem. The dashboard contains an optional refresh control panel, quota cards, summary cards, a stacked token timeline, model-level summaries, a sortable event table, a session path reference card, and warnings and notices at the bottom.

The timeline uses inline SVG and stacks cached input, effective input, output, and reasoning output tokens. Browser titles on timeline bars include timestamp or bucket, session id, model, intelligence level, token values, and cache hit rate.

The By Model table groups event rows by model and intelligence level. Each summary row displays the model and level together in the Model column, sorted by model name and then `low`, `medium`, `high`, and `xhigh`. Collapsed summary rows and expanded detail rows use the same token column order and labels as the Events table, starting with Input Tokens. Table headers break multi-word labels onto separate lines. Expanding a summary row shows the events for that model and level without repeating model or level columns. Expanded By Model rows include a Session column with compact `hash/turn` values. Expanded By Model rows are stored in browser `localStorage`, scoped to the report file path, Codex home, and report window length.

The Summary cards are grouped into rows for input, output, and totals. The Summary cards and Events table keep token displays in the order Input Tokens, Cached Input Tokens, Effective Input Tokens, Cache Hit Rate, Output Tokens, Reasoning Output Tokens, and Total Tokens. The event table also includes timestamp, session metadata, and model with intelligence level. Model values display as `model/intelligence`, such as `gpt-4.5/low`. Session values are displayed as the first hash section after the rollout timestamp followed by the turn index, such as `019e225d/3`. Numeric column headers and values are right-aligned. Expandable detail rows remain available and display a Detail header. Full session file paths appear in the Session Paths card at the bottom of the report.

Expanded rows and the active sort order are stored in browser `localStorage`, scoped to the report file path, Codex home, and report window length. This keeps the Events table stable across browser refreshes when regenerated reports still contain the same event rows.

## Text And JSON Reports

The text report is optimized for terminal review. It includes the selected window, quota details when available, aggregate totals, warnings and notices, session and model summaries, and a fixed-width event table.

The JSON report emits the full structured report object. It is useful for piping into other tools, saving snapshots, or inspecting the raw normalized report data.

## Insights

Insights call attention to notable report conditions:

- No usage events in the selected window.
- No quota snapshot found.
- Stale quota snapshot data.
- Multiple active sessions in the selected window.
- Unknown model or intelligence metadata.
- Low cache hit rate for large input events.
- Events over 100k observed token volume.
- Model or intelligence changes inside a session.
- Duplicate token count events ignored during normalization.

## Interval Mode

`--interval <seconds>` requires `--out` and repeatedly regenerates the selected output format. The first report is written immediately. Subsequent runs occur after each configured interval unless terminal input has requested shutdown. A keypress on the terminal stops the loop at the next interval boundary.

For HTML interval output, `--force-refresh` embeds a page reload timer at `interval - 2` seconds. This lets a browser tab opened from the output file keep itself near the command's regenerated report cadence. Force-refresh reports include a right-aligned Refresh button above the report content. The button toggles browser auto-refresh off and on so the current page can stay unchanged while the CLI continues regenerating the output file.

## CLI Options

The command supports `--minutes`, `--codex-home`, `--data-path`, `--format`, `--out`, `--styles`, `--style`, `--interval`, `--force-refresh`, `--save-history`, `--history`, `--help`, and `-h`. Windows paths are supported for folder and file options. [cli-reference.md](./cli-reference.md) contains defaults, constraints, and examples.

## History

History is opt-in. `--save-history` appends a compact JSONL summary to `history.jsonl` under `DATA_PATH`. `--data-path <path>` overrides `DATA_PATH` for the run. Filename-only `--history` values use `DATA_PATH`; values with a folder path are used directly.
