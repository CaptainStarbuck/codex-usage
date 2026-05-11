#!/usr/bin/env node

import { DEFAULT_WINDOW_MINUTES } from './constants.js';
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
    console.log(`Usage: node src/codex-usage.js [--minutes 15] [--codex-home /home/codex/.codex] [--data-path /tmp] [--format text|json|html] [--out path] [--interval seconds] [--force-refresh] [--save-history] [--history path]

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

    return {
        ...options,
        codexHome: options.codexHome ?? environment.codexHome,
        dataPath: options.dataPath ?? environment.dataPath,
    };
}

main().catch((error) => {
    console.error(`codex-usage: ${error.message}`);
    process.exitCode = 1;
});
