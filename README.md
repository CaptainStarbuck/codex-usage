# codex-usage v1.0.2

## What This Project Does

`codex-usage` is a local Node.js CLI for reviewing Codex token usage from Codex session JSONL files. It reads recent session activity, normalizes token count events, and renders usage reports as terminal text, JSON, or a standalone HTML dashboard.

Use it when you want to answer questions such as:

- How much token activity happened in the selected time window?
- Which sessions, models, or turns contributed the most usage?
- What Codex quota snapshot was visible in recent session data?
- Are there usage patterns worth noticing, such as duplicate token count events, stale quota data, large events, or missing metadata?

## What You Will See

The report includes:

- A window summary for the selected rolling time range.
- Token totals for input, cached input, effective input, output, reasoning output, and observed token volume.
- Account quota cards when Codex rate limit snapshots are available.
- Session, model, and event summaries.
- Warnings and notices for notable usage patterns.
- A sortable event table in the HTML report, with expandable details.
- Optional compact JSONL history snapshots for local trend storage.

### TUI Screenshot

![screenshot-01-tui-html](docs/screenshot-01-tui.png)

### HTML Screenshot

![screenshot-02-html](docs/screenshot-02-html.png)

## How To Use It

The command uses Node.js built-in modules only. No npm package installation is required to run the direct entry point.

Run the entry point with Node.js:

```bash
node src/codex-usage.js
```

For the smooth first-time path, read [docs/getting-started.md](./docs/getting-started.md). For the full command reference, read [docs/cli-reference.md](./docs/cli-reference.md).

## Common Commands

**_New in v1.1_** Configure the app-managed data folder in `.env` (copy from `.env.example`):

```bash
DATA_PATH=/tmp
```

Run a different time window. Includes data from the previous N minutes:

```bash
node src/codex-usage.js --minutes 30
```

Render JSON to standard output:

```bash
node src/codex-usage.js --minutes 15 --format json
```

Write a standalone browser report:

```bash
node src/codex-usage.js --minutes 15 --format html --out codex-usage.html
```

Regenerate the browser report every 10 seconds and make the open page refresh itself:

```bash
node src/codex-usage.js --minutes 15 --format html --out codex-usage.html --interval 10 --force-refresh
```

Append a compact local history snapshot:

```bash
node src/codex-usage.js --minutes 60 --save-history
```

## Documentation

Start with [docs/index.md](./docs/index.md), which links to:

- [Getting started](./docs/getting-started.md)
- [CLI reference](./docs/cli-reference.md)
- [Usage analytics report](./docs/analytics-report.md)
- [Implementation details](./docs/details.md)
- [Source aggregate utility](./docs/source-aggregate.md)

## Project Files

- `.env.example` **_New in v1.1_** shows the supported local configuration values. Copy to .env for first time usage and update .env as required when new env options are added.
- `src/codex-usage.js` is the direct CLI entry point and application flow coordinator.
- `src/session-files.js` finds recent Codex session files.
- `src/session-parser.js` extracts token usage events, rate limit snapshots, and model metadata.
- `src/quota-snapshot.js` normalizes Codex rate limit snapshots for report output.
- `src/usage-loader.js`, `src/usage-normalizer.js`, `src/usage-metrics.js`, `src/usage-groups.js`, and `src/usage-insights.js` load, normalize, summarize, and annotate usage data.
- `src/report-text.js`, `src/report-json.js`, and `src/report-html.js` render the structured report model.
- `src/aggregate.js` builds `src/aggregate.md` for source review.
- `docs/` contains the user and maintainer documentation.

### `src/aggregate.md`

This is a single Markdown document containing the whole JS source tree, ordered with the main entry files first. It's only useful when someone wants to:

- Read the project in one continuous document instead of opening many files.
- Paste the full source into a review tool, AI assistant, issue, or documentation system.
- Inspect a snapshot of the source without needing repo navigation.
- Compare or archive the current implementation as a human-readable artifact.

It is not needed for runtime. It is a convenience artifact for your review, documentation, and external analysis of the source.

## Dependencies

The run-time uses Node.js built-in modules only.

Package installation is optional, not required, and not supported as a package component.  
Only development scripts use the dev dependencies listed in `package.json`.  
PNPM is used in `package.json` scripts.

## Linked Command

The package exposes a `codex-usage` command through the `bin` field in `package.json`. Link it from a local checkout when that path matches your environment:

```bash
npm link
codex-usage
```

Remove the link later with `npm unlink --global codex-usage`.
