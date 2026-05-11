#!/usr/bin/env node

import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
    DEFAULT_CODEX_HOME,
    DEFAULT_DATA_PATH,
    DEFAULT_HISTORY_RELATIVE_PATH,
    DEFAULT_WINDOW_MINUTES,
} from './constants.js';
import { renderHtmlReport } from './report-html.js';
import { renderJsonReport } from './report-json.js';
import { renderTextReport } from './report-text.js';
import { readAppEnvironment } from './settings.js';
import { loadUsageData } from './usage-loader.js';
import { buildUsageReport } from './usage-metrics.js';

/**
 * @typedef {object} RuntimeOptions
 * @property {string} codexHome Codex home folder to scan.
 * @property {string} dataPath Root folder used for app-managed data files.
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
        dataPath: DEFAULT_DATA_PATH,
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
    const options = await loadRuntimeOptions(parseArgs(process.argv.slice(2)));

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
        await appendHistory(report, getHistoryPath(options));
    }

    if (options.out) {
        await writeFile(options.out, output, 'utf8');
        return;
    }

    process.stdout.write(output);
}

/**
 * Reads environment settings and merges them into parsed CLI options.
 *
 * @param {RuntimeOptions} options Parsed runtime options.
 * @returns {Promise<RuntimeOptions>} Runtime options with environment defaults.
 */
async function loadRuntimeOptions(options) {
    const environment = await readAppEnvironment();

    return {
        ...options,
        dataPath: environment.dataPath,
    };
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
 * Gets the configured history path for a report run.
 *
 * @param {RuntimeOptions} options Runtime options.
 * @returns {string} Explicit or default history path.
 */
function getHistoryPath(options) {
    return (
        options.history ?? join(options.dataPath, DEFAULT_HISTORY_RELATIVE_PATH)
    );
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
