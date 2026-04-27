import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Reads default model settings from Codex config when session metadata omits them.
 *
 * @param {string} codexHome Codex home directory.
 * @returns {Promise<{ model: string, intelligenceLevel: string }>} Default labels.
 */
export async function readConfigDefaults(codexHome) {
    const configPath = join(codexHome, 'config.toml');
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
