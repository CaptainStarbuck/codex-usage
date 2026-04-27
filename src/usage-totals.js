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
