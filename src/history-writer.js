import { appendFile, mkdir } from 'node:fs/promises';

import { DEFAULT_DATA_PATH, DEFAULT_HISTORY_FILE_NAME } from './constants.js';
import {
    dirnameConfiguredPath,
    resolveConfiguredFileDestination,
    resolveConfiguredPath,
} from './path-utils.js';

/**
 * @typedef {object} HistoryOptions
 * @property {string | undefined} dataPath Root folder used for app-managed data files.
 * @property {string | undefined} history Optional history output path.
 */

/**
 * Appends a compact history snapshot for later local trend reporting.
 *
 * @param {object} report Structured usage report.
 * @param {HistoryOptions} options Runtime options that identify the destination path.
 * @returns {Promise<void>} Resolves after the snapshot is appended.
 */
export async function appendHistorySnapshot(report, options) {
    const safePath = resolveHistoryPath(getHistoryPath(options));
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

    await mkdir(dirnameConfiguredPath(safePath), { recursive: true });
    await appendFile(safePath, `${JSON.stringify(snapshot)}\n`, 'utf8');
}

/**
 * Gets the configured history path for a report run.
 *
 * @param {HistoryOptions} options Runtime options that may include explicit paths.
 * @returns {string} Explicit or default history path.
 */
function getHistoryPath(options) {
    return resolveConfiguredFileDestination(
        options.history ?? DEFAULT_HISTORY_FILE_NAME,
        options.dataPath ?? DEFAULT_DATA_PATH
    );
}

/**
 * Resolves a history path to its absolute destination.
 *
 * @param {string} historyPath User-provided or default path.
 * @returns {string} Absolute history path.
 */
function resolveHistoryPath(historyPath) {
    return resolveConfiguredPath(historyPath);
}
