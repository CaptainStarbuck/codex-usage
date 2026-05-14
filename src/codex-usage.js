#!/usr/bin/env node

import { access, mkdir } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    DEFAULT_IN_SCOPE,
    DEFAULT_MAX_EVENTS,
    DEFAULT_MAX_FILES,
    DEFAULT_MAX_MODELS,
    DEFAULT_MAX_SESSIONS,
    DEFAULT_MAX_TURNS,
    DEFAULT_RANGE_SCOPE,
    DEFAULT_STYLES_FILE_NAME,
    DEFAULT_WINDOW_MINUTES,
} from './constants.js';
import {
    dirnameConfiguredPath,
    isConfiguredFilenameOnly,
    joinConfiguredPath,
    normalizeConfiguredOutputPath,
    resolveConfiguredPath,
} from './path-utils.js';
import { readAppEnvironment } from './settings.js';
import { runInterval, runOnce } from './usage-runner.js';
import { validateRangeOptionCombination } from './range-options.js';

const HTML_SOURCE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'html');
const STYLE_NAME_ALIASES = new Map([
    ['light', 'styles-light-01.css'],
    ['dark', 'styles-dark-01.css'],
]);

/**
 * @typedef {object} ParsedRuntimeOptions
 * @property {string | undefined} codexHome Codex home folder to scan.
 * @property {string | undefined} dataPath Root folder used for app-managed data files.
 * @property {boolean} forceRefresh Whether HTML output should include the calculated refresh timer.
 * @property {string} format Output format.
 * @property {string | undefined} fromDate Absolute inclusive start date value.
 * @property {number | undefined} fromMinutes Relative inclusive start minutes.
 * @property {string | undefined} history Optional history output path.
 * @property {boolean | undefined} inScope Whether only complete sessions inside the range are included.
 * @property {number | undefined} interval Optional regeneration interval in seconds.
 * @property {number | undefined} maxEvents Maximum event rows allowed in generated detail tables.
 * @property {number | undefined} maxFiles Maximum session JSONL files allowed after file scanning.
 * @property {number | undefined} maxModels Maximum model groups allowed in generated grouped tables.
 * @property {number | undefined} maxSessions Maximum session rows allowed in generated tables.
 * @property {number | undefined} maxTurns Maximum turn rows allowed in generated detail tables.
 * @property {number} minutes Report window length in minutes.
 * @property {boolean} minutesExplicit Whether `--minutes` was supplied by the user.
 * @property {string | undefined} out Optional output file path.
 * @property {string | undefined} rangeScope Whether range matching uses events or whole sessions.
 * @property {boolean} saveHistory Whether to append a history snapshot.
 * @property {string | undefined} styles Optional HTML stylesheet file path.
 * @property {string | undefined} toDate Absolute exclusive end date value.
 * @property {number | undefined} toMinutes Relative exclusive end minutes.
 */

/**
 * @typedef {ParsedRuntimeOptions & { codexHome: string, dataPath: string, datetimeFormat: string, inScope: boolean, maxEvents: number, maxFiles: number, maxModels: number, maxSessions: number, maxTurns: number, rangeScope: string, stylesPath: string }} RuntimeOptions
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
        fromDate: undefined,
        fromMinutes: undefined,
        history: undefined,
        inScope: undefined,
        interval: undefined,
        maxEvents: undefined,
        maxFiles: undefined,
        maxModels: undefined,
        maxSessions: undefined,
        maxTurns: undefined,
        minutes: DEFAULT_WINDOW_MINUTES,
        minutesExplicit: false,
        out: undefined,
        rangeScope: undefined,
        saveHistory: false,
        styles: undefined,
        toDate: undefined,
        toMinutes: undefined,
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
            options.minutes = parsePositiveIntegerOption(arg, args[index + 1]);
            options.minutesExplicit = true;
            index += 1;
        } else if (arg === '--from-date') {
            options.fromDate = readOptionValue(arg, args[index + 1]);
            index += 1;
        } else if (arg === '--from-minutes') {
            options.fromMinutes = parsePositiveIntegerOption(
                arg,
                args[index + 1]
            );
            index += 1;
        } else if (arg === '--to-date') {
            options.toDate = readOptionValue(arg, args[index + 1]);
            index += 1;
        } else if (arg === '--to-minutes') {
            options.toMinutes = parsePositiveIntegerOption(
                arg,
                args[index + 1]
            );
            index += 1;
        } else if (arg === '--scope') {
            options.rangeScope = readOptionValue(arg, args[index + 1]);
            index += 1;
        } else if (arg === '--in-scope') {
            options.inScope = true;
        } else if (arg === '--max-events') {
            options.maxEvents = parseLimitOption(arg, args[index + 1]);
            index += 1;
        } else if (arg === '--max-files') {
            options.maxFiles = parseLimitOption(arg, args[index + 1]);
            index += 1;
        } else if (arg === '--max-models') {
            options.maxModels = parseLimitOption(arg, args[index + 1]);
            index += 1;
        } else if (arg === '--max-sessions') {
            options.maxSessions = parseLimitOption(arg, args[index + 1]);
            index += 1;
        } else if (arg === '--max-turns') {
            options.maxTurns = parseLimitOption(arg, args[index + 1]);
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
        } else if (arg === '--styles' || arg === '--style') {
            if (!args[index + 1]) {
                continue;
            }
            options.styles = args[index + 1];
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
    validateRangeOptionCombination(options);
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
 * Reads a required option value.
 *
 * @param {string} optionName CLI option name.
 * @param {string | undefined} value Candidate option value.
 * @returns {string} Option value.
 */
function readOptionValue(optionName, value) {
    if (!value || value.startsWith('--')) {
        throw new Error(`${optionName} requires a value.`);
    }

    return value;
}

/**
 * Parses a positive integer CLI option.
 *
 * @param {string} optionName CLI option name.
 * @param {string | undefined} value Candidate option value.
 * @returns {number} Positive integer value.
 */
function parsePositiveIntegerOption(optionName, value) {
    const optionValue = readOptionValue(optionName, value);
    const numberValue = Number(optionValue);

    if (!Number.isInteger(numberValue) || numberValue < 1) {
        throw new Error(`${optionName} must be a positive integer.`);
    }

    return numberValue;
}

/**
 * Parses a nonnegative detail limit CLI option.
 *
 * @param {string} optionName CLI option name.
 * @param {string | undefined} value Candidate option value.
 * @returns {number} Nonnegative integer value.
 */
function parseLimitOption(optionName, value) {
    const optionValue = readOptionValue(optionName, value);
    const numberValue = Number(optionValue);

    if (!Number.isInteger(numberValue) || numberValue < 0) {
        throw new Error(`${optionName} must be a positive integer or 0.`);
    }

    return numberValue;
}

/**
 * Prints the command help text.
 *
 * @returns {void}
 */
function printHelp() {
    console.log(`Usage: node src/codex-usage.js [options]
 --minutes <min>       Show previous N minutes
 --from-date <date>    Start date or date/time (2026-05-13T19:00, 5/13, 5/13/26)
 --from-minutes <min>  Start at now minus minutes
 --to-date <date>      End date or date/time
 --to-minutes <min>    End at now minus minutes
 --scope <scope>       Range scope: events or sessions (default --scope sessions)
 --in-scope            Include only complete sessions (default not in scope)
 --max-events <count>  Max events per detail table (alpha default is 500)
 --max-sessions <num>  Max sessions per table      (alpha default is 500)
 --max-files <count>   Max session files scanned
 --max-turns <count>   Max turns per detail table  (alpha not yet supported)
 --max-models <count>  Max model groups per table
 --codex-home <path>   Codex home folder to scan
 --data-path <path>    App data and history folder
 --format <format>     Output: text, json, or html (default text)
 --out <path>          Write report to file        (default /tmp/codex-usage)
 --styles <style>      HTML style: light, dark, or path (default dark)
 --style <style>       Alias for --styles
 --interval <sec>      Regenerate output every N seconds
 --force-refresh       Add browser refresh to HTML output
 --save-history        Append local history snapshot
 --history <path>      History file path and enable save
 -h, --help            Show this help and quit`);
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
    const stylesPath = await resolveStylesPath(
        options.styles ?? environment.styles
    );

    await mkdir(resolveConfiguredPath(dataPath), { recursive: true });

    return {
        ...options,
        codexHome: options.codexHome ?? environment.codexHome,
        dataPath,
        datetimeFormat: environment.datetimeFormat,
        inScope: options.inScope ?? environment.inScope ?? DEFAULT_IN_SCOPE,
        maxEvents:
            options.maxEvents ?? environment.maxEvents ?? DEFAULT_MAX_EVENTS,
        maxFiles: options.maxFiles ?? environment.maxFiles ?? DEFAULT_MAX_FILES,
        maxModels:
            options.maxModels ?? environment.maxModels ?? DEFAULT_MAX_MODELS,
        maxSessions:
            options.maxSessions ??
            environment.maxSessions ??
            DEFAULT_MAX_SESSIONS,
        maxTurns: options.maxTurns ?? environment.maxTurns ?? DEFAULT_MAX_TURNS,
        rangeScope:
            options.rangeScope ?? environment.rangeScope ?? DEFAULT_RANGE_SCOPE,
        stylesPath,
    };
}

/**
 * Resolves the configured HTML stylesheet path and confirms it can be read.
 *
 * @param {string | undefined} stylesSetting CLI or environment stylesheet value.
 * @returns {Promise<string>} Resolved stylesheet path.
 */
async function resolveStylesPath(stylesSetting) {
    const stylesPath = normalizeStylesPath(
        stylesSetting ?? DEFAULT_STYLES_FILE_NAME
    );

    try {
        await access(resolveConfiguredPath(stylesPath));
    } catch {
        throw new Error(`Styles ${stylesPath} is inaccessible`);
    }

    return stylesPath;
}

/**
 * Applies style aliases, filename defaults, and OS path validation.
 *
 * @param {string} stylesSetting CLI or environment stylesheet value.
 * @returns {string} Validated stylesheet path.
 */
function normalizeStylesPath(stylesSetting) {
    const normalizedName = normalizeStylesName(stylesSetting.trim());
    const configuredStylesPath = isConfiguredFilenameOnly(normalizedName)
        ? joinConfiguredPath(HTML_SOURCE_DIR, normalizedName)
        : normalizedName;

    return normalizeConfiguredOutputPath(
        configuredStylesPath,
        dirnameConfiguredPath(configuredStylesPath)
    );
}

/**
 * Converts short style names and extensionless filenames to CSS filenames.
 *
 * @param {string} stylesName User configured style value.
 * @returns {string} Normalized style filename or path.
 */
function normalizeStylesName(stylesName) {
    const aliasedName = STYLE_NAME_ALIASES.get(stylesName) ?? stylesName;

    if (isConfiguredFilenameOnly(aliasedName) && extname(aliasedName) === '') {
        return `${aliasedName}.css`;
    }

    return aliasedName;
}

main().catch((error) => {
    console.error(`codex-usage: ${error.message}`);
    process.exitCode = 1;
});
