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
