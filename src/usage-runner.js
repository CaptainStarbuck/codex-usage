import { mkdir, writeFile } from 'node:fs/promises';

import { DEFAULT_DATA_PATH } from './constants.js';
import { appendHistorySnapshot } from './history-writer.js';
import {
    dirnameConfiguredPath,
    normalizeConfiguredOutputPath,
    resolveConfiguredFileDestination,
} from './path-utils.js';
import { renderReport } from './report-renderer.js';
import { loadUsageData } from './usage-loader.js';
import { buildUsageReport } from './usage-metrics.js';

/**
 * @typedef {object} RunOptions
 * @property {string} codexHome Codex home folder to scan.
 * @property {string | undefined} dataPath Root folder used for app-managed data files.
 * @property {string} datetimeFormat HTML report datetime display format.
 * @property {boolean} forceRefresh Whether HTML output should include the calculated refresh timer.
 * @property {string} format Output format.
 * @property {string | undefined} history Optional history output path.
 * @property {number | undefined} interval Optional regeneration interval in seconds.
 * @property {number} minutes Report window length in minutes.
 * @property {string | undefined} out Optional output file path.
 * @property {boolean} saveHistory Whether to append a history snapshot.
 * @property {string} stylesPath HTML report stylesheet path.
 */

/**
 * Coordinates one load, total, optional history capture, and render cycle.
 *
 * @param {RunOptions} options Runtime options.
 * @returns {Promise<void>} Resolves after the report is written or printed.
 */
export async function runOnce(options) {
    const now = new Date();
    const cutoff = new Date(now.getTime() - options.minutes * 60 * 1000);
    const outputPath = options.out
        ? resolveOutputFilePath(options.out, options)
        : undefined;
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
        await appendHistorySnapshot(report, options);
    }

    if (outputPath) {
        await writeOutputFile(outputPath, output);
        return;
    }

    process.stdout.write(output);
}

/**
 * Resolves and validates the configured report output path.
 *
 * @param {string} outPath User-provided output path.
 * @param {RunOptions} options Runtime options.
 * @returns {string} Validated output file path.
 */
function resolveOutputFilePath(outPath, options) {
    const configuredOutputPath = resolveConfiguredFileDestination(
        outPath,
        options.dataPath ?? DEFAULT_DATA_PATH
    );

    return normalizeConfiguredOutputPath(
        configuredOutputPath,
        dirnameConfiguredPath(configuredOutputPath)
    );
}

/**
 * Writes rendered output to a validated output file.
 *
 * @param {string} outputPath Validated output file path.
 * @param {string} output Rendered report output.
 * @returns {Promise<void>} Resolves after the output file is written.
 */
async function writeOutputFile(outputPath, output) {
    await mkdir(dirnameConfiguredPath(outputPath), { recursive: true });
    await writeFile(outputPath, output, 'utf8');
}

/**
 * Repeats report generation until a terminal keypress asks the loop to stop.
 *
 * @param {RunOptions} options Runtime options.
 * @returns {Promise<void>} Resolves after the loop stops.
 */
export async function runInterval(options) {
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
 * @param {RunOptions} options Runtime options.
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
