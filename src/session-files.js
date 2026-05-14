import { readdir, stat } from 'node:fs/promises';
import { SESSION_DIR_NAMES } from './constants.js';
import { joinConfiguredPath } from './path-utils.js';

/**
 * Finds Codex JSONL session files that were touched near the requested window.
 *
 * @param {string} codexHome Codex home directory.
 * @param {Date} cutoff Earliest event timestamp to report.
 * @param {number} maxFiles Maximum session files allowed after scanning, or 0.
 * @returns {Promise<string[]>} Matching session file paths.
 */
export async function findSessionFiles(codexHome, cutoff, maxFiles = 0) {
    const minMtime = cutoff.getTime() - 60 * 60 * 1000;
    const fileGroups = await Promise.all(
        SESSION_DIR_NAMES.map((dirName) =>
            walkJsonlFiles(joinConfiguredPath(codexHome, dirName), minMtime)
        )
    );
    const files = fileGroups.flat();

    enforceFileLimit(files.length, maxFiles);
    return files.sort();
}

/**
 * Throws when file scanning finds more session files than the configured limit.
 *
 * @param {number} actual Actual file count.
 * @param {number} limit Configured file limit, or 0 for unlimited.
 * @returns {void}
 */
function enforceFileLimit(actual, limit) {
    if (limit === 0 || actual <= limit) {
        return;
    }

    throw new Error(
        `Report detail limit exceeded: session file scan would include ${actual} files, above --max-files=${limit}. Increase --max-files or MAX_FILES to render this report.`
    );
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
    let entries;

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
    const path = joinConfiguredPath(dir, entry.name);
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
