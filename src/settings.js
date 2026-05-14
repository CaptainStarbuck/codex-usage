import { platform } from 'node:os';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    DATA_PATH_WINDOWS_DEFAULT,
    DEFAULT_CODEX_HOME,
    DEFAULT_DATA_PATH,
    DEFAULT_DATETIME_FORMAT,
    DEFAULT_STYLES_FILE_NAME,
} from './constants.js';
import { hasConfiguredPathSegment, joinConfiguredPath } from './path-utils.js';

const PROJECT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * @typedef {object} AppEnvironment
 * @property {string} codexHome Codex home folder to scan.
 * @property {string} dataPath Root folder used for app-managed data files.
 * @property {string} datetimeFormat Report datetime display format.
 * @property {string} styles HTML report stylesheet selection.
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
    const datetimeFormat =
        readSettingValue('DATETIME_FORMAT', fileEnv, processEnv) ??
        DEFAULT_DATETIME_FORMAT;
    const styles =
        readSettingValue('STYLES', fileEnv, processEnv) ??
        DEFAULT_STYLES_FILE_NAME;

    return {
        codexHome,
        dataPath,
        datetimeFormat,
        styles,
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
