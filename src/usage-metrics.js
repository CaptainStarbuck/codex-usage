import { DERIVED_TOKEN_FIELDS, TOKEN_FIELDS } from './constants.js';
import { buildQuotaReport } from './quota-snapshot.js';
import { groupModels, groupSessions } from './usage-groups.js';
import { buildInsights } from './usage-insights.js';
import { normalizeUsageRows } from './usage-normalizer.js';

/**
 * Builds the structured report model consumed by every renderer.
 *
 * @param {{ rows: object[], quotaSnapshots?: object[], duplicateTokenCountEvents?: number, cutoff: Date, now: Date, minutes: number, codexHome: string, format: string, range?: object, excludedSessionsWithoutTimestamps?: number }} input Report inputs.
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
            excluded_sessions_without_timestamps: Number(
                input.excludedSessionsWithoutTimestamps ?? 0
            ),
            range: normalizeRangeMetadata(input.range),
        },
    };

    report.insights = buildInsights(report);
    return report;
}

/**
 * Builds JSON-safe metadata for normalized range settings.
 *
 * @param {object | undefined} range Normalized range settings.
 * @returns {object | undefined} Report range metadata.
 */
function normalizeRangeMetadata(range) {
    if (!range) {
        return undefined;
    }

    return {
        from_date:
            range.fromDate instanceof Date
                ? range.fromDate.toISOString()
                : undefined,
        to_date:
            range.toDate instanceof Date
                ? range.toDate.toISOString()
                : undefined,
        scope: String(range.scope ?? ''),
        in_scope: Boolean(range.inScope),
        max_events: Number(range.maxEvents ?? 0),
        max_files: Number(range.maxFiles ?? 0),
        max_models: Number(range.maxModels ?? 0),
        max_sessions: Number(range.maxSessions ?? 0),
        max_turns: Number(range.maxTurns ?? 0),
    };
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
