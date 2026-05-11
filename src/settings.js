import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_CODEX_HOME, DEFAULT_DATA_PATH } from './constants.js';
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
    } catch {
        return {};
    }
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
