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
