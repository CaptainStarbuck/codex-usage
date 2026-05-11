# codex-usage.js
Source file: `src/codex-usage.js`.
```javascript
#!/usr/bin/env node

import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
    DEFAULT_CODEX_HOME,
    DEFAULT_HISTORY_PATH,
    DEFAULT_WINDOW_MINUTES,
} from './constants.js';
import { renderHtmlReport } from './report-html.js';
import { renderJsonReport } from './report-json.js';
import { renderTextReport } from './report-text.js';
import { loadUsageData } from './usage-loader.js';
import { buildUsageReport } from './usage-metrics.js';

/**
 * @typedef {object} RuntimeOptions
 * @property {string} codexHome Codex home folder to scan.
 * @property {boolean} forceRefresh Whether HTML output should include the calculated refresh timer.
 * @property {string} format Output format.
 * @property {string | undefined} history Optional history output path.
 * @property {number | undefined} interval Optional regeneration interval in seconds.
 * @property {number} minutes Report window length in minutes.
 * @property {string | undefined} out Optional output file path.
 * @property {boolean} saveHistory Whether to append a history snapshot.
 */

/**
 * Parses CLI arguments for report loading and rendering.
 *
 * @param {string[]} args Raw process arguments after the executable name.
 * @returns {RuntimeOptions} Runtime options.
 */
function parseArgs(args) {
    /** @type {RuntimeOptions} */
    const options = {
        codexHome: DEFAULT_CODEX_HOME,
        forceRefresh: false,
        format: 'text',
        history: undefined,
        interval: undefined,
        minutes: DEFAULT_WINDOW_MINUTES,
        out: undefined,
        saveHistory: false,
    };

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--codex-home') {
            if (!args[index + 1]) {
                continue;
            }
            options.codexHome = args[index + 1];
            index += 1;
        } else if (arg === '--minutes') {
            if (!args[index + 1]) {
                continue;
            }
            options.minutes = Number.parseInt(args[index + 1], 10);
            index += 1;
        } else if (arg === '--format') {
            if (!args[index + 1]) {
                continue;
            }
            options.format = args[index + 1];
            index += 1;
        } else if (arg === '--out') {
            if (!args[index + 1]) {
                continue;
            }
            options.out = args[index + 1];
            index += 1;
        } else if (arg === '--interval') {
            if (!args[index + 1]) {
                continue;
            }
            options.interval = Number(args[index + 1]);
            index += 1;
        } else if (arg === '--force-refresh') {
            options.forceRefresh = true;
        } else if (arg === '--history') {
            if (!args[index + 1]) {
                continue;
            }
            options.history = args[index + 1];
            options.saveHistory = true;
            index += 1;
        } else if (arg === '--save-history') {
            options.saveHistory = true;
        } else if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        }
    }

    if (!Number.isFinite(options.minutes) || options.minutes < 1) {
        throw new Error('--minutes must be a positive integer.');
    }
    if (
        options.interval !== undefined &&
        (!Number.isInteger(options.interval) || options.interval < 1)
    ) {
        throw new Error(
            '--interval must be a positive integer number of seconds.'
        );
    }
    if (!['text', 'json', 'html'].includes(options.format)) {
        throw new Error('--format must be one of: text, json, html.');
    }
    if (options.interval !== undefined && !options.out) {
        throw new Error(
            '--interval requires --out so each run can regenerate an output file.'
        );
    }
    if (options.forceRefresh && options.format !== 'html') {
        throw new Error('--force-refresh requires --format html.');
    }
    if (options.forceRefresh && options.interval === undefined) {
        throw new Error('--force-refresh requires --interval.');
    }
    if (options.forceRefresh && (options.interval ?? 0) < 3) {
        throw new Error(
            '--force-refresh requires --interval of at least 3 seconds.'
        );
    }

    return options;
}

/**
 * Prints the command help text.
 *
 * @returns {void}
 */
function printHelp() {
    console.log(`Usage: node src/codex-usage.js [--minutes 15] [--codex-home /home/codex/.codex] [--format text|json|html] [--out path] [--interval seconds] [--force-refresh] [--save-history] [--history path]

Shows Codex token usage analytics from session JSONL files for the selected window.
Use --interval with --out to regenerate the output file until a terminal keypress stops the loop at the next interval.
Use --force-refresh with HTML interval output to make the browser refresh at interval minus 2 seconds.`);
}

/**
 * Coordinates argument parsing and the selected run mode.
 *
 * @returns {Promise<void>} Resolves after the command finishes.
 */
async function main() {
    const options = parseArgs(process.argv.slice(2));

    if (options.interval !== undefined) {
        await runInterval(options);
        return;
    }

    await runOnce(options);
}

/**
 * Coordinates one load, total, optional history capture, and render cycle.
 *
 * @param {RuntimeOptions} options Runtime options.
 * @returns {Promise<void>} Resolves after the report is written or printed.
 */
async function runOnce(options) {
    const now = new Date();
    const cutoff = new Date(now.getTime() - options.minutes * 60 * 1000);
    const usageData = await loadUsageData(options.codexHome, cutoff);
    const report = buildUsageReport({
        rows: usageData.rows,
        quotaSnapshots: usageData.quotaSnapshots,
        cutoff,
        now,
        minutes: options.minutes,
        codexHome: options.codexHome,
        format: options.format,
        duplicateTokenCountEvents: usageData.duplicateTokenCountEvents,
    });
    const output = renderReport(report, options);

    if (options.saveHistory) {
        await appendHistory(report, options.history ?? DEFAULT_HISTORY_PATH);
    }

    if (options.out) {
        await writeFile(options.out, output, 'utf8');
        return;
    }

    process.stdout.write(output);
}

/**
 * Repeats report generation until a terminal keypress asks the loop to stop.
 *
 * @param {RuntimeOptions} options Runtime options.
 * @returns {Promise<void>} Resolves after the loop stops.
 */
async function runInterval(options) {
    const watcher = createKeypressWatcher();

    try {
        await runIntervalTimer(options, watcher);
    } finally {
        watcher.dispose();
    }
}

/**
 * Starts a timer-driven interval runner that avoids overlapping report writes.
 *
 * @param {RuntimeOptions} options Runtime options.
 * @param {{ isStopRequested: () => boolean }} watcher Keypress watcher state.
 * @returns {Promise<void>} Resolves after interval mode stops.
 */
function runIntervalTimer(options, watcher) {
    return new Promise((resolvePromise, rejectPromise) => {
        let isRunning = false;
        let resolveAfterRun = false;
        /** @type {ReturnType<typeof setInterval> | undefined} */
        let interval;

        /**
         * Clears the active interval when the loop ends.
         *
         * @returns {void}
         */
        const clearActiveInterval = () => {
            if (interval) {
                clearInterval(interval);
            }
        };

        /**
         * Runs the report at a timer boundary, or resolves when input requested a stop.
         *
         * @returns {void}
         */
        const tick = () => {
            if (watcher.isStopRequested()) {
                clearActiveInterval();
                if (isRunning) {
                    resolveAfterRun = true;
                    return;
                }
                resolvePromise();
                return;
            }

            if (isRunning) {
                return;
            }

            isRunning = true;
            runOnce(options)
                .then(() => {
                    isRunning = false;
                    if (resolveAfterRun) {
                        resolvePromise();
                    }
                })
                .catch((error) => {
                    clearActiveInterval();
                    rejectPromise(error);
                });
        };

        interval = setInterval(tick, (options.interval ?? 1) * 1000);
        tick();
    });
}

/**
 * Creates a best-effort watcher that treats any terminal input as a stop request.
 *
 * @returns {{ dispose: () => void, isStopRequested: () => boolean }} Keypress watcher controls.
 */
function createKeypressWatcher() {
    let stopRequested = false;
    const input = process.stdin;

    /**
     * Records that the next interval boundary should end the loop.
     *
     * @returns {void}
     */
    const requestStop = () => {
        stopRequested = true;
    };

    if (input.isTTY) {
        input.setRawMode(true);
    }
    input.resume();
    input.on('data', requestStop);

    return {
        /**
         * Restores stdin to its normal state after interval mode exits.
         *
         * @returns {void}
         */
        dispose() {
            input.off('data', requestStop);
            if (input.isTTY) {
                input.setRawMode(false);
            }
            input.pause();
        },

        /**
         * Reports whether any terminal input has requested loop shutdown.
         *
         * @returns {boolean} True when a keypress was observed.
         */
        isStopRequested() {
            return stopRequested;
        },
    };
}

/**
 * Renders a report in the requested output format.
 *
 * @param {object} report Structured usage report.
 * @param {RuntimeOptions} options Runtime options.
 * @returns {string} Rendered report.
 */
function renderReport(report, options) {
    if (options.format === 'json') {
        return renderJsonReport(report);
    }
    if (options.format === 'html') {
        return renderHtmlReport(report, {
            refreshSeconds: options.forceRefresh
                ? (options.interval ?? 0) - 2
                : undefined,
        });
    }
    return renderTextReport(report);
}

/**
 * Appends a compact history snapshot for later local trend reporting.
 *
 * @param {object} report Structured usage report.
 * @param {string} historyPath Destination JSONL path.
 * @returns {Promise<void>} Resolves after the snapshot is appended.
 */
async function appendHistory(report, historyPath) {
    const safePath = resolveHistoryPath(historyPath);
    const snapshot = {
        captured_at: report.metadata.generated_at,
        window_minutes: report.window.minutes,
        observed_token_volume: report.totals.observed_token_volume,
        effective_input_tokens: report.totals.effective_input_tokens,
        cached_input_tokens: report.totals.cached_input_tokens,
        cache_hit_rate: report.totals.cache_hit_rate,
        output_tokens: report.totals.output_tokens,
        reasoning_output_tokens: report.totals.reasoning_output_tokens,
        session_count: report.sessions.length,
        quota: report.quota,
    };

    await mkdir(dirname(safePath), { recursive: true });
    await appendFile(safePath, `${JSON.stringify(snapshot)}\n`, 'utf8');
}

/**
 * Resolves a history path to its absolute destination.
 *
 * @param {string} historyPath User-provided or default path.
 * @returns {string} Absolute history path.
 */
function resolveHistoryPath(historyPath) {
    return resolve(historyPath);
}

main().catch((error) => {
    console.error(`codex-usage: ${error.message}`);
    process.exitCode = 1;
});
```

# constants.js
Source file: `src/constants.js`.
```javascript
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_CODEX_HOME = join(homedir(), '.codex');
export const DEFAULT_HISTORY_PATH = '/opt/codex/data/codex-usage/history.jsonl';
export const DEFAULT_WINDOW_MINUTES = 15;
export const SESSION_DIR_NAMES = ['sessions', 'archived_sessions'];
export const TOKEN_FIELDS = [
    'input_tokens',
    'cached_input_tokens',
    'output_tokens',
    'reasoning_output_tokens',
    'raw_total_tokens',
];
export const DERIVED_TOKEN_FIELDS = [
    'observed_token_volume',
    'effective_input_tokens',
    'visible_output_tokens',
    'cache_hit_rate',
    'reasoning_output_rate',
];
export const LARGE_INPUT_TOKEN_THRESHOLD = 25000;
export const LARGE_EVENT_TOKEN_THRESHOLD = 100000;
```

# quota-snapshot.js
Source file: `src/quota-snapshot.js`.
```javascript
/**
 * Builds the quota report section from parsed Codex rate limit snapshots.
 *
 * @param {{ snapshots: object[], cutoff: Date, now: Date }} input Quota inputs.
 * @returns {object} Normalized quota report.
 */
export function buildQuotaReport(input) {
    const snapshot = selectQuotaSnapshot(
        input.snapshots,
        input.cutoff,
        input.now
    );

    if (!snapshot) {
        return {
            available: false,
            source: 'codex-session-rate-limits',
            limits: [],
            warnings: [
                'No non-null rate_limits snapshot was found in the scanned Codex session files.',
            ],
        };
    }

    return {
        available: true,
        source: 'codex-session-rate-limits',
        captured_at: snapshot.timestamp,
        session_id: snapshot.session_id,
        file: snapshot.file,
        plan_type: stringOrEmpty(snapshot.rate_limits?.plan_type),
        limit_id: stringOrEmpty(snapshot.rate_limits?.limit_id),
        limit_name: stringOrEmpty(snapshot.rate_limits?.limit_name),
        rate_limit_reached_type: stringOrEmpty(
            snapshot.rate_limits?.rate_limit_reached_type
        ),
        limits: normalizeLimits(snapshot.rate_limits),
        credits: normalizeCredits(snapshot.rate_limits?.credits),
        warnings: [],
    };
}

/**
 * Chooses the latest snapshot inside the selected window, falling back to the
 * latest snapshot before the window when a scanned file contains one.
 *
 * @param {object[]} snapshots Parsed quota snapshots.
 * @param {Date} cutoff Earliest timestamp for the selected report window.
 * @param {Date} now Report generation timestamp.
 * @returns {object | undefined} Selected snapshot.
 */
function selectQuotaSnapshot(snapshots, cutoff, now) {
    const sortedSnapshots = snapshots
        .filter((snapshot) => isUsableSnapshot(snapshot, now))
        .sort((first, second) =>
            first.timestamp.localeCompare(second.timestamp)
        );
    const inWindowSnapshots = sortedSnapshots.filter(
        (snapshot) => new Date(snapshot.timestamp) >= cutoff
    );

    return inWindowSnapshots.at(-1) ?? sortedSnapshots.at(-1);
}

/**
 * Checks that a parsed snapshot has a valid timestamp and happened before the
 * report generation time.
 *
 * @param {object} snapshot Parsed quota snapshot.
 * @param {Date} now Report generation timestamp.
 * @returns {boolean} True when the snapshot can be displayed.
 */
function isUsableSnapshot(snapshot, now) {
    const timestamp = new Date(String(snapshot.timestamp ?? ''));

    return (
        !Number.isNaN(timestamp.getTime()) &&
        timestamp <= now &&
        Boolean(snapshot.rate_limits)
    );
}

/**
 * Normalizes primary and secondary rate limit windows.
 *
 * @param {object | undefined} rateLimits Raw RateLimitSnapshot payload.
 * @returns {object[]} Display-ready limit windows.
 */
function normalizeLimits(rateLimits) {
    /** @type {object[]} */
    const limits = [];

    addLimit(limits, rateLimits?.primary, 'primary');
    addLimit(limits, rateLimits?.secondary, 'secondary');
    return limits;
}

/**
 * Adds one display-ready limit window when it exists.
 *
 * @param {object[]} limits Mutable output list.
 * @param {object | undefined} window Raw RateLimitWindow payload.
 * @param {'primary' | 'secondary'} kind Limit window kind.
 * @returns {void}
 */
function addLimit(limits, window, kind) {
    if (!window) {
        return;
    }

    const usedPercent = clampPercent(readNumber(window.used_percent));
    const windowMinutes = readNumber(window.window_minutes);
    const resetsAt = readNumber(window.resets_at);

    limits.push({
        name: limitName(windowMinutes, kind),
        window_minutes: windowMinutes,
        used_percent: usedPercent,
        remaining_percent: clampPercent(100 - usedPercent),
        resets_at: Number.isFinite(resetsAt) && resetsAt > 0 ? resetsAt : null,
        resets_at_local: formatResetTime(resetsAt),
    });
}

/**
 * Builds a display label for a rate limit window.
 *
 * @param {number} windowMinutes Window size in minutes.
 * @param {'primary' | 'secondary'} kind Limit window kind.
 * @returns {string} Display label.
 */
function limitName(windowMinutes, kind) {
    if (windowMinutes === 300) {
        return '5h limit';
    }
    if (windowMinutes === 10080) {
        return '7d limit';
    }
    return kind === 'primary' ? 'Primary limit' : 'Secondary limit';
}

/**
 * Converts a Unix timestamp in seconds to a local display string.
 *
 * @param {number} resetsAt Unix timestamp in seconds.
 * @returns {string} Local display label.
 */
function formatResetTime(resetsAt) {
    if (!Number.isFinite(resetsAt) || resetsAt <= 0) {
        return '';
    }

    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(resetsAt * 1000));
}

/**
 * Normalizes the credits portion of a rate limit snapshot.
 *
 * @param {object | undefined} credits Raw credits payload.
 * @returns {object | undefined} Display-ready credits object.
 */
function normalizeCredits(credits) {
    if (!credits) {
        return undefined;
    }

    /** @type {{ has_credits: boolean, unlimited: boolean, balance?: string }} */
    const normalizedCredits = {
        has_credits: Boolean(credits.has_credits),
        unlimited: Boolean(credits.unlimited),
    };

    if (
        credits.balance !== undefined &&
        credits.balance !== null &&
        String(credits.balance).trim() !== ''
    ) {
        normalizedCredits.balance = formatBalance(credits.balance);
    }

    return normalizedCredits;
}

/**
 * Formats a credit balance while preserving nonnumeric service text.
 *
 * @param {unknown} balance Raw credit balance.
 * @returns {string} Display balance.
 */
function formatBalance(balance) {
    const numberValue = Number(balance);

    if (Number.isFinite(numberValue)) {
        return String(Math.round(numberValue));
    }

    return String(balance);
}

/**
 * Clamps a percent value to the display range.
 *
 * @param {number} value Percent value.
 * @returns {number} Clamped percent.
 */
function clampPercent(value) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.min(100, value));
}

/**
 * Reads a finite number from an unknown value.
 *
 * @param {unknown} value Value to normalize.
 * @returns {number} Finite number or zero.
 */
function readNumber(value) {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
}

/**
 * Converts an optional value to a string without surfacing nullish values.
 *
 * @param {unknown} value Value to normalize.
 * @returns {string} String value or empty string.
 */
function stringOrEmpty(value) {
    return value === undefined || value === null ? '' : String(value);
}
```

# report-html.js
Source file: `src/report-html.js`.
```javascript
/**
 * @typedef {object} HtmlRenderOptions
 * @property {number | undefined} refreshSeconds Optional page refresh delay in seconds.
 */

/**
 * Renders a standalone static HTML usage dashboard.
 *
 * @param {object} report Structured usage report.
 * @param {HtmlRenderOptions} [options] HTML rendering options.
 * @returns {string} HTML document.
 */
export function renderHtmlReport(report, options = {}) {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Codex Usage Report</title>
  ${renderRefreshScript(options.refreshSeconds)}
  <style>
    :root {
      color-scheme: dark;
      --bg: #101318;
      --panel: #171c23;
      --panel-2: #1d2530;
      --panel-3: #202a35;
      --text: #e9eef6;
      --muted: #9ba8b8;
      --line: #2b3543;
      --cached: #6ad1c9;
      --effective: #87a8ff;
      --output: #f3b563;
      --reasoning: #c58cff;
      --warn: #f3b563;
      --notice: #87a8ff;
    }
    * { box-sizing: border-box; }
    html, body { max-width: 100%; overflow-x: hidden; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.45;
    }
    main {
      width: min(1440px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 28px 0 40px;
    }
    header {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 22px;
    }
    h1, h2, h3 {
      margin: 0;
      letter-spacing: 0;
    }
    h1 { font-size: clamp(1.6rem, 2rem, 2.25rem); }
    h2 { font-size: 1rem; margin: 28px 0 12px; color: var(--muted); text-transform: uppercase; }
    h3 { font-size: 1rem; }
    .meta { color: var(--muted); font-size: 0.92rem; }
    .cards, .quota-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }
    .quota-cards { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .card, .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .card { padding: 14px; min-height: 96px; }
    .label { color: var(--muted); font-size: 0.82rem; }
    .value { margin-top: 6px; font-size: 1.45rem; font-weight: 700; }
    .bar {
      height: 8px;
      margin-top: 12px;
      background: #26313d;
      border-radius: 999px;
      overflow: hidden;
    }
    .bar span { display: block; height: 100%; background: var(--cached); }
    .detail { margin-top: 6px; color: var(--muted); font-size: 0.86rem; }
    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 12px;
    }
    .list {
      display: grid;
      gap: 8px;
      padding: 12px;
    }
    .list-item {
      display: grid;
      gap: 8px;
      padding: 12px;
      background: var(--panel-2);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .list-item header {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 12px;
      margin: 0;
    }
    .list-item strong { word-break: break-word; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 8px 12px;
      color: var(--muted);
      font-size: 0.88rem;
    }
    .stats b {
      display: block;
      color: var(--text);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .timeline {
      padding: 14px;
      overflow-x: auto;
    }
    .timeline svg {
      display: block;
      min-width: 920px;
      width: 100%;
      height: 220px;
    }
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 12px;
      color: var(--muted);
      font-size: 0.86rem;
    }
    .legend span::before {
      content: "";
      display: inline-block;
      width: 10px;
      height: 10px;
      margin-right: 6px;
      border-radius: 2px;
      background: var(--legend-color);
    }
    .insights {
      display: grid;
      gap: 8px;
      margin-top: 12px;
    }
    .insight {
      border: 1px solid var(--line);
      border-left: 4px solid var(--notice);
      border-radius: 8px;
      padding: 10px 12px;
      background: var(--panel);
    }
    .insight.warning { border-left-color: var(--warn); }
    .empty {
      padding: 18px;
      color: var(--muted);
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    .table-panel { overflow-x: auto; overflow-y: visible; }
    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 1060px;
    }
    th, td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      text-align: left;
      white-space: nowrap;
      font-size: 0.9rem;
    }
    th {
      color: var(--muted);
      cursor: pointer;
      user-select: none;
      background: var(--panel-2);
      position: sticky;
      top: 0;
      z-index: 1;
    }
    td.number { text-align: right; font-variant-numeric: tabular-nums; }
    .event-toggle {
      width: 28px;
      height: 28px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-3);
      color: var(--text);
      cursor: pointer;
    }
    .event-detail-row[hidden] { display: none; }
    .event-detail {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 8px 16px;
      padding: 12px;
      background: var(--panel-2);
      color: var(--muted);
      white-space: normal;
    }
    .event-detail b { display: block; color: var(--text); word-break: break-word; }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Codex Usage Report</h1>
        <div class="meta" id="window"></div>
      </div>
      <div class="meta" id="generated"></div>
    </header>

    <section id="quota"></section>
    <h2>Summary</h2>
    <section class="cards" id="summary"></section>
    <h2>Timeline</h2>
    <section class="panel timeline" id="timeline"></section>
    <section id="insights"></section>
    <section class="dashboard-grid">
      <div>
        <h2>Top Sessions</h2>
        <section class="panel list" id="top-sessions"></section>
      </div>
      <div>
        <h2>Top Events</h2>
        <section class="panel list" id="top-events"></section>
      </div>
    </section>
    <h2>Models</h2>
    <section class="panel table-panel"><table id="models-table"></table></section>
    <h2>Events</h2>
    <section class="panel table-panel"><table id="events-table"></table></section>
  </main>
  <script type="application/json" id="report-data">${escapeScriptJson(report)}</script>
  <script>
    const report = JSON.parse(document.getElementById('report-data').textContent);
    const numberFields = new Set([
      'event_count',
      'input_tokens',
      'cached_input_tokens',
      'effective_input_tokens',
      'visible_output_tokens',
      'output_tokens',
      'reasoning_output_tokens',
      'raw_total_tokens',
      'observed_token_volume',
      'cache_hit_rate',
      'reasoning_output_rate',
      'turn_index',
      'seconds_since_previous',
      'max_single_event_observed_token_volume'
    ]);
    const eventColumns = [
      'timestamp',
      'session_id',
      'turn_index',
      'seconds_since_previous',
      'model',
      'intelligence_level',
      'observed_token_volume',
      'effective_input_tokens',
      'cached_input_tokens',
      'cache_hit_rate',
      'output_tokens',
      'reasoning_output_tokens'
    ];
    const detailColumns = ['input_tokens', 'visible_output_tokens', 'reasoning_output_rate', 'raw_total_tokens', 'file'];

    function integer(value) {
      return Math.round(Number(value || 0)).toLocaleString('en-US');
    }

    function percent(value) {
      return (Number(value || 0) * 100).toFixed(1) + '%';
    }

    function display(field, value) {
      if (field.endsWith('_rate')) {
        return percent(value);
      }
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      if (numberFields.has(field)) {
        return integer(value);
      }
      return value ?? '';
    }

    function html(value) {
      return String(value ?? '').replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[character]);
    }

    function renderSummary() {
      const totals = report.totals || {};
      const cards = [
        ['Observed Token Volume', integer(totals.observed_token_volume), 1],
        ['Effective Input', integer(totals.effective_input_tokens), 1],
        ['Cached Input', integer(totals.cached_input_tokens), totals.cache_hit_rate],
        ['Cache Hit Rate', percent(totals.cache_hit_rate), totals.cache_hit_rate],
        ['Output Tokens', integer(totals.output_tokens), 1],
        ['Reasoning Output', integer(totals.reasoning_output_tokens), totals.reasoning_output_rate],
        ['Sessions', integer((report.sessions || []).length), 1],
        ['Events', integer((report.rows || []).length), 1]
      ];
      document.getElementById('summary').innerHTML = cards.map(([label, value, rate]) => '<article class="card"><div class="label">' + html(label) + '</div><div class="value">' + html(value) + '</div><div class="bar"><span style="width:' + Math.max(0, Math.min(100, Number(rate || 0) * 100)) + '%"></span></div></article>').join('');
    }

    function renderQuota() {
      const node = document.getElementById('quota');
      const quota = report.quota || {};
      if (!quota.available) {
        const warnings = quota.warnings || [];
        node.innerHTML = '<h2>Quota</h2><div class="empty">' + html(warnings[0] || 'Quota unavailable.') + '</div>';
        return;
      }

      const limitCards = (quota.limits || []).map((limit) => '<article class="card"><div class="label">' + html(limit.name) + '</div><div class="value">' + Number(limit.remaining_percent || 0).toFixed(1) + '%</div><div class="detail">' + Number(limit.used_percent || 0).toFixed(1) + '% used' + (limit.resets_at_local ? ', resets ' + html(limit.resets_at_local) : '') + '</div><div class="bar"><span style="width:' + Math.max(0, Math.min(100, Number(limit.remaining_percent || 0))) + '%"></span></div></article>');
      const credits = quota.credits || {};
      if (credits.has_credits) {
        const value = credits.unlimited ? 'unlimited' : (credits.balance || 'available');
        limitCards.push('<article class="card"><div class="label">Credits</div><div class="value">' + html(value) + '</div><div class="detail">' + html(quota.plan_type || '') + '</div></article>');
      }

      node.innerHTML = '<h2>Quota</h2><section class="quota-cards">' + limitCards.join('') + '</section>';
    }

    function renderInsights() {
      const node = document.getElementById('insights');
      const insights = report.insights || [];
      if (insights.length === 0) {
        node.innerHTML = '<h2>Warnings And Insights</h2><div class="empty">No warnings or notices for this report window.</div>';
        return;
      }
      node.innerHTML = '<h2>Warnings And Insights</h2><div class="insights">' + insights.map((insight) => '<div class="insight ' + html(insight.severity) + '"><strong>' + html(insight.severity) + '</strong>: ' + html(insight.message) + '</div>').join('') + '</div>';
    }

    function renderTopSessions() {
      const node = document.getElementById('top-sessions');
      const sessions = [...(report.sessions || [])].sort((left, right) => Number(right.observed_token_volume || 0) - Number(left.observed_token_volume || 0)).slice(0, 8);
      if (sessions.length === 0) {
        node.innerHTML = '<div class="empty">No sessions found in this report window.</div>';
        return;
      }
      node.innerHTML = sessions.map((session) => '<article class="list-item"><header><strong>' + html(session.session_id) + '</strong><span class="value">' + integer(session.observed_token_volume) + '</span></header><div class="stats"><span>Events<b>' + integer(session.event_count) + '</b></span><span>First<b>' + html(session.first_timestamp) + '</b></span><span>Last<b>' + html(session.last_timestamp) + '</b></span><span>Effective Input<b>' + integer(session.effective_input_tokens) + '</b></span><span>Cache Hit Rate<b>' + percent(session.cache_hit_rate) + '</b></span><span>Models<b>' + html((session.models || []).join(', ')) + '</b></span><span>Intelligence<b>' + html((session.intelligence_levels || []).join(', ')) + '</b></span></div></article>').join('');
    }

    function renderTopEvents() {
      const node = document.getElementById('top-events');
      const rows = [...(report.rows || [])].sort((left, right) => Number(right.observed_token_volume || 0) - Number(left.observed_token_volume || 0) || Number(right.effective_input_tokens || 0) - Number(left.effective_input_tokens || 0)).slice(0, 8);
      if (rows.length === 0) {
        node.innerHTML = '<div class="empty">No events found in this report window.</div>';
        return;
      }
      node.innerHTML = rows.map((row) => '<article class="list-item"><header><strong>' + html(row.timestamp) + '</strong><span class="value">' + integer(row.observed_token_volume) + '</span></header><div class="stats"><span>Session<b>' + html(row.session_id) + '</b></span><span>Model<b>' + html(row.model) + '</b></span><span>Intelligence<b>' + html(row.intelligence_level) + '</b></span><span>Effective Input<b>' + integer(row.effective_input_tokens) + '</b></span><span>Cached Input<b>' + integer(row.cached_input_tokens) + '</b></span><span>Cache Hit Rate<b>' + percent(row.cache_hit_rate) + '</b></span><span>Output<b>' + integer(row.output_tokens) + '</b></span><span>Reasoning Output<b>' + integer(row.reasoning_output_tokens) + '</b></span></div></article>').join('');
    }

    function renderTimeline() {
      const node = document.getElementById('timeline');
      const rows = report.rows || [];
      if (rows.length === 0) {
        node.innerHTML = '<div class="empty">No events found for the timeline.</div>';
        return;
      }

      const buckets = buildTimelineBuckets(rows);
      if (buckets.length === 0) {
        node.innerHTML = '<div class="empty">No valid timestamps found for the timeline.</div>';
        return;
      }
      const maxVolume = Math.max(...buckets.map((bucket) => bucket.observed_token_volume), 1);
      const width = Math.max(920, buckets.length * 18 + 80);
      const height = 210;
      const chartTop = 18;
      const chartHeight = 150;
      const barGap = 3;
      const barWidth = Math.max(4, (width - 80) / buckets.length - barGap);
      const colors = {
        cached_input_tokens: '#6ad1c9',
        effective_input_tokens: '#87a8ff',
        output_tokens: '#f3b563',
        reasoning_output_tokens: '#c58cff'
      };
      const rects = buckets.map((bucket, index) => {
        const x = 50 + index * (barWidth + barGap);
        let y = chartTop + chartHeight;
        const segments = ['cached_input_tokens', 'effective_input_tokens', 'output_tokens', 'reasoning_output_tokens'];
        return segments.map((field) => {
          const segmentHeight = Math.max(0, Number(bucket[field] || 0) / maxVolume * chartHeight);
          y -= segmentHeight;
          return '<rect x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + barWidth.toFixed(2) + '" height="' + segmentHeight.toFixed(2) + '" fill="' + colors[field] + '"><title>' + html(timelineTitle(bucket)) + '</title></rect>';
        }).join('');
      }).join('');

      node.innerHTML = '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Token usage timeline"><line x1="45" y1="' + (chartTop + chartHeight) + '" x2="' + (width - 20) + '" y2="' + (chartTop + chartHeight) + '" stroke="#2b3543"/>' + rects + '<text x="50" y="195" fill="#9ba8b8" font-size="12">' + html(buckets[0].label) + '</text><text x="' + (width - 190) + '" y="195" fill="#9ba8b8" font-size="12">' + html(buckets.at(-1).label) + '</text></svg><div class="legend"><span style="--legend-color: var(--cached)">Cached input</span><span style="--legend-color: var(--effective)">Effective input</span><span style="--legend-color: var(--output)">Output</span><span style="--legend-color: var(--reasoning)">Reasoning output</span></div>';
    }

    function buildTimelineBuckets(rows) {
      const timestamps = rows.map((row) => new Date(row.timestamp).getTime()).filter(Number.isFinite);
      if (timestamps.length === 0) {
        return [];
      }
      const start = Math.min(...timestamps);
      const end = Math.max(...timestamps);
      const spanMinutes = Math.max(0, (end - start) / 60000);
      const bucketMinutes = spanMinutes <= 90 ? 1 : spanMinutes <= 1440 ? 15 : spanMinutes <= 10080 ? 60 : 1440;
      const bucketMilliseconds = bucketMinutes * 60000;
      const buckets = new Map();

      for (const row of rows) {
        const timestamp = new Date(row.timestamp).getTime();
        if (!Number.isFinite(timestamp)) {
          continue;
        }
        const key = bucketMinutes === 1 && spanMinutes <= 90 ? String(row.timestamp) : String(Math.floor((timestamp - start) / bucketMilliseconds));
        const bucketStart = bucketMinutes === 1 && spanMinutes <= 90 ? timestamp : start + Number(key) * bucketMilliseconds;
        const bucket = buckets.get(key) || {
          label: new Date(bucketStart).toISOString(),
          timestamp: new Date(bucketStart).toISOString(),
          session_id: row.session_id,
          model: row.model,
          intelligence_level: row.intelligence_level,
          cached_input_tokens: 0,
          effective_input_tokens: 0,
          output_tokens: 0,
          reasoning_output_tokens: 0,
          observed_token_volume: 0,
          input_tokens: 0
        };
        bucket.cached_input_tokens += Number(row.cached_input_tokens || 0);
        bucket.effective_input_tokens += Number(row.effective_input_tokens || 0);
        bucket.output_tokens += Number(row.output_tokens || 0);
        bucket.reasoning_output_tokens += Number(row.reasoning_output_tokens || 0);
        bucket.observed_token_volume += Number(row.observed_token_volume || 0);
        bucket.input_tokens += Number(row.input_tokens || 0);
        bucket.session_id = bucket.session_id === row.session_id ? bucket.session_id : 'multiple';
        bucket.model = bucket.model === row.model ? bucket.model : 'multiple';
        bucket.intelligence_level = bucket.intelligence_level === row.intelligence_level ? bucket.intelligence_level : 'multiple';
        buckets.set(key, bucket);
      }

      return [...buckets.values()].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    }

    function timelineTitle(bucket) {
      return [
        bucket.label,
        'session: ' + bucket.session_id,
        'model: ' + bucket.model,
        'intelligence: ' + bucket.intelligence_level,
        'observed: ' + integer(bucket.observed_token_volume),
        'effective input: ' + integer(bucket.effective_input_tokens),
        'cached input: ' + integer(bucket.cached_input_tokens),
        'output: ' + integer(bucket.output_tokens),
        'reasoning output: ' + integer(bucket.reasoning_output_tokens),
        'cache hit rate: ' + percent(bucket.input_tokens ? bucket.cached_input_tokens / bucket.input_tokens : 0)
      ].join('\\n');
    }

    function renderTable(id, rows, columns, options = {}) {
      const table = document.getElementById(id);
      if (rows.length === 0) {
        table.innerHTML = '<tbody><tr><td>No rows found.</td></tr></tbody>';
        return;
      }
      let sortColumn = columns[0];
      let sortDirection = 1;

      function draw() {
        const sortedRows = [...rows].sort((left, right) => compareValues(left[sortColumn], right[sortColumn]) * sortDirection);
        const head = '<thead><tr>' + (options.details ? '<th></th>' : '') + columns.map((column) => '<th data-column="' + html(column) + '">' + html(column) + '</th>').join('') + '</tr></thead>';
        const body = '<tbody>' + sortedRows.map((row, index) => renderTableRow(row, columns, index, options)).join('') + '</tbody>';
        table.innerHTML = head + body;
        table.querySelectorAll('th[data-column]').forEach((header) => {
          header.addEventListener('click', () => {
            const column = header.dataset.column;
            if (sortColumn === column) {
              sortDirection *= -1;
            } else {
              sortColumn = column;
              sortDirection = 1;
            }
            draw();
          });
        });
        table.querySelectorAll('.event-toggle').forEach((button) => {
          button.addEventListener('click', () => {
            const detailRow = table.querySelector('[data-detail-row="' + button.dataset.detail + '"]');
            const expanded = button.getAttribute('aria-expanded') === 'true';
            button.setAttribute('aria-expanded', String(!expanded));
            button.textContent = expanded ? '+' : '-';
            detailRow.hidden = expanded;
          });
        });
      }

      draw();
    }

    function renderTableRow(row, columns, index, options) {
      const cells = columns.map((column) => '<td class="' + (numberFields.has(column) ? 'number' : '') + '">' + html(display(column, row[column])) + '</td>').join('');
      if (!options.details) {
        return '<tr>' + cells + '</tr>';
      }
      const detailId = 'event-' + index;
      const detail = detailColumns.map((column) => '<span>' + html(column) + '<b>' + html(display(column, row[column])) + '</b></span>').join('');
      return '<tr><td><button class="event-toggle" type="button" aria-expanded="false" data-detail="' + detailId + '">+</button></td>' + cells + '</tr><tr class="event-detail-row" data-detail-row="' + detailId + '" hidden><td colspan="' + (columns.length + 1) + '"><div class="event-detail">' + detail + '</div></td></tr>';
    }

    function compareValues(left, right) {
      const leftNumber = Number(left);
      const rightNumber = Number(right);
      if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
        return leftNumber - rightNumber;
      }
      return String(left ?? '').localeCompare(String(right ?? ''));
    }

    document.getElementById('window').textContent = report.window.cutoff + ' to ' + report.window.now + ' (' + report.window.minutes + ' minutes)';
    document.getElementById('generated').textContent = 'Generated ' + report.metadata.generated_at;
    renderQuota();
    renderSummary();
    renderTimeline();
    renderInsights();
    renderTopSessions();
    renderTopEvents();
    renderTable('models-table', report.models || [], ['model', 'event_count', 'sessions', 'intelligence_levels', 'observed_token_volume', 'effective_input_tokens', 'cached_input_tokens', 'cache_hit_rate', 'output_tokens', 'reasoning_output_tokens', 'raw_total_tokens']);
    renderTable('events-table', report.rows || [], eventColumns, { details: true });
  </script>
</body>
</html>
`;
}

/**
 * Renders a browser refresh script when interval HTML output requests it.
 *
 * @param {number | undefined} refreshSeconds Page refresh delay in seconds.
 * @returns {string} Script markup or an empty string.
 */
function renderRefreshScript(refreshSeconds) {
    if (!Number.isFinite(refreshSeconds) || refreshSeconds < 1) {
        return '';
    }

    return `<script>
    window.setTimeout(() => {
      window.location.reload();
    }, ${Math.round(refreshSeconds)} * 1000);
  </script>`;
}

/**
 * Escapes JSON so it can be embedded safely in a script data block.
 *
 * @param {object} report Structured usage report.
 * @returns {string} Escaped JSON.
 */
function escapeScriptJson(report) {
    return JSON.stringify(report).replace(/</gu, '\\u003c');
}
```

# report-json.js
Source file: `src/report-json.js`.
```javascript
/**
 * Renders the structured report as stable JSON text.
 *
 * @param {object} report Structured usage report.
 * @returns {string} JSON document.
 */
export function renderJsonReport(report) {
    return `${JSON.stringify(report, null, 2)}\n`;
}
```

# report-text.js
Source file: `src/report-text.js`.
```javascript
import { TOKEN_FIELDS } from './constants.js';

const COLUMNS = [
    'timestamp',
    'model',
    'intelligence_level',
    'observed_token_volume',
    ...TOKEN_FIELDS,
];

/**
 * Renders the text usage report.
 *
 * @param {object} report Structured usage report.
 * @returns {string} Terminal report text.
 */
export function renderTextReport(report) {
    /** @type {string[]} */
    const lines = [
        `Codex token usage from ${report.window.cutoff} to ${report.window.now}`,
        '',
        ...formatSummary(report),
        '',
        ...formatQuota(report.quota),
    ];

    if (report.insights.length > 0) {
        lines.push('', 'Insights');
        for (const insight of report.insights) {
            lines.push(`${insight.severity}: ${insight.message}`);
        }
    }

    if (report.rows.length === 0) {
        lines.push('', 'No token usage events found in the selected window.');
    } else {
        lines.push('', formatTable(report.rows));
    }

    return `${lines.join('\n')}\n`;
}

/**
 * Formats account quota details for terminal output.
 *
 * @param {object} quota Normalized quota report.
 * @returns {string[]} Quota lines.
 */
function formatQuota(quota) {
    if (!quota?.available) {
        return [
            'Quota',
            'available: false',
            ...(quota?.warnings ?? []).map((warning) => `warning: ${warning}`),
        ];
    }

    /** @type {string[]} */
    const lines = [
        'Quota',
        `captured_at: ${quota.captured_at}`,
        `session_id: ${quota.session_id}`,
    ];

    for (const limit of quota.limits ?? []) {
        const resetLabel = limit.resets_at_local
            ? `, resets ${limit.resets_at_local}`
            : '';
        lines.push(
            `${limit.name}: ${formatPercentValue(limit.remaining_percent)} remaining (${formatPercentValue(limit.used_percent)} used${resetLabel})`
        );
    }

    const credits = formatCredits(quota.credits);
    if (credits) {
        lines.push(credits);
    }

    return lines;
}

/**
 * Formats quota credit information.
 *
 * @param {object | undefined} credits Normalized credits data.
 * @returns {string} Credit line or empty string.
 */
function formatCredits(credits) {
    if (!credits?.has_credits) {
        return '';
    }
    if (credits.unlimited) {
        return 'Credits: unlimited';
    }
    if (credits.balance) {
        return `Credits: ${credits.balance}`;
    }
    return 'Credits: available';
}

/**
 * Formats raw and derived totals for the text summary.
 *
 * @param {object} report Structured usage report.
 * @returns {string[]} Summary lines.
 */
function formatSummary(report) {
    return [
        'Summary',
        `observed_token_volume: ${formatInteger(report.totals.observed_token_volume)}`,
        `raw_total_tokens: ${formatInteger(report.totals.raw_total_tokens)}`,
        `effective_input_tokens: ${formatInteger(report.totals.effective_input_tokens)}`,
        `cached_input_tokens: ${formatInteger(report.totals.cached_input_tokens)}`,
        `cache_hit_rate: ${formatPercent(report.totals.cache_hit_rate)}`,
        `output_tokens: ${formatInteger(report.totals.output_tokens)}`,
        `reasoning_output_tokens: ${formatInteger(report.totals.reasoning_output_tokens)}`,
        `session_count: ${formatInteger(report.sessions.length)}`,
    ];
}

/**
 * Formats usage rows as a fixed-width terminal table.
 *
 * @param {object[]} rows Usage rows.
 * @returns {string} Table text.
 */
function formatTable(rows) {
    const widths = columnWidths(rows);
    const header = COLUMNS.map((column) => pad(column, widths[column])).join(
        '  '
    );
    const ruler = COLUMNS.map((column) => '-'.repeat(widths[column])).join(
        '  '
    );
    const body = rows.map((row) =>
        COLUMNS.map((column) =>
            pad(String(row[column] ?? ''), widths[column])
        ).join('  ')
    );

    return [header, ruler, ...body].join('\n');
}

/**
 * Computes column widths for the report table.
 *
 * @param {object[]} rows Usage rows.
 * @returns {Record<string, number>} Width by column name.
 */
function columnWidths(rows) {
    /** @type {Record<string, number>} */
    const widths = Object.fromEntries(
        COLUMNS.map((column) => [column, column.length])
    );

    for (const row of rows) {
        for (const column of COLUMNS) {
            widths[column] = Math.max(
                widths[column],
                String(row[column] ?? '').length
            );
        }
    }

    return widths;
}

/**
 * Pads a cell for table output.
 *
 * @param {string} value Cell value.
 * @param {number} width Target cell width.
 * @returns {string} Padded cell value.
 */
function pad(value, width) {
    return value.padEnd(width, ' ');
}

/**
 * Formats an integer for display.
 *
 * @param {number} value Value to format.
 * @returns {string} Formatted integer.
 */
function formatInteger(value) {
    return Math.round(Number(value ?? 0)).toLocaleString('en-US');
}

/**
 * Formats a rate as a percent.
 *
 * @param {number} value Rate to format.
 * @returns {string} Formatted percent.
 */
function formatPercent(value) {
    return `${(Number(value ?? 0) * 100).toFixed(1)}%`;
}

/**
 * Formats an already-percent value.
 *
 * @param {number} value Percent value.
 * @returns {string} Formatted percent.
 */
function formatPercentValue(value) {
    return `${Number(value ?? 0).toFixed(1)}%`;
}
```

# session-files.js
Source file: `src/session-files.js`.
```javascript
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { SESSION_DIR_NAMES } from './constants.js';

/**
 * Finds Codex JSONL session files that were touched near the requested window.
 *
 * @param {string} codexHome Codex home directory.
 * @param {Date} cutoff Earliest event timestamp to report.
 * @returns {Promise<string[]>} Matching session file paths.
 */
export async function findSessionFiles(codexHome, cutoff) {
    const minMtime = cutoff.getTime() - 60 * 60 * 1000;
    const fileGroups = await Promise.all(
        SESSION_DIR_NAMES.map((dirName) =>
            walkJsonlFiles(join(codexHome, dirName), minMtime)
        )
    );
    const files = fileGroups.flat();

    return files.sort();
}

/**
 * Recursively walks a directory for recent JSONL files.
 *
 * @param {string} dir Directory to inspect.
 * @param {number} minMtime Minimum file modification timestamp in milliseconds.
 * @returns {Promise<string[]>} Matching file paths.
 */
async function walkJsonlFiles(dir, minMtime) {
    /** @type {import('node:fs').Dirent[]} */
    let entries = [];

    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch {
        return [];
    }

    const matchGroups = await Promise.all(
        entries.map((entry) => collectJsonlEntryFiles(dir, entry, minMtime))
    );

    return matchGroups.flat();
}

/**
 * Collects recent JSONL file paths represented by a directory entry.
 *
 * @param {string} dir Parent directory for the entry.
 * @param {import('node:fs').Dirent} entry Directory entry to inspect.
 * @param {number} minMtime Minimum file modification timestamp in milliseconds.
 * @returns {Promise<string[]>} Matching file paths for the entry.
 */
async function collectJsonlEntryFiles(dir, entry, minMtime) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
        return walkJsonlFiles(path, minMtime);
    }
    if (isJsonlFile(entry)) {
        const recentFile = await getRecentFilePath(path, minMtime);
        if (recentFile) {
            return [recentFile];
        }
    }

    return [];
}

/**
 * Checks whether a directory entry is a JSONL file.
 *
 * @param {import('node:fs').Dirent} entry Directory entry.
 * @returns {boolean} True when the entry is a JSONL file.
 */
function isJsonlFile(entry) {
    if (!entry.isFile()) {
        return false;
    }
    return entry.name.endsWith('.jsonl');
}

/**
 * Gets a file path when its mtime is recent enough for the report window.
 *
 * @param {string} path File path to test.
 * @param {number} minMtime Minimum file modification timestamp in milliseconds.
 * @returns {Promise<string | undefined>} File path when it is recent enough.
 */
async function getRecentFilePath(path, minMtime) {
    try {
        const info = await stat(path);
        if (info.mtimeMs >= minMtime) {
            return path;
        }
    } catch {
        // Session files can rotate while the command runs.
    }

    return undefined;
}
```

# session-parser.js
Source file: `src/session-parser.js`.
```javascript
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { TOKEN_FIELDS } from './constants.js';
import { readConfigDefaults } from './settings.js';

/**
 * Parses a Codex session JSONL file into usage rows and quota snapshots.
 *
 * @param {string} file Session JSONL file path.
 * @param {Date} cutoff Earliest event timestamp to report.
 * @param {string} codexHome Codex home directory for config fallback values.
 * @returns {Promise<{ rows: object[], quotaSnapshots: object[], duplicateTokenCountEvents: number }>} Parsed session data.
 */
export async function parseSessionFile(file, cutoff, codexHome) {
    const defaults = await readConfigDefaults(codexHome);
    /** @type {{ model: string, intelligenceLevel: string }} */
    const context = {
        model: defaults.model,
        intelligenceLevel: defaults.intelligenceLevel,
    };
    /** @type {object[]} */
    const rows = [];
    /** @type {object[]} */
    const quotaSnapshots = [];
    /** @type {{ lastTotalUsage: object | undefined, duplicateTokenCountEvents: number }} */
    const usageState = {
        lastTotalUsage: undefined,
        duplicateTokenCountEvents: 0,
    };
    const text = await readFile(file, 'utf8');

    for (const line of text.split(/\r?\n/u)) {
        if (!line.trim()) {
            continue;
        }
        const event = parseJsonLine(line);
        if (!event) {
            continue;
        }
        updateContext(event, context);
        addQuotaSnapshot(event, file, quotaSnapshots);
        addUsageRow(event, context, cutoff, file, rows, usageState);
    }

    return {
        rows,
        quotaSnapshots,
        duplicateTokenCountEvents: usageState.duplicateTokenCountEvents,
    };
}

/**
 * Parses one JSONL line and ignores malformed partial writes.
 *
 * @param {string} line Raw JSONL line.
 * @returns {object | undefined} Parsed event.
 */
function parseJsonLine(line) {
    try {
        return JSON.parse(line);
    } catch {
        return undefined;
    }
}

/**
 * Updates model metadata when the session records it.
 *
 * @param {object} event Parsed session event.
 * @param {{ model: string, intelligenceLevel: string }} context Mutable metadata.
 * @returns {void}
 */
function updateContext(event, context) {
    if (event.type !== 'turn_context' || !event.payload) {
        return;
    }
    context.model = event.payload.model ?? context.model;
    context.intelligenceLevel =
        event.payload.effort ??
        event.payload.collaboration_mode?.settings?.reasoning_effort ??
        context.intelligenceLevel;
}

/**
 * Adds a token usage row when an event is inside the reporting window.
 *
 * @param {object} event Parsed session event.
 * @param {{ model: string, intelligenceLevel: string }} context Current metadata.
 * @param {Date} cutoff Earliest timestamp to report.
 * @param {string} file Source session file.
 * @param {object[]} rows Mutable rows list.
 * @param {{ lastTotalUsage: object | undefined }} usageState Mutable session usage state.
 * @returns {void}
 */
function addUsageRow(event, context, cutoff, file, rows, usageState) {
    const usage = event.payload?.info?.last_token_usage;
    const timestamp = new Date(event.timestamp ?? '');

    if (
        event.type !== 'event_msg' ||
        event.payload?.type !== 'token_count' ||
        !usage
    ) {
        return;
    }
    if (
        !hasAdvancedTotalUsage(
            event.payload.info?.total_token_usage,
            usageState
        )
    ) {
        return;
    }
    if (Number.isNaN(timestamp.getTime()) || timestamp < cutoff) {
        return;
    }

    rows.push({
        timestamp: timestamp.toISOString(),
        model: context.model,
        intelligence_level: context.intelligenceLevel,
        file,
        ...usage,
    });
}

/**
 * Adds a quota snapshot when a token_count event carries rate limits.
 *
 * @param {object} event Parsed session event.
 * @param {string} file Source session file.
 * @param {object[]} quotaSnapshots Mutable quota snapshot list.
 * @returns {void}
 */
function addQuotaSnapshot(event, file, quotaSnapshots) {
    const timestamp = new Date(event.timestamp ?? '');
    const rateLimits = event.payload?.rate_limits;

    if (
        event.type !== 'event_msg' ||
        event.payload?.type !== 'token_count' ||
        !rateLimits
    ) {
        return;
    }
    if (Number.isNaN(timestamp.getTime())) {
        return;
    }

    quotaSnapshots.push({
        timestamp: timestamp.toISOString(),
        file,
        session_id: readSessionId(file),
        rate_limits: rateLimits,
    });
}

/**
 * Checks whether cumulative token totals advanced since the previous event and counts unchanged duplicates.
 *
 * @param {object | undefined} totalUsage Cumulative session token usage.
 * @param {{ lastTotalUsage: object | undefined }} usageState Mutable session usage state.
 * @returns {boolean} True when the last usage row should count.
 */
function hasAdvancedTotalUsage(totalUsage, usageState) {
    if (!totalUsage) {
        return true;
    }

    const currentTotal = totalUsageValue(totalUsage);
    const previousTotal = usageState.lastTotalUsage
        ? totalUsageValue(usageState.lastTotalUsage)
        : undefined;
    usageState.lastTotalUsage = totalUsage;

    if (previousTotal !== undefined && currentTotal <= previousTotal) {
        usageState.duplicateTokenCountEvents += 1;
        return false;
    }

    return true;
}

/**
 * Reads the cumulative token total from a total_token_usage payload.
 *
 * @param {object} totalUsage Cumulative usage payload.
 * @returns {number} Total token count.
 */
function totalUsageValue(totalUsage) {
    const totalTokens = Number(totalUsage.total_tokens);

    if (Number.isFinite(totalTokens)) {
        return totalTokens;
    }

    return TOKEN_FIELDS.reduce(
        (total, field) => total + readNumber(totalUsage[field]),
        0
    );
}

/**
 * Reads a finite number from an unknown value.
 *
 * @param {unknown} value Value to normalize.
 * @returns {number} Finite number or zero.
 */
function readNumber(value) {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
}

/**
 * Extracts the initial session identity from the JSONL filename.
 *
 * @param {string} file Source file path.
 * @returns {string} Session id.
 */
function readSessionId(file) {
    const name = basename(String(file ?? ''));
    return name.endsWith('.jsonl')
        ? name.slice(0, -'.jsonl'.length)
        : name || 'unknown';
}
```

# settings.js
Source file: `src/settings.js`.
```javascript
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Reads default model settings from Codex config when session metadata omits them.
 *
 * @param {string} codexHome Codex home directory.
 * @returns {Promise<{ model: string, intelligenceLevel: string }>} Default labels.
 */
export async function readConfigDefaults(codexHome) {
    const configPath = join(codexHome, 'config.toml');
    /** @type {{ model: string, intelligenceLevel: string }} */
    const defaults = { model: 'unknown', intelligenceLevel: 'unknown' };

    try {
        const text = await readFile(configPath, 'utf8');
        defaults.model = readTomlString(text, 'model') ?? defaults.model;
        defaults.intelligenceLevel =
            readTomlString(text, 'model_reasoning_effort') ??
            defaults.intelligenceLevel;
    } catch {
        // Config is only a fallback; session files remain the source of usage data.
    }

    return defaults;
}

/**
 * Reads a simple top-level TOML string assignment.
 *
 * @param {string} text TOML text.
 * @param {string} key Setting name.
 * @returns {string | undefined} Setting value.
 */
function readTomlString(text, key) {
    const escapedKey = key.replace(
        /[.*+?^${}()|[\]\\]/gu,
        (match) => `\\${match}`
    );
    const pattern = new RegExp(`^\\s*${escapedKey}\\s*=\\s*"([^"]*)"`, 'mu');
    return pattern.exec(text)?.[1];
}
```

# usage-groups.js
Source file: `src/usage-groups.js`.
```javascript
import { TOKEN_FIELDS } from './constants.js';

/**
 * Groups normalized rows into session summaries.
 *
 * @param {object[]} rows Normalized report rows.
 * @returns {object[]} Session summaries.
 */
export function groupSessions(rows) {
    /** @type {Map<string, object[]>} */
    const groupedRows = groupRows(rows, 'session_id');
    /** @type {object[]} */
    const sessions = [];

    for (const [sessionId, sessionRows] of groupedRows.entries()) {
        const sortedRows = [...sessionRows].sort((first, second) =>
            first.timestamp.localeCompare(second.timestamp)
        );
        const totals = summarizeRows(sortedRows);
        sessions.push({
            session_id: sessionId,
            first_timestamp: sortedRows[0]?.timestamp ?? '',
            last_timestamp: sortedRows.at(-1)?.timestamp ?? '',
            event_count: sortedRows.length,
            models: uniqueValues(sortedRows, 'model'),
            intelligence_levels: uniqueValues(sortedRows, 'intelligence_level'),
            input_tokens: totals.input_tokens,
            cached_input_tokens: totals.cached_input_tokens,
            observed_token_volume: totals.observed_token_volume,
            effective_input_tokens: totals.effective_input_tokens,
            output_tokens: totals.output_tokens,
            reasoning_output_tokens: totals.reasoning_output_tokens,
            raw_total_tokens: totals.raw_total_tokens,
            cache_hit_rate: totals.cache_hit_rate,
            max_single_event_observed_token_volume: maxValue(
                sortedRows,
                'observed_token_volume'
            ),
            source_file: sortedRows[0]?.file ?? '',
        });
    }

    return sessions.sort((first, second) =>
        first.first_timestamp.localeCompare(second.first_timestamp)
    );
}

/**
 * Groups normalized rows into model summaries.
 *
 * @param {object[]} rows Normalized report rows.
 * @returns {object[]} Model summaries.
 */
export function groupModels(rows) {
    /** @type {Map<string, object[]>} */
    const groupedRows = groupRows(rows, 'model');
    /** @type {object[]} */
    const models = [];

    for (const [model, modelRows] of groupedRows.entries()) {
        const totals = summarizeRows(modelRows);
        models.push({
            model,
            event_count: modelRows.length,
            sessions: uniqueValues(modelRows, 'session_id'),
            intelligence_levels: uniqueValues(modelRows, 'intelligence_level'),
            input_tokens: totals.input_tokens,
            cached_input_tokens: totals.cached_input_tokens,
            observed_token_volume: totals.observed_token_volume,
            effective_input_tokens: totals.effective_input_tokens,
            output_tokens: totals.output_tokens,
            reasoning_output_tokens: totals.reasoning_output_tokens,
            raw_total_tokens: totals.raw_total_tokens,
            cache_hit_rate: totals.cache_hit_rate,
            reasoning_output_rate: totals.reasoning_output_rate,
        });
    }

    return models.sort(
        (first, second) =>
            second.observed_token_volume - first.observed_token_volume ||
            first.model.localeCompare(second.model)
    );
}

/**
 * Groups rows by a string field.
 *
 * @param {object[]} rows Rows to group.
 * @param {string} field Field name.
 * @returns {Map<string, object[]>} Grouped rows.
 */
function groupRows(rows, field) {
    /** @type {Map<string, object[]>} */
    const groups = new Map();

    for (const row of rows) {
        const key = String(row[field] ?? 'unknown');
        const groupRowsForKey = groups.get(key) ?? [];
        groupRowsForKey.push(row);
        groups.set(key, groupRowsForKey);
    }

    return groups;
}

/**
 * Reads unique string values for a row field.
 *
 * @param {object[]} rows Rows to inspect.
 * @param {string} field Field name.
 * @returns {string[]} Unique values in sorted order.
 */
function uniqueValues(rows, field) {
    return [
        ...new Set(rows.map((row) => String(row[field] ?? 'unknown'))),
    ].sort();
}

/**
 * Finds the maximum numeric value for a field.
 *
 * @param {object[]} rows Rows to inspect.
 * @param {string} field Field name.
 * @returns {number} Maximum value or zero.
 */
function maxValue(rows, field) {
    return rows.reduce((max, row) => Math.max(max, Number(row[field] ?? 0)), 0);
}

/**
 * Summarizes row token fields for grouping modules without importing report builders.
 *
 * @param {object[]} rows Rows to summarize.
 * @returns {Record<string, number>} Token summary.
 */
function summarizeRows(rows) {
    /** @type {Record<string, number>} */
    const totals = Object.fromEntries(TOKEN_FIELDS.map((field) => [field, 0]));
    totals.observed_token_volume = 0;
    totals.effective_input_tokens = 0;
    totals.visible_output_tokens = 0;

    for (const row of rows) {
        for (const field of TOKEN_FIELDS) {
            totals[field] += Number(row[field] ?? 0);
        }
        totals.observed_token_volume += Number(row.observed_token_volume ?? 0);
        totals.effective_input_tokens += Number(
            row.effective_input_tokens ?? 0
        );
        totals.visible_output_tokens += Number(row.visible_output_tokens ?? 0);
    }

    totals.cache_hit_rate = rate(
        totals.cached_input_tokens,
        totals.input_tokens
    );
    totals.reasoning_output_rate = rate(
        totals.reasoning_output_tokens,
        totals.output_tokens
    );
    return totals;
}

/**
 * Computes a guarded rate.
 *
 * @param {number} numerator Rate numerator.
 * @param {number} denominator Rate denominator.
 * @returns {number} Rate or zero when the denominator is unavailable.
 */
function rate(numerator, denominator) {
    if (!Number.isFinite(denominator) || denominator <= 0) {
        return 0;
    }
    return numerator / denominator;
}
```

# usage-insights.js
Source file: `src/usage-insights.js`.
```javascript
import {
    LARGE_EVENT_TOKEN_THRESHOLD,
    LARGE_INPUT_TOKEN_THRESHOLD,
} from './constants.js';

/**
 * Builds report insights from normalized rows and grouped summaries.
 *
 * @param {object} report Structured report model.
 * @returns {object[]} Warning and notice records.
 */
export function buildInsights(report) {
    /** @type {object[]} */
    const insights = [];

    if (report.rows.length === 0) {
        insights.push(
            createInsight(
                'warning',
                'no_rows',
                'No token usage events were found in the selected window.'
            )
        );
    }

    addQuotaWarnings(report, insights);
    addDuplicateNotice(report, insights);
    addUnknownMetadataWarnings(report.rows, insights);
    addLargeEventWarnings(report.rows, insights);
    addSessionNotices(report.sessions, insights);

    return insights;
}

/**
 * Adds warnings for missing or stale quota data.
 *
 * @param {object} report Structured report model.
 * @param {object[]} insights Mutable insights list.
 * @returns {void}
 */
function addQuotaWarnings(report, insights) {
    if (!report.quota?.available) {
        insights.push(
            createInsight(
                'warning',
                'quota_unavailable',
                'Quota information is unavailable for this report.'
            )
        );
        return;
    }

    const capturedAt = new Date(String(report.quota.captured_at ?? ''));
    const reportEnd = new Date(String(report.window?.now ?? ''));
    const staleMilliseconds = 10 * 60 * 1000;

    if (
        !Number.isNaN(capturedAt.getTime()) &&
        !Number.isNaN(reportEnd.getTime()) &&
        reportEnd.getTime() - capturedAt.getTime() > staleMilliseconds
    ) {
        insights.push(
            createInsight(
                'warning',
                'stale_quota_snapshot',
                'The quota snapshot is more than 10 minutes older than the report end.',
                {
                    captured_at: report.quota.captured_at,
                    report_end: report.window.now,
                }
            )
        );
    }
}

/**
 * Adds a notice when duplicate token count events were ignored.
 *
 * @param {object} report Structured report model.
 * @param {object[]} insights Mutable insights list.
 * @returns {void}
 */
function addDuplicateNotice(report, insights) {
    const count = Number(
        report.metadata?.duplicate_token_count_events_ignored ?? 0
    );

    if (count > 0) {
        insights.push(
            createInsight(
                'notice',
                'duplicate_token_count_events_ignored',
                'Duplicate token_count events were ignored because total_token_usage was unchanged.',
                {
                    count,
                }
            )
        );
    }
}

/**
 * Adds warnings for unknown model or intelligence level values.
 *
 * @param {object[]} rows Normalized report rows.
 * @param {object[]} insights Mutable insights list.
 * @returns {void}
 */
function addUnknownMetadataWarnings(rows, insights) {
    if (rows.some((row) => row.model === 'unknown')) {
        insights.push(
            createInsight(
                'warning',
                'unknown_model',
                'At least one event has an unknown model.'
            )
        );
    }

    if (rows.some((row) => row.intelligence_level === 'unknown')) {
        insights.push(
            createInsight(
                'warning',
                'unknown_intelligence_level',
                'At least one event has an unknown intelligence level.'
            )
        );
    }
}

/**
 * Adds warnings for cache efficiency and unusually large events.
 *
 * @param {object[]} rows Normalized report rows.
 * @param {object[]} insights Mutable insights list.
 * @returns {void}
 */
function addLargeEventWarnings(rows, insights) {
    const lowCacheRows = rows.filter(
        (row) =>
            Number(row.input_tokens ?? 0) >= LARGE_INPUT_TOKEN_THRESHOLD &&
            Number(row.cache_hit_rate ?? 0) < 0.5
    );
    const largeRows = rows.filter(
        (row) =>
            Number(row.observed_token_volume ?? 0) > LARGE_EVENT_TOKEN_THRESHOLD
    );

    if (lowCacheRows.length > 0) {
        insights.push(
            createInsight(
                'warning',
                'low_cache_hit_rate',
                'A large input event has a cache hit rate below 50%.',
                {
                    count: lowCacheRows.length,
                    threshold_input_tokens: LARGE_INPUT_TOKEN_THRESHOLD,
                }
            )
        );
    }

    if (largeRows.length > 0) {
        insights.push(
            createInsight(
                'warning',
                'large_event_observed_token_volume',
                'At least one event exceeds 100k observed token volume.',
                {
                    count: largeRows.length,
                    threshold_observed_token_volume:
                        LARGE_EVENT_TOKEN_THRESHOLD,
                }
            )
        );
    }
}

/**
 * Adds notices for multi-session windows and changing metadata inside sessions.
 *
 * @param {object[]} sessions Session summaries.
 * @param {object[]} insights Mutable insights list.
 * @returns {void}
 */
function addSessionNotices(sessions, insights) {
    if (sessions.length > 1) {
        insights.push(
            createInsight(
                'notice',
                'multiple_sessions',
                'Multiple sessions appear in this report window.',
                {
                    count: sessions.length,
                }
            )
        );
    }

    for (const session of sessions) {
        if (session.models.length > 1) {
            insights.push(
                createInsight(
                    'notice',
                    'session_model_change',
                    'A session uses more than one model.',
                    {
                        session_id: session.session_id,
                        models: session.models,
                    }
                )
            );
        }

        if (session.intelligence_levels.length > 1) {
            insights.push(
                createInsight(
                    'notice',
                    'session_intelligence_level_change',
                    'A session uses more than one intelligence level.',
                    {
                        session_id: session.session_id,
                        intelligence_levels: session.intelligence_levels,
                    }
                )
            );
        }
    }
}

/**
 * Creates an insight record with stable key order.
 *
 * @param {string} severity Insight severity.
 * @param {string} code Stable insight code.
 * @param {string} message Human-readable message.
 * @param {object} [details] Optional detail object.
 * @returns {object} Insight record.
 */
function createInsight(severity, code, message, details = {}) {
    return { severity, code, message, details };
}
```

# usage-loader.js
Source file: `src/usage-loader.js`.
```javascript
import { findSessionFiles } from './session-files.js';
import { parseSessionFile } from './session-parser.js';

/**
 * Loads usage rows and quota snapshots from recent Codex session files.
 *
 * @param {string} codexHome Codex home directory.
 * @param {Date} cutoff Earliest event timestamp to report.
 * @returns {Promise<{ rows: object[], quotaSnapshots: object[], duplicateTokenCountEvents: number }>} Sorted session data.
 */
export async function loadUsageData(codexHome, cutoff) {
    const files = await findSessionFiles(codexHome, cutoff);
    /** @type {object[]} */
    const rows = [];
    /** @type {object[]} */
    const quotaSnapshots = [];
    let duplicateTokenCountEvents = 0;

    const parsedFiles = await Promise.all(
        files.map((file) => parseUsageFile(file, cutoff, codexHome))
    );

    for (const parsed of parsedFiles) {
        rows.push(...parsed.rows);
        quotaSnapshots.push(...parsed.quotaSnapshots);
        duplicateTokenCountEvents += Number(
            parsed.duplicateTokenCountEvents ?? 0
        );
    }

    return {
        rows: rows.sort((first, second) =>
            first.timestamp.localeCompare(second.timestamp)
        ),
        quotaSnapshots: quotaSnapshots.sort((first, second) =>
            first.timestamp.localeCompare(second.timestamp)
        ),
        duplicateTokenCountEvents,
    };
}

/**
 * Parses one session file and returns an empty result if the file changes mid-read.
 *
 * @param {string} file Session file path.
 * @param {Date} cutoff Earliest event timestamp to report.
 * @param {string} codexHome Codex home directory.
 * @returns {Promise<{ rows: object[], quotaSnapshots: object[], duplicateTokenCountEvents: number }>} Parsed session data.
 */
async function parseUsageFile(file, cutoff, codexHome) {
    try {
        return await parseSessionFile(file, cutoff, codexHome);
    } catch {
        // Session files can be rewritten by Codex while they are being read.
        return {
            rows: [],
            quotaSnapshots: [],
            duplicateTokenCountEvents: 0,
        };
    }
}

/**
 * Loads only usage rows for callers that do not need quota data.
 *
 * @param {string} codexHome Codex home directory.
 * @param {Date} cutoff Earliest event timestamp to report.
 * @returns {Promise<object[]>} Sorted usage rows.
 */
export async function loadUsageRows(codexHome, cutoff) {
    return (await loadUsageData(codexHome, cutoff)).rows;
}
```

# usage-metrics.js
Source file: `src/usage-metrics.js`.
```javascript
import { DERIVED_TOKEN_FIELDS, TOKEN_FIELDS } from './constants.js';
import { buildQuotaReport } from './quota-snapshot.js';
import { groupModels, groupSessions } from './usage-groups.js';
import { buildInsights } from './usage-insights.js';
import { normalizeUsageRows } from './usage-normalizer.js';

/**
 * Builds the structured report model consumed by every renderer.
 *
 * @param {{ rows: object[], quotaSnapshots?: object[], duplicateTokenCountEvents?: number, cutoff: Date, now: Date, minutes: number, codexHome: string, format: string }} input Report inputs.
 * @returns {object} Structured usage report.
 */
export function buildUsageReport(input) {
    const rows = normalizeUsageRows(input.rows);
    const totals = buildTotals(rows);
    const sessions = groupSessions(rows);
    const models = groupModels(rows);
    const quota = buildQuotaReport({
        snapshots: input.quotaSnapshots ?? [],
        cutoff: input.cutoff,
        now: input.now,
    });
    const report = {
        window: {
            cutoff: input.cutoff.toISOString(),
            now: input.now.toISOString(),
            minutes: input.minutes,
        },
        rows,
        totals,
        quota,
        sessions,
        models,
        insights: [],
        metadata: {
            generated_at: new Date().toISOString(),
            codex_home: input.codexHome,
            format: input.format,
            row_count: rows.length,
            session_count: sessions.length,
            duplicate_token_count_events_ignored: Number(
                input.duplicateTokenCountEvents ?? 0
            ),
        },
    };

    report.insights = buildInsights(report);
    return report;
}

/**
 * Builds raw token totals, derived aggregate totals, and derived rates.
 *
 * @param {object[]} rows Normalized report rows.
 * @returns {Record<string, number>} Token totals and rates.
 */
export function buildTotals(rows) {
    /** @type {Record<string, number>} */
    const totals = Object.fromEntries(
        [...TOKEN_FIELDS, ...DERIVED_TOKEN_FIELDS].map((field) => [field, 0])
    );

    for (const row of rows) {
        for (const field of TOKEN_FIELDS) {
            totals[field] += Number(row[field] ?? 0);
        }
        totals.observed_token_volume += Number(row.observed_token_volume ?? 0);
        totals.effective_input_tokens += Number(
            row.effective_input_tokens ?? 0
        );
        totals.visible_output_tokens += Number(row.visible_output_tokens ?? 0);
    }

    totals.cache_hit_rate = rate(
        totals.cached_input_tokens,
        totals.input_tokens
    );
    totals.reasoning_output_rate = rate(
        totals.reasoning_output_tokens,
        totals.output_tokens
    );
    return totals;
}

/**
 * Computes a guarded rate.
 *
 * @param {number} numerator Rate numerator.
 * @param {number} denominator Rate denominator.
 * @returns {number} Rate or zero when the denominator is unavailable.
 */
export function rate(numerator, denominator) {
    if (!Number.isFinite(denominator) || denominator <= 0) {
        return 0;
    }
    return numerator / denominator;
}
```

# usage-normalizer.js
Source file: `src/usage-normalizer.js`.
```javascript
import { basename } from 'node:path';
import { DERIVED_TOKEN_FIELDS, TOKEN_FIELDS } from './constants.js';

/**
 * Normalizes parsed usage rows into the structured event shape used by reports.
 *
 * @param {object[]} rows Parsed usage rows from session files.
 * @returns {object[]} Normalized rows with derived metrics and session position fields.
 */
export function normalizeUsageRows(rows) {
    /** @type {Map<string, object[]>} */
    const rowsBySession = new Map();
    const normalizedRows = rows
        .map(normalizeUsageRow)
        .sort((first, second) =>
            first.timestamp.localeCompare(second.timestamp)
        );

    for (const row of normalizedRows) {
        const sessionRows = rowsBySession.get(row.session_id) ?? [];
        sessionRows.push(row);
        rowsBySession.set(row.session_id, sessionRows);
    }

    for (const sessionRows of rowsBySession.values()) {
        applySessionPositionFields(sessionRows);
    }

    return normalizedRows;
}

/**
 * Normalizes one parsed usage row and fills missing token fields with zero.
 *
 * @param {object} row Parsed usage row.
 * @returns {object} Normalized usage row.
 */
function normalizeUsageRow(row) {
    /** @type {Record<string, number>} */
    const tokenValues = {};

    for (const field of TOKEN_FIELDS) {
        tokenValues[field] =
            field === 'raw_total_tokens'
                ? readNumber(row.raw_total_tokens ?? row.total_tokens)
                : readNumber(row[field]);
    }

    const observedTokenVolume =
        tokenValues.input_tokens + tokenValues.output_tokens;
    const effectiveInputTokens =
        tokenValues.input_tokens - tokenValues.cached_input_tokens;
    const visibleOutputTokens =
        tokenValues.output_tokens - tokenValues.reasoning_output_tokens;
    const cacheHitRate = rate(
        tokenValues.cached_input_tokens,
        tokenValues.input_tokens
    );
    const reasoningOutputRate = rate(
        tokenValues.reasoning_output_tokens,
        tokenValues.output_tokens
    );

    return {
        timestamp: String(row.timestamp ?? ''),
        model: String(row.model ?? 'unknown'),
        intelligence_level: String(row.intelligence_level ?? 'unknown'),
        file: String(row.file ?? ''),
        ...tokenValues,
        observed_token_volume: observedTokenVolume,
        effective_input_tokens: effectiveInputTokens,
        visible_output_tokens: visibleOutputTokens,
        cache_hit_rate: cacheHitRate,
        reasoning_output_rate: reasoningOutputRate,
        session_id: readSessionId(row.file),
        turn_index: 0,
        seconds_since_previous: null,
    };
}

/**
 * Adds turn indexes and elapsed time between rows in one session.
 *
 * @param {object[]} rows Normalized rows for one session.
 * @returns {void}
 */
function applySessionPositionFields(rows) {
    rows.sort((first, second) =>
        first.timestamp.localeCompare(second.timestamp)
    );

    for (let index = 0; index < rows.length; index += 1) {
        const previousRow = rows[index - 1];
        const row = rows[index];
        row.turn_index = index + 1;
        row.seconds_since_previous = previousRow
            ? secondsBetween(previousRow.timestamp, row.timestamp)
            : null;
    }
}

/**
 * Reads a finite number from a parsed row field.
 *
 * @param {unknown} value Value to normalize.
 * @returns {number} Finite number or zero.
 */
function readNumber(value) {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
}

/**
 * Computes a guarded rate.
 *
 * @param {number} numerator Rate numerator.
 * @param {number} denominator Rate denominator.
 * @returns {number} Rate or zero when the denominator is unavailable.
 */
function rate(numerator, denominator) {
    if (!Number.isFinite(denominator) || denominator <= 0) {
        return 0;
    }
    return numerator / denominator;
}

/**
 * Extracts the initial session identity from the JSONL filename.
 *
 * @param {unknown} file Source file path.
 * @returns {string} Session id.
 */
function readSessionId(file) {
    const name = basename(String(file ?? ''));
    return name.endsWith('.jsonl')
        ? name.slice(0, -'.jsonl'.length)
        : name || 'unknown';
}

/**
 * Computes elapsed seconds between two ISO timestamps.
 *
 * @param {string} firstTimestamp Earlier timestamp.
 * @param {string} secondTimestamp Later timestamp.
 * @returns {number | null} Elapsed seconds or null when unavailable.
 */
function secondsBetween(firstTimestamp, secondTimestamp) {
    const first = new Date(firstTimestamp);
    const second = new Date(secondTimestamp);

    if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) {
        return null;
    }

    return Math.max(0, Math.round((second.getTime() - first.getTime()) / 1000));
}

export { DERIVED_TOKEN_FIELDS };
```

# usage-report.js
Source file: `src/usage-report.js`.
```javascript
import { TOKEN_FIELDS } from './constants.js';

const COLUMNS = ['timestamp', 'model', 'intelligence_level', ...TOKEN_FIELDS];

/**
 * Prints the full usage report.
 *
 * @param {{ rows: object[], totals: Record<string, number>, cutoff: Date, now: Date }} report Report data.
 * @returns {void}
 */
export function printUsageReport(report) {
    console.log(
        `Codex token usage from ${report.cutoff.toISOString()} to ${report.now.toISOString()}`
    );

    if (report.rows.length === 0) {
        console.log('\nNo token usage events found in the selected window.');
        printTotals(report.totals);
        return;
    }

    console.log('');
    console.log(formatTable(report.rows));
    printTotals(report.totals);
}

/**
 * Formats usage rows as a fixed-width terminal table.
 *
 * @param {object[]} rows Usage rows.
 * @returns {string} Table text.
 */
function formatTable(rows) {
    const widths = columnWidths(rows);
    const header = COLUMNS.map((column) => pad(column, widths[column])).join(
        '  '
    );
    const ruler = COLUMNS.map((column) => '-'.repeat(widths[column])).join(
        '  '
    );
    const body = rows.map((row) =>
        COLUMNS.map((column) =>
            pad(String(row[column] ?? ''), widths[column])
        ).join('  ')
    );

    return [header, ruler, ...body].join('\n');
}

/**
 * Computes column widths for the report table.
 *
 * @param {object[]} rows Usage rows.
 * @returns {Record<string, number>} Width by column name.
 */
function columnWidths(rows) {
    /** @type {Record<string, number>} */
    const widths = Object.fromEntries(
        COLUMNS.map((column) => [column, column.length])
    );

    for (const row of rows) {
        for (const column of COLUMNS) {
            widths[column] = Math.max(
                widths[column],
                String(row[column] ?? '').length
            );
        }
    }

    return widths;
}

/**
 * Pads a cell for table output.
 *
 * @param {string} value Cell value.
 * @param {number} width Target cell width.
 * @returns {string} Padded cell value.
 */
function pad(value, width) {
    return value.padEnd(width, ' ');
}

/**
 * Prints token column totals and corrected derived totals.
 *
 * @param {Record<string, number>} totals Token totals.
 * @returns {void}
 */
function printTotals(totals) {
    console.log('\nTotals');
    for (const field of TOKEN_FIELDS) {
        console.log(`${field}: ${totals[field]}`);
    }
    console.log(`effective_input_tokens: ${totals.effective_input_tokens}`);
    console.log(`visible_output_tokens: ${totals.visible_output_tokens}`);
    console.log(`cache_hit_rate: ${totals.cache_hit_rate}`);
    console.log(`reasoning_output_rate: ${totals.reasoning_output_rate}`);
}
```

# usage-totals.js
Source file: `src/usage-totals.js`.
```javascript
import { TOKEN_FIELDS } from './constants.js';
import { rate } from './usage-metrics.js';

/**
 * Builds corrected token totals and derived rates.
 *
 * @param {object[]} rows Usage rows.
 * @returns {Record<string, number>} Token totals.
 */
export function buildTotals(rows) {
    /** @type {Record<string, number>} */
    const totals = Object.fromEntries(TOKEN_FIELDS.map((field) => [field, 0]));
    totals.effective_input_tokens = 0;
    totals.visible_output_tokens = 0;

    for (const row of rows) {
        for (const field of TOKEN_FIELDS) {
            totals[field] += Number(row[field] ?? 0);
        }
        totals.effective_input_tokens += Number(
            row.effective_input_tokens ?? 0
        );
        totals.visible_output_tokens += Number(row.visible_output_tokens ?? 0);
    }

    totals.cache_hit_rate = rate(
        totals.cached_input_tokens,
        totals.input_tokens
    );
    totals.reasoning_output_rate = rate(
        totals.reasoning_output_tokens,
        totals.output_tokens
    );
    return totals;
}
```
