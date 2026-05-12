# codex-usage.js
Source file: `src/codex-usage.js`.
```javascript
#!/usr/bin/env node

import { mkdir } from 'node:fs/promises';

import { DEFAULT_WINDOW_MINUTES } from './constants.js';
import {
    normalizeConfiguredOutputPath,
    resolveConfiguredPath,
} from './path-utils.js';
import { readAppEnvironment } from './settings.js';
import { runInterval, runOnce } from './usage-runner.js';

/**
 * @typedef {object} ParsedRuntimeOptions
 * @property {string | undefined} codexHome Codex home folder to scan.
 * @property {string | undefined} dataPath Root folder used for app-managed data files.
 * @property {boolean} forceRefresh Whether HTML output should include the calculated refresh timer.
 * @property {string} format Output format.
 * @property {string | undefined} history Optional history output path.
 * @property {number | undefined} interval Optional regeneration interval in seconds.
 * @property {number} minutes Report window length in minutes.
 * @property {string | undefined} out Optional output file path.
 * @property {boolean} saveHistory Whether to append a history snapshot.
 */

/**
 * @typedef {ParsedRuntimeOptions & { codexHome: string, dataPath: string }} RuntimeOptions
 */

/**
 * Parses CLI arguments for report loading and rendering.
 *
 * @param {string[]} args Raw process arguments after the executable name.
 * @returns {ParsedRuntimeOptions} Runtime options from CLI arguments.
 */
function parseArgs(args) {
    /** @type {ParsedRuntimeOptions} */
    const options = {
        codexHome: undefined,
        dataPath: undefined,
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
        } else if (arg === '--data-path') {
            if (!args[index + 1]) {
                continue;
            }
            options.dataPath = args[index + 1];
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
    console.log(`Usage: node src/codex-usage.js [--minutes 15] [--codex-home /home/codex/.codex] [--data-path /tmp/codex-usage] [--format text|json|html] [--out path] [--interval seconds] [--force-refresh] [--save-history] [--history path]

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
 * Reads environment settings and merges them into parsed CLI options.
 *
 * @param {ParsedRuntimeOptions} options Parsed runtime options.
 * @returns {Promise<RuntimeOptions>} Runtime options with environment defaults.
 */
async function loadRuntimeOptions(options) {
    const environment = await readAppEnvironment();
    const dataPath = normalizeConfiguredOutputPath(
        options.dataPath ?? environment.dataPath,
        options.dataPath ?? environment.dataPath
    );

    await mkdir(resolveConfiguredPath(dataPath), { recursive: true });

    return {
        ...options,
        codexHome: options.codexHome ?? environment.codexHome,
        dataPath,
    };
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

export const DEFAULT_DATA_PATH = '/tmp/codex-usage';
export const DATA_PATH_WINDOWS_DEFAULT = 'C:\\Temp\\codex-usage';
export const DEFAULT_CODEX_HOME = join(homedir(), '.codex');
export const DEFAULT_HISTORY_FILE_NAME = 'history.jsonl';
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

# history-writer.js
Source file: `src/history-writer.js`.
```javascript
import { appendFile, mkdir } from 'node:fs/promises';

import { DEFAULT_DATA_PATH, DEFAULT_HISTORY_FILE_NAME } from './constants.js';
import {
    dirnameConfiguredPath,
    normalizeConfiguredOutputPath,
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
    const historyPath = getHistoryPath(options);
    const safePath = resolveHistoryPath(
        normalizeConfiguredOutputPath(
            historyPath,
            dirnameConfiguredPath(historyPath)
        )
    );
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
```

# path-utils.js
Source file: `src/path-utils.js`.
```javascript
import { platform } from 'node:os';
import { basename, dirname, join, resolve, sep, win32 } from 'node:path';

const WINDOWS_VOLUME_PATTERN = /^[A-Za-z]:/u;
const WINDOWS_OUTPUT_VOLUME_PATTERN = /^[A-Za-z]{1,5}:/u;
const WINDOWS_UNC_PATTERN = /^(?:\\\\|\/\/)[^\\/]+[\\/][^\\/]+/u;
const WINDOWS_BACKSLASH_UNC_PATTERN = /^\\\\/u;

/**
 * @typedef {object} PathApi
 * @property {(path: string) => string} basename Gets the final path segment.
 * @property {(path: string) => string} dirname Gets the parent directory.
 * @property {(...paths: string[]) => string} join Joins path segments.
 * @property {(...paths: string[]) => string} resolve Resolves path segments.
 */

/** @type {PathApi} */
const nativePathApi = {
    basename,
    dirname,
    join,
    resolve,
};

/**
 * Gets the filename portion of a user-configured path.
 *
 * @param {string} filePath Path to inspect.
 * @returns {string} Final path segment.
 */
export function basenameConfiguredPath(filePath) {
    return getPathApi(filePath).basename(filePath);
}

/**
 * Gets the parent directory portion of a user-configured path.
 *
 * @param {string} filePath Path to inspect.
 * @returns {string} Parent directory path.
 */
export function dirnameConfiguredPath(filePath) {
    return getPathApi(filePath).dirname(filePath);
}

/**
 * Checks whether a configured path contains a specific folder segment.
 *
 * @param {string} filePath Path to inspect.
 * @param {string} segment Folder segment to find.
 * @returns {boolean} True when the segment exists in the path.
 */
export function hasConfiguredPathSegment(filePath, segment) {
    return filePath.split(/[\\/]+/u).includes(segment);
}

/**
 * Joins path segments using native separators or Windows separators for Windows-style input.
 *
 * @param {string} basePath Base path that determines path semantics.
 * @param {...string} segments Additional path segments.
 * @returns {string} Joined path.
 */
export function joinConfiguredPath(basePath, ...segments) {
    return getPathApi(basePath).join(basePath, ...segments);
}

/**
 * Resolves a configured file destination against a default folder when only
 * a filename is provided.
 *
 * @param {string} filePath File path or filename to inspect.
 * @param {string} defaultFolder Folder used when filePath is only a filename.
 * @returns {string} File destination path.
 */
export function resolveConfiguredFileDestination(filePath, defaultFolder) {
    if (isConfiguredFilenameOnly(filePath)) {
        return joinConfiguredPath(defaultFolder, filePath);
    }

    return filePath;
}

/**
 * Resolves a path using native semantics or Windows semantics for Windows-style input.
 *
 * @param {string} filePath Path to resolve.
 * @returns {string} Resolved path.
 */
export function resolveConfiguredPath(filePath) {
    return getPathApi(filePath).resolve(filePath);
}

/**
 * Validates and normalizes a file-system write destination for the current OS.
 *
 * @param {string} outputPath File or folder path that will be written.
 * @param {string} potentialOutputFolder Folder that would receive generated output.
 * @returns {string} Path normalized for the current OS.
 */
export function normalizeConfiguredOutputPath(
    outputPath,
    potentialOutputFolder
) {
    return normalizeConfiguredOutputPathForPlatform(
        outputPath,
        potentialOutputFolder,
        platform()
    );
}

/**
 * Validates and normalizes a file-system write destination for a platform.
 *
 * @param {string} outputPath File or folder path that will be written.
 * @param {string} potentialOutputFolder Folder that would receive generated output.
 * @param {NodeJS.Platform} platformName Runtime platform name.
 * @returns {string} Path normalized for the supplied OS.
 */
export function normalizeConfiguredOutputPathForPlatform(
    outputPath,
    potentialOutputFolder,
    platformName
) {
    if (platformName === 'win32') {
        return normalizeWindowsOutputPath(outputPath, potentialOutputFolder);
    }

    if (isWindowsOnlyOutputPath(outputPath)) {
        throw new Error(
            `Output will not be generated because the output folder is formatted for Windows: ${potentialOutputFolder}`
        );
    }

    return outputPath;
}

/**
 * Checks whether a configured path is only a filename with no folder path.
 *
 * @param {string} filePath Path to inspect.
 * @returns {boolean} True when the value contains no directory component.
 */
function isConfiguredFilenameOnly(filePath) {
    return !/[\\/]/u.test(filePath) && !WINDOWS_VOLUME_PATTERN.test(filePath);
}

/**
 * Normalizes a Windows output path or rejects POSIX-style separators.
 *
 * @param {string} outputPath File or folder path that will be written.
 * @param {string} potentialOutputFolder Folder that would receive generated output.
 * @returns {string} Windows-compatible output path.
 */
function normalizeWindowsOutputPath(outputPath, potentialOutputFolder) {
    if (outputPath.includes('/')) {
        if (
            WINDOWS_OUTPUT_VOLUME_PATTERN.test(outputPath) ||
            WINDOWS_BACKSLASH_UNC_PATTERN.test(outputPath)
        ) {
            return outputPath.replace(/\//gu, '\\');
        }

        throw new Error(
            `Output will not be generated because the output folder is not formatted for Windows: ${potentialOutputFolder}`
        );
    }

    return outputPath;
}

/**
 * Checks whether a configured output path only belongs to Windows.
 *
 * @param {string} outputPath File or folder path that will be written.
 * @returns {boolean} True when the path should be rejected outside Windows.
 */
function isWindowsOnlyOutputPath(outputPath) {
    return (
        WINDOWS_OUTPUT_VOLUME_PATTERN.test(outputPath) ||
        WINDOWS_BACKSLASH_UNC_PATTERN.test(outputPath)
    );
}

/**
 * Selects path operations for native paths or Windows-style configured paths.
 *
 * @param {string} filePath Path to inspect.
 * @returns {PathApi} Matching path operations.
 */
function getPathApi(filePath) {
    if (isWindowsStylePath(filePath)) {
        return win32;
    }

    return nativePathApi;
}

/**
 * Checks whether a path string uses Windows volume, UNC, or separator syntax.
 *
 * @param {string} filePath Path to inspect.
 * @returns {boolean} True when Windows path semantics should be used.
 */
function isWindowsStylePath(filePath) {
    return (
        sep === '\\' ||
        WINDOWS_VOLUME_PATTERN.test(filePath) ||
        WINDOWS_UNC_PATTERN.test(filePath) ||
        filePath.includes('\\')
    );
}
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
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HTML_SOURCE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'html');
const BASE_TEMPLATE_PATH = join(HTML_SOURCE_DIR, 'base.html');
const REPORT_SCRIPT_PATH = join(HTML_SOURCE_DIR, 'report.js');
const STYLES_PATH = join(HTML_SOURCE_DIR, 'styles.css');

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
    const replacements = new Map([
        ['refresh.script', renderRefreshScript(options.refreshSeconds)],
        ['styles.css', readHtmlSourceFile(STYLES_PATH)],
        ['report.json', escapeScriptJson(report)],
        ['report.js', readHtmlSourceFile(REPORT_SCRIPT_PATH)],
    ]);

    return replaceTemplateStubLines(
        readHtmlSourceFile(BASE_TEMPLATE_PATH),
        replacements
    );
}

/**
 * Reads one HTML template source file as UTF-8 text.
 *
 * @param {string} filePath Template source file path.
 * @returns {string} File contents.
 */
function readHtmlSourceFile(filePath) {
    return readFileSync(filePath, 'utf8').trimEnd();
}

/**
 * Replaces full template lines that contain known stub labels.
 *
 * @param {string} template Template source containing stub comment lines.
 * @param {Map<string, string>} replacements Replacement text keyed by stub label.
 * @returns {string} Template with each matching line replaced.
 */
function replaceTemplateStubLines(template, replacements) {
    return template
        .split(/\r?\n/u)
        .map((line) => replaceTemplateStubLine(line, replacements))
        .join('\n');
}

/**
 * Replaces a single template line when it contains one of the configured stubs.
 *
 * @param {string} line Template line.
 * @param {Map<string, string>} replacements Replacement text keyed by stub label.
 * @returns {string} Original or replacement line.
 */
function replaceTemplateStubLine(line, replacements) {
    for (const [stub, replacement] of replacements) {
        if (line.includes(stub)) {
            return replacement;
        }
    }

    return line;
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

# report-renderer.js
Source file: `src/report-renderer.js`.
```javascript
import { renderHtmlReport } from './report-html.js';
import { renderJsonReport } from './report-json.js';
import { renderTextReport } from './report-text.js';

/**
 * @typedef {object} RenderOptions
 * @property {boolean} forceRefresh Whether HTML output should include the calculated refresh timer.
 * @property {string} format Output format.
 * @property {number | undefined} interval Optional regeneration interval in seconds.
 */

/**
 * Renders a report in the requested output format.
 *
 * @param {object} report Structured usage report.
 * @param {RenderOptions} options Runtime options that control output rendering.
 * @returns {string} Rendered report.
 */
export function renderReport(report, options) {
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
import { SESSION_DIR_NAMES } from './constants.js';
import { joinConfiguredPath } from './path-utils.js';

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
            walkJsonlFiles(joinConfiguredPath(codexHome, dirName), minMtime)
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
```

# session-parser.js
Source file: `src/session-parser.js`.
```javascript
import { readFile } from 'node:fs/promises';
import { TOKEN_FIELDS } from './constants.js';
import { basenameConfiguredPath } from './path-utils.js';
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
    const name = basenameConfiguredPath(String(file ?? ''));
    return name.endsWith('.jsonl')
        ? name.slice(0, -'.jsonl'.length)
        : name || 'unknown';
}
```

# settings.js
Source file: `src/settings.js`.
```javascript
import { platform } from 'node:os';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    DATA_PATH_WINDOWS_DEFAULT,
    DEFAULT_CODEX_HOME,
    DEFAULT_DATA_PATH,
} from './constants.js';
import { hasConfiguredPathSegment, joinConfiguredPath } from './path-utils.js';

const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * @typedef {object} AppEnvironment
 * @property {string} codexHome Codex home folder to scan.
 * @property {string} dataPath Root folder used for app-managed data files.
 */

/**
 * Reads app environment settings from `.env` and the current process environment.
 *
 * @param {NodeJS.ProcessEnv} [processEnv] Environment variables supplied by the shell.
 * @returns {Promise<AppEnvironment>} Runtime environment settings.
 */
export async function readAppEnvironment(processEnv = process.env) {
    const fileEnv = await readDotEnvFile(join(PROJECT_ROOT, '.env'));
    const codexHome = resolveCodexHomeSetting(
        readSettingValue('CODEX_HOME', fileEnv, processEnv)
    );
    const dataPath =
        readSettingValue('DATA_PATH', fileEnv, processEnv) ?? DEFAULT_DATA_PATH;

    return {
        codexHome,
        dataPath,
    };
}

/**
 * Reads default model settings from Codex config when session metadata omits them.
 *
 * @param {string} codexHome Codex home directory.
 * @returns {Promise<{ model: string, intelligenceLevel: string }>} Default labels.
 */
export async function readConfigDefaults(codexHome) {
    const configPath = joinConfiguredPath(codexHome, 'config.toml');
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
 * Reads a dotenv-style file as key/value settings.
 *
 * @param {string} configPath Dotenv file path.
 * @returns {Promise<Record<string, string>>} Parsed settings.
 */
async function readDotEnvFile(configPath) {
    try {
        const text = await readFile(configPath, 'utf8');
        return parseDotEnv(text);
    } catch (error) {
        if (!isNodeFileError(error, 'ENOENT')) {
            return {};
        }

        return readCreatedDotEnvFile(configPath);
    }
}

/**
 * Creates a missing `.env` file from `.env.example`, applying OS-specific
 * defaults before parsing `.env`.
 *
 * @param {string} configPath Dotenv file path.
 * @returns {Promise<Record<string, string>>} Parsed settings.
 */
async function readCreatedDotEnvFile(configPath) {
    const examplePath = join(PROJECT_ROOT, '.env.example');

    try {
        const exampleText = await readFile(examplePath, 'utf8');
        await writeFile(configPath, prepareDotEnvTemplate(exampleText), {
            flag: 'wx',
        });
    } catch (error) {
        if (!isNodeFileError(error, 'EEXIST')) {
            return {};
        }
    }

    try {
        const text = await readFile(configPath, 'utf8');
        return parseDotEnv(text);
    } catch {
        return {};
    }
}

/**
 * Applies runtime platform defaults to the `.env.example` template.
 *
 * @param {string} text Template dotenv file contents.
 * @returns {string} Dotenv contents to write to `.env`.
 */
function prepareDotEnvTemplate(text) {
    if (platform() !== 'win32') {
        return text;
    }

    return replaceDotEnvSetting(text, 'DATA_PATH', DATA_PATH_WINDOWS_DEFAULT);
}

/**
 * Replaces a dotenv setting while leaving comments and surrounding lines intact.
 *
 * @param {string} text Dotenv file contents.
 * @param {string} key Setting name.
 * @param {string} value Setting value.
 * @returns {string} Dotenv contents with the setting assigned.
 */
function replaceDotEnvSetting(text, key, value) {
    const escapedKey = key.replace(
        /[.*+?^${}()|[\]\\]/gu,
        (match) => `\\${match}`
    );
    const pattern = new RegExp(`^\\s*${escapedKey}\\s*=.*$`, 'mu');
    const assignment = `${key}=${value}`;

    if (pattern.test(text)) {
        return text.replace(pattern, assignment);
    }

    return text.endsWith('\n')
        ? `${text}${assignment}\n`
        : `${text}\n${assignment}\n`;
}

/**
 * Checks whether a caught error is a Node.js file-system error with a code.
 *
 * @param {unknown} error Caught error value.
 * @param {string} code Expected Node.js error code.
 * @returns {boolean} Whether the error has the expected code.
 */
function isNodeFileError(error, code) {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === code
    );
}

/**
 * Parses simple dotenv content without requiring a runtime dependency.
 *
 * @param {string} text Dotenv file contents.
 * @returns {Record<string, string>} Parsed settings.
 */
function parseDotEnv(text) {
    /** @type {Record<string, string>} */
    const settings = {};

    for (const line of text.split(/\r?\n/u)) {
        const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u.exec(line);

        if (!match || match[1].startsWith('#')) {
            continue;
        }

        settings[match[1]] = unwrapEnvValue(match[2]);
    }

    return settings;
}

/**
 * Chooses a setting value from process environment first, then `.env`.
 *
 * @param {string} key Setting name.
 * @param {Record<string, string>} fileEnv Values loaded from `.env`.
 * @param {NodeJS.ProcessEnv} processEnv Values supplied by the shell.
 * @returns {string | undefined} Selected setting value.
 */
function readSettingValue(key, fileEnv, processEnv) {
    const processValue = processEnv[key];

    if (processValue && processValue.trim() !== '') {
        return processValue;
    }

    const fileValue = fileEnv[key];

    if (fileValue && fileValue.trim() !== '') {
        return fileValue;
    }

    return undefined;
}

/**
 * Removes optional matching quotes around an environment value.
 *
 * @param {string} value Raw environment value.
 * @returns {string} Unquoted value.
 */
function unwrapEnvValue(value) {
    const trimmed = value.trim();
    const quote = trimmed[0];

    if (
        (quote === '"' || quote === "'") &&
        trimmed.endsWith(quote) &&
        trimmed.length >= 2
    ) {
        return trimmed.slice(1, -1);
    }

    return trimmed;
}

/**
 * Resolves a configured Codex home folder, appending `.codex` when needed.
 *
 * @param {string | undefined} value Configured Codex home value.
 * @returns {string} Codex home folder.
 */
function resolveCodexHomeSetting(value) {
    if (!value || value.trim() === '') {
        return DEFAULT_CODEX_HOME;
    }

    const trimmed = value.trim();

    if (hasConfiguredPathSegment(trimmed, '.codex')) {
        return trimmed;
    }

    return joinConfiguredPath(trimmed, '.codex');
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
import { basenameConfiguredPath } from './path-utils.js';
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
    const name = basenameConfiguredPath(String(file ?? ''));
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

# usage-runner.js
Source file: `src/usage-runner.js`.
```javascript
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
 * @property {boolean} forceRefresh Whether HTML output should include the calculated refresh timer.
 * @property {string} format Output format.
 * @property {string | undefined} history Optional history output path.
 * @property {number | undefined} interval Optional regeneration interval in seconds.
 * @property {number} minutes Report window length in minutes.
 * @property {string | undefined} out Optional output file path.
 * @property {boolean} saveHistory Whether to append a history snapshot.
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
