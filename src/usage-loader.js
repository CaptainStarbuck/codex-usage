import { findSessionFiles } from './session-files.js';
import { parseSessionFile } from './session-parser.js';

/**
 * Loads usage rows and quota snapshots from recent Codex session files.
 *
 * @param {string} codexHome Codex home directory.
 * @param {Date} cutoff Earliest timestamp used to reduce the file scan.
 * @param {number} maxFiles Maximum session files allowed after scanning, or 0.
 * @returns {Promise<{ rows: object[], quotaSnapshots: object[], duplicateTokenCountEvents: number }>} Sorted session data.
 */
export async function loadUsageData(codexHome, cutoff, maxFiles = 0) {
    const files = await findSessionFiles(codexHome, cutoff, maxFiles);
    /** @type {object[]} */
    const rows = [];
    /** @type {object[]} */
    const quotaSnapshots = [];
    let duplicateTokenCountEvents = 0;

    const parsedFiles = await Promise.all(
        files.map((file) => parseUsageFile(file, codexHome))
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
 * @param {string} codexHome Codex home directory.
 * @returns {Promise<{ rows: object[], quotaSnapshots: object[], duplicateTokenCountEvents: number }>} Parsed session data.
 */
async function parseUsageFile(file, codexHome) {
    try {
        return await parseSessionFile(file, codexHome);
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
    return (await loadUsageData(codexHome, cutoff, 0)).rows;
}
