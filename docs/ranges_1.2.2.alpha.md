# Range Selection CLI Spec For GitHub Issue 4

## Goal

Add explicit time range controls that let reports select usage by event time or session time, while keeping the default behavior compatible with the existing rolling `--minutes` option.

The implementation must define one normalized range before files are parsed:

- `fromDate`: inclusive lower bound, or `undefined`.
- `toDate`: exclusive upper bound, or `now`.
- `scope`: `events` or `sessions`.
- `inScope`: boolean session completeness filter.

All dates are evaluated in local runtime time when the user provides a local datetime without an offset. If a value includes a timezone offset or `Z`, that offset is honored. Month/day values without a year use the current year unless the requested month/day is after the current date, in which case the prior year is used.

## Proposed Options

| Option           | `.env` value   | Value                         | Default  | Description                                                                              |
| ---------------- | -------------- | ----------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `--from-date`    |                | ISO-like datetime             | Disabled | Inclusive start of the report range.                                                     |
| `--to-date`      |                | ISO-like datetime             | Disabled | Exclusive end of the report range.                                                       |
| `--from-minutes` |                | Positive integer minutes      | Disabled | Inclusive start as `now - from-minutes`.                                                 |
| `--to-minutes`   |                | Positive integer minutes      | Disabled | Exclusive end as `now - to-minutes`.                                                     |
| `--minutes`      |                | Positive integer minutes      | `15`     | Existing shorthand for `--from-minutes N` with no explicit ending period.                |
| `--scope`        | `RANGE_SCOPE`  | `events` or `sessions`        | `events` | Selects whether range matching is based on event timestamps or whole-session timestamps. |
| `--in-scope`     | `IN_SCOPE`     | Flag, or boolean in `.env`    | `false`  | Only includes sessions that are fully contained within the normalized range.             |
| `--max-events`   | `MAX_EVENTS`   | Positive integer, or `0` none | `500`    | Maximum events allowed in any generated detail table.                                    |
| `--max-sessions` | `MAX_SESSIONS` | Positive integer, or `0` none | `500`    | Maximum sessions allowed in any generated table or expandable table section.             |
| `--max-files`    | `MAX_FILES`    | Positive integer, or `0` none | `0`      | Optional guard for maximum session JSONL files scanned before range filtering.           |
| `--max-turns`    | `MAX_TURNS`    | Positive integer, or `0` none | `0`      | Optional guard for maximum unique session turns allowed in any generated detail table.   |
| `--max-models`   | `MAX_MODELS`   | Positive integer, or `0` none | `0`      | Optional guard for maximum model groups allowed in generated grouped tables.             |

CLI values override `.env` values. A value of `0` means unlimited for explicit maximum options only. Defaults are intentionally limited for detail rows that can make text or HTML output unusable.

## Backward Compatibility

`--minutes N` remains supported and behaves exactly like the current rolling window:

```bash
--from-minutes N
```

with no `--to-date` or `--to-minutes`, so `toDate` is `now`.

`--minutes` cannot be combined with `--from-date`, `--from-minutes`, `--to-date`, or `--to-minutes`. Users who need a bounded window should use the explicit range options.

## Range Normalization

Capture `now` once during option parsing and use that same value for all relative calculations in the run. In interval mode, each interval iteration captures a fresh `now` before parsing or normalizing runtime options for that iteration.

Date range bounds are:

- `fromDate` is inclusive: include records at exactly `fromDate`.
- `toDate` is exclusive: exclude records at exactly `toDate`.

The exclusive upper bound prevents duplicate records when adjacent ranges are run, such as `10:00 to 11:00` followed by `11:00 to 12:00`.

## Option Combination Matrix

| From option      | To option      | Handling                                                                |
| ---------------- | -------------- | ----------------------------------------------------------------------- |
| none             | none           | Use existing default: `fromDate = now - 15 minutes`, `toDate = now`.    |
| `--minutes`      | none           | Valid. `fromDate = now - minutes`, `toDate = now`.                      |
| `--from-date`    | none           | Valid. `fromDate = parsed from-date`, `toDate = now`.                   |
| `--from-minutes` | none           | Valid. `fromDate = now - from-minutes`, `toDate = now`.                 |
| none             | `--to-date`    | Error. An ending bound requires a starting bound.                       |
| none             | `--to-minutes` | Error. An ending bound requires a starting bound.                       |
| `--from-date`    | `--to-date`    | Valid. Parse both dates directly.                                       |
| `--from-date`    | `--to-minutes` | Valid. `toDate = now - to-minutes`.                                     |
| `--from-minutes` | `--to-date`    | Error. Mixing a relative start with an absolute end is ambiguous.       |
| `--from-minutes` | `--to-minutes` | Valid. `fromDate = now - from-minutes`, `toDate = now - to-minutes`.    |
| `--minutes`      | any range opt  | Error. `--minutes` is shorthand and cannot be combined with range opts. |

## Invalid Combinations

Return a CLI validation error before reading session files when:

- `--from-date` and `--from-minutes` are both specified.
- `--to-date` and `--to-minutes` are both specified.
- `--to-date` or `--to-minutes` is specified without a from value.
- `--from-minutes` is combined with `--to-date`.
- `--minutes` is combined with any explicit range option.
- `fromDate >= toDate` after normalization.
- Any minutes value is not a positive integer.
- Any date value cannot be parsed into a valid date.
- `--scope` is not `events` or `sessions`.
- `.env` boolean values for `IN_SCOPE` are not one of `true`, `false`, `1`, `0`, `yes`, or `no`.

## Valid Combination Examples

Rolling last 90 minutes:

```bash
node src/codex-usage.js --from-minutes 90
```

Absolute start through now:

```bash
node src/codex-usage.js --from-date 2026-05-14T09:00:00
```

Absolute bounded range:

```bash
node src/codex-usage.js --from-date 2026-05-14T09:00:00 --to-date 2026-05-14T10:00:00
```

Absolute start with relative end:

```bash
node src/codex-usage.js --from-date 2026-05-14T09:00:00 --to-minutes 30
```

Relative historical window:

```bash
node src/codex-usage.js --from-minutes 500 --to-minutes 200
```

Only complete sessions inside the relative historical window:

```bash
node src/codex-usage.js --from-minutes 500 --to-minutes 200 --in-scope
```

Use session timestamps instead of event timestamps:

```bash
node src/codex-usage.js --from-date 2026-05-14T09:00:00 --to-date 2026-05-14T17:00:00 --scope sessions
```

## Scope Semantics

### `--scope events`

This is the default. Include individual usage events when each event timestamp is within `[fromDate, toDate)`.

Session rows include a session when at least one included event belongs to that session. Session totals are computed from included events only, unless `--in-scope` removes the session.

Use this scope for the current report behavior and for exact token activity windows.

### `--scope sessions`

Include a whole session when the session's selected timestamp range intersects `[fromDate, toDate)`.

The session timestamp range is:

- `sessionStart`: earliest valid event timestamp in the session.
- `sessionEnd`: latest valid event timestamp in the session.

When a session is included by session scope, all usage events in that session are included in report totals unless `--in-scope` is also enabled. This makes `--scope sessions` useful when a user wants complete session totals for sessions active during a period.

If a session has no valid event timestamps, exclude it from range-scoped reports and include a warning count in diagnostics.

### `--in-scope`

`--in-scope` only includes sessions that are complete within `[fromDate, toDate)`.

A session is in scope when:

```text
sessionStart >= fromDate and sessionEnd < toDate
```

For `--scope events --in-scope`, first determine whether the full session is complete within the range. If not, remove the whole session, including otherwise matching events. This prevents incomplete session totals.

For `--scope sessions --in-scope`, include whole sessions only when the full session timestamp range is inside the report range.

`--in-scope` is invalid when no explicit or default range exists. Because the command always has a default range, this mainly protects future modes that might intentionally disable range filtering.

## Data Volume Constraints

The command must throw a runtime error before rendering when a report would include more detail data than configured limits allow.

The error should name:

- the limit that was exceeded,
- the configured value,
- the actual value,
- the option or `.env` variable that can override it,
- and the table or section that would include too much data.

Do not silently truncate. The correct cutoff is unknowable because some users want earliest records and others want latest records.

### Required Limits

`--max-events` / `MAX_EVENTS` applies independently to every detail table that renders event rows:

- top-level Events table,
- per-session event detail table,
- per-model event detail table,
- text detail table grouped by session,
- JSON detail arrays if the selected JSON mode includes event detail rows.

`--max-sessions` / `MAX_SESSIONS` applies independently to every table that renders session rows:

- top-level Sessions table,
- per-model expanded Sessions table,
- text session detail tables,
- JSON session arrays if the selected JSON mode includes session rows.

## Processing Order

1. Parse CLI arguments and `.env` values.
2. Capture `now`.
3. Normalize range options into `fromDate`, `toDate`, `scope`, and `inScope`.
4. Validate option combinations and normalized bounds.
5. Load candidate session files.
6. Parse sessions and events.
7. Apply range filtering according to `scope`.
8. Apply `inScope` session filtering.
9. Build report aggregates from retained data.
10. Check output table sizes against configured maximums.
11. Render output or throw a runtime error.

## Error Message Examples

Invalid mixed from options:

```text
Range options are invalid: use only one of --from-date or --from-minutes.
```

End without start:

```text
Range options are invalid: --to-date requires --from-date or --from-minutes.
```

Ambiguous relative start with absolute end:

```text
Range options are invalid: --from-minutes cannot be combined with --to-date. Use --from-date with --to-date, or --from-minutes with --to-minutes.
```

Range bounds out of order:

```text
Range options are invalid: the normalized from time must be earlier than the normalized to time.
```

Event table too large:

```text
Report detail limit exceeded: Events table would include 742 events, above --max-events=500. Increase --max-events or MAX_EVENTS to render this report.
```

Session table too large:

```text
Report detail limit exceeded: Sessions table would include 615 sessions, above --max-sessions=500. Increase --max-sessions or MAX_SESSIONS to render this report.
```

## Implementation Notes

Keep the range parser independent from report rendering so the same normalized range is available to text, JSON, HTML, and history capture.

Prefer adding a focused helper such as `normalizeRangeOptions()` with unit-testable input and output. It should not read files or inspect parsed sessions.

The existing `--minutes` behavior should be implemented through the same normalized range object so old and new paths cannot diverge.
